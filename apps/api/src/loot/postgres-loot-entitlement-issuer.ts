import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import {
  LootEntitlementIdempotencyConflictError,
  LootEntitlementSourceConflictError,
  LootEntitlementTableNotFoundError,
  assertLootDate,
  assertLootUuid,
  canonicalLootJson,
  type LootEntitlementResult,
} from "./loot-entitlement.js";

export interface IssueBoundLootEntitlementCommand {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly tableId: string;
  readonly tableVersion: number;
  readonly source: string;
  readonly referenceId: string;
  readonly expiresAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface ReplayRow {
  readonly request_hash: Buffer;
  readonly result: LootEntitlementResult;
}

interface TableRow {
  readonly table_id: string;
  readonly version: number;
}

/**
 * Issues an entitlement inside an existing PostgreSQL transaction.
 *
 * The caller must lock the player row before invoking this function. This keeps
 * trusted reward producers serialized with normal entitlement issuance while
 * allowing their own claim, ledger, entitlement, and outbox rows to commit as
 * one unit.
 */
export async function issueBoundLootEntitlementWithinTransaction(
  client: PoolClient,
  command: IssueBoundLootEntitlementCommand,
  now: Date,
): Promise<LootEntitlementResult> {
  validateBoundCommand(command, now);
  const requestHash = boundRequestHash(command);

  const replay = await readReplay(
    client,
    command.playerId,
    command.idempotencyKey,
    requestHash,
    "idempotency",
  );
  if (replay !== null) return replay;

  const sourceReplay = await readSourceReplay(client, command, requestHash);
  if (sourceReplay !== null) return sourceReplay;

  const table = await client.query<TableRow>(
    `SELECT table_id,version
       FROM loot_table_versions
      WHERE table_id=$1 AND version=$2
        AND published_at IS NOT NULL AND published_at <= $3
      FOR SHARE`,
    [command.tableId, command.tableVersion, now],
  );
  if (!table.rows[0]) throw new LootEntitlementTableNotFoundError();

  const entitlementId = randomUUID();
  const result: LootEntitlementResult = {
    entitlementId,
    tableId: command.tableId,
    tableVersion: command.tableVersion,
    source: command.source,
    referenceId: command.referenceId,
    metadata: command.metadata ?? {},
    status: "available",
    issuedAt: now.toISOString(),
    expiresAt: command.expiresAt.toISOString(),
    replayed: false,
  };

  await client.query(
    `INSERT INTO loot_entitlements
       (id,player_id,idempotency_key,request_hash,table_id,table_version,source,reference_id,
        metadata,status,issued_at,expires_at,result)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'available',$10,$11,$12::jsonb)`,
    [
      entitlementId,
      command.playerId,
      command.idempotencyKey,
      requestHash,
      command.tableId,
      command.tableVersion,
      command.source,
      command.referenceId,
      JSON.stringify(command.metadata ?? {}),
      now,
      command.expiresAt,
      JSON.stringify(result),
    ],
  );
  await client.query(
    `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
     VALUES ($1,'loot_entitlement',$2,'loot.entitlement.issued',$3::jsonb)`,
    [randomUUID(), entitlementId, JSON.stringify({
      playerId: command.playerId,
      tableId: command.tableId,
      tableVersion: command.tableVersion,
      source: command.source,
      referenceId: command.referenceId,
      expiresAt: command.expiresAt.toISOString(),
      metadata: command.metadata ?? {},
    })],
  );

  return result;
}

export function boundLootEntitlementRequestHash(command: IssueBoundLootEntitlementCommand): Buffer {
  return boundRequestHash(command);
}

function validateBoundCommand(command: IssueBoundLootEntitlementCommand, now: Date): void {
  assertLootUuid(command.playerId, "playerId");
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
  assertBoundedText(command.tableId, "tableId", 128);
  if (!Number.isSafeInteger(command.tableVersion) || command.tableVersion < 1) {
    throw new RangeError("tableVersion must be a positive safe integer");
  }
  assertBoundedText(command.source, "source", 100);
  assertBoundedText(command.referenceId, "referenceId", 200);
  assertLootDate(command.expiresAt, "expiresAt");
  assertLootDate(now, "now");
  if (command.expiresAt.getTime() <= now.getTime()) throw new RangeError("expiresAt must be in the future");
  canonicalLootJson(command.metadata ?? {});
}

function boundRequestHash(command: IssueBoundLootEntitlementCommand): Buffer {
  return createHash("sha256").update(canonicalLootJson({
    playerId: command.playerId,
    tableId: command.tableId,
    tableVersion: command.tableVersion,
    source: command.source,
    referenceId: command.referenceId,
    expiresAt: command.expiresAt.toISOString(),
    metadata: command.metadata ?? {},
  })).digest();
}

async function readReplay(
  client: PoolClient,
  playerId: string,
  idempotencyKey: string,
  requestHash: Buffer,
  conflict: "idempotency" | "source",
): Promise<LootEntitlementResult | null> {
  const result = await client.query<ReplayRow>(
    `SELECT request_hash,result
       FROM loot_entitlements
      WHERE player_id=$1 AND idempotency_key=$2`,
    [playerId, idempotencyKey],
  );
  return replayResult(result.rows[0], requestHash, conflict);
}

async function readSourceReplay(
  client: PoolClient,
  command: IssueBoundLootEntitlementCommand,
  requestHash: Buffer,
): Promise<LootEntitlementResult | null> {
  const result = await client.query<ReplayRow>(
    `SELECT request_hash,result
       FROM loot_entitlements
      WHERE player_id=$1 AND source=$2 AND reference_id=$3`,
    [command.playerId, command.source, command.referenceId],
  );
  return replayResult(result.rows[0], requestHash, "source");
}

function replayResult(
  row: ReplayRow | undefined,
  requestHash: Buffer,
  conflict: "idempotency" | "source",
): LootEntitlementResult | null {
  if (!row) return null;
  if (row.request_hash.length !== requestHash.length || !timingSafeEqual(row.request_hash, requestHash)) {
    if (conflict === "idempotency") throw new LootEntitlementIdempotencyConflictError();
    throw new LootEntitlementSourceConflictError();
  }
  return { ...row.result, replayed: true };
}

function assertBoundedText(value: string, name: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain between 1 and ${maximumLength} characters`);
  }
}
