import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import { evaluateLootTable, type LootEntry, type LootTable } from "./loot-engine.js";
import {
  LootEntitlementIdempotencyConflictError,
  LootEntitlementPlayerNotFoundError,
  LootEntitlementSourceConflictError,
  LootEntitlementTableNotFoundError,
  assertLootDate,
  lootEntitlementRequestHash,
  validateIssueLootEntitlementCommand,
  type IssueLootEntitlementCommand,
  type LootEntitlementResult,
  type LootEntitlementStatus,
} from "./loot-entitlement.js";
import {
  LootEntitlementExpiredError,
  LootEntitlementNotAvailableError,
  LootEntitlementNotFoundError,
  LootIdempotencyConflictError,
  LootPlayerNotFoundError,
  LootTableNotFoundError,
  lootOpeningRequestHash,
  validateOpenLootCommand,
  type LootOpeningResult,
  type OpenLootCommand,
} from "./loot-opening.js";

interface LootTableRow {
  readonly table_id: string;
  readonly version: number;
  readonly pity_group: string;
  readonly pity_after: number | null;
  readonly published_at: Date;
}

interface LootEntryRow {
  readonly entry_id: string;
  readonly item_id: string;
  readonly item_version: number;
  readonly entry_kind: "weighted" | "guaranteed";
  readonly weight: string;
  readonly min_quantity: string;
  readonly max_quantity: string;
  readonly pity_eligible: boolean;
}

interface LootOpeningRow {
  readonly request_hash: Buffer;
  readonly result: LootOpeningResult;
}

interface EntitlementReplayRow {
  readonly request_hash: Buffer;
  readonly result: LootEntitlementResult;
}

interface EntitlementRow {
  readonly id: string;
  readonly player_id: string;
  readonly table_id: string;
  readonly table_version: number;
  readonly source: string;
  readonly reference_id: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly status: LootEntitlementStatus;
  readonly issued_at: Date;
  readonly expires_at: Date;
}

interface PityRow {
  readonly misses: number;
}

export type LootSeedFactory = () => Buffer;

/**
 * Issues server-bound loot entitlements and consumes them with loot evidence,
 * pity state, inventory grants, ledgers, and outbox messages in PostgreSQL transactions.
 */
export class PostgresLootStore {
  private readonly inventory: PostgresInventoryStore;

  public constructor(
    private readonly pool: Pool,
    inventory?: PostgresInventoryStore,
    private readonly seedFactory: LootSeedFactory = () => randomBytes(32),
  ) {
    this.inventory = inventory ?? new PostgresInventoryStore(pool);
  }

  public static connect(connectionString: string): PostgresLootStore {
    const pool = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30_000 });
    return new PostgresLootStore(pool);
  }

  public async issue(command: IssueLootEntitlementCommand, now = new Date()): Promise<LootEntitlementResult> {
    validateIssueLootEntitlementCommand(command, now);
    const requestHash = lootEntitlementRequestHash(command);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new LootEntitlementPlayerNotFoundError();

      const replay = await readEntitlementReplay(client, command.playerId, command.idempotencyKey, requestHash);
      if (replay !== null) {
        await client.query("COMMIT");
        return replay;
      }

      const sourceReplay = await readEntitlementSourceReplay(
        client, command.playerId, command.source, command.referenceId, requestHash,
      );
      if (sourceReplay !== null) {
        await client.query("COMMIT");
        return sourceReplay;
      }

      const table = await loadActiveTableRow(client, command.tableId, now);
      const entitlementId = randomUUID();
      const result: LootEntitlementResult = {
        entitlementId,
        tableId: table.table_id,
        tableVersion: table.version,
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
        [entitlementId, command.playerId, command.idempotencyKey, requestHash, table.table_id, table.version,
          command.source, command.referenceId, JSON.stringify(command.metadata ?? {}), now, command.expiresAt,
          JSON.stringify(result)],
      );
      await client.query(
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'loot_entitlement',$2,'loot.entitlement.issued',$3::jsonb)`,
        [randomUUID(), entitlementId, JSON.stringify({
          playerId: command.playerId,
          tableId: table.table_id,
          tableVersion: table.version,
          source: command.source,
          referenceId: command.referenceId,
          expiresAt: command.expiresAt.toISOString(),
        })],
      );

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") throw new LootEntitlementSourceConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  public async open(command: OpenLootCommand, now = new Date()): Promise<LootOpeningResult> {
    validateOpenLootCommand(command);
    assertLootDate(now, "now");
    const requestHash = lootOpeningRequestHash(command);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new LootPlayerNotFoundError();

      const replay = await readOpeningReplay(client, command, requestHash);
      if (replay !== null) {
        await client.query("COMMIT");
        return replay;
      }

      const entitlementResult = await client.query<EntitlementRow>(
        `SELECT id,player_id,table_id,table_version,source,reference_id,metadata,status,issued_at,expires_at
           FROM loot_entitlements
          WHERE id=$1 AND player_id=$2
          FOR UPDATE`,
        [command.entitlementId, command.playerId],
      );
      const entitlement = entitlementResult.rows[0];
      if (!entitlement) throw new LootEntitlementNotFoundError();
      if (entitlement.expires_at.getTime() <= now.getTime()) throw new LootEntitlementExpiredError();
      if (entitlement.status !== "available") throw new LootEntitlementNotAvailableError();

      const table = await loadEntitledTable(client, entitlement);
      await client.query(
        `INSERT INTO loot_pity_states (player_id,pity_group,misses)
         VALUES ($1,$2,0)
         ON CONFLICT (player_id,pity_group) DO NOTHING`,
        [command.playerId, table.pityGroup],
      );
      const pityState = await client.query<PityRow>(
        `SELECT misses FROM loot_pity_states
          WHERE player_id=$1 AND pity_group=$2
          FOR UPDATE`,
        [command.playerId, table.pityGroup],
      );
      const pityBefore = pityState.rows[0]?.misses;
      if (pityBefore === undefined) throw new Error("Loot pity state could not be locked");
      assertSafeNonNegativeInteger(pityBefore, "stored pity misses");

      const serverSeed = Buffer.from(this.seedFactory());
      if (serverSeed.length !== 32) throw new RangeError("loot seed factory must return exactly 32 bytes");
      const evaluation = evaluateLootTable(table, serverSeed, pityBefore);
      const openingId = randomUUID();
      const grantedRewards = [];

      for (const [sequence, reward] of evaluation.rewards.entries()) {
        const inventoryGrant = await this.inventory.grantWithinTransaction(client, {
          operationType: "grant",
          playerId: command.playerId,
          idempotencyKey: `loot:${openingId}:${sequence}`,
          itemId: reward.itemId,
          itemVersion: reward.itemVersion,
          quantity: reward.quantity,
          expiresAt: null,
          eventId: null,
          reason: "loot_reward",
          source: "loot",
          referenceId: openingId,
          metadata: {
            entitlementId: entitlement.id,
            lootTableId: table.tableId,
            lootTableVersion: table.version,
            lootEntryId: reward.entryId,
            seedCommitment: evaluation.proof.seedCommitment,
            entitlementSource: entitlement.source,
            entitlementReferenceId: entitlement.reference_id,
          },
        }, now);
        grantedRewards.push({
          entryId: reward.entryId,
          itemId: reward.itemId,
          itemVersion: reward.itemVersion,
          quantity: reward.quantity,
          inventoryOperationId: inventoryGrant.operationId,
        });
      }

      const result: LootOpeningResult = {
        openingId,
        entitlementId: entitlement.id,
        tableId: table.tableId,
        tableVersion: table.version,
        source: entitlement.source,
        referenceId: entitlement.reference_id,
        pityGroup: table.pityGroup,
        pityBefore: evaluation.pityBefore,
        pityAfter: evaluation.pityAfter,
        forcedPity: evaluation.forcedPity,
        rewards: grantedRewards,
        proof: evaluation.proof,
        replayed: false,
      };

      await client.query(
        `UPDATE loot_pity_states
            SET misses=$3,version=version+1,updated_at=$4
          WHERE player_id=$1 AND pity_group=$2`,
        [command.playerId, table.pityGroup, evaluation.pityAfter, now],
      );
      await client.query(
        `INSERT INTO loot_openings
           (id,player_id,idempotency_key,request_hash,entitlement_id,table_id,table_version,pity_group,
            pity_before,pity_after,forced_pity,proof_version,server_seed,seed_commitment,draws,result,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17)`,
        [openingId, command.playerId, command.idempotencyKey, requestHash, entitlement.id,
          table.tableId, table.version, table.pityGroup, evaluation.pityBefore, evaluation.pityAfter,
          evaluation.forcedPity, evaluation.proof.version, serverSeed,
          Buffer.from(evaluation.proof.seedCommitment, "hex"), JSON.stringify(evaluation.proof.draws),
          JSON.stringify(result), now],
      );
      for (const [sequence, reward] of grantedRewards.entries()) {
        await client.query(
          `INSERT INTO loot_opening_rewards
             (opening_id,table_id,table_version,sequence,entry_id,item_id,item_version,quantity,inventory_operation_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [openingId, table.tableId, table.version, sequence, reward.entryId, reward.itemId,
            reward.itemVersion, reward.quantity, reward.inventoryOperationId],
        );
      }
      await client.query(
        `UPDATE loot_entitlements
            SET status='consumed',consumed_at=$2,consumed_opening_id=$3
          WHERE id=$1 AND status='available'`,
        [entitlement.id, now, openingId],
      );
      await client.query(
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'loot_entitlement',$2,'loot.entitlement.consumed',$3::jsonb)`,
        [randomUUID(), entitlement.id, JSON.stringify({ playerId: command.playerId, openingId, consumedAt: now.toISOString() })],
      );
      await client.query(
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'loot',$2,'loot.opened',$3::jsonb)`,
        [randomUUID(), openingId, JSON.stringify({
          playerId: command.playerId,
          entitlementId: entitlement.id,
          source: entitlement.source,
          referenceId: entitlement.reference_id,
          metadata: entitlement.metadata,
          result,
        })],
      );

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async expireDue(now = new Date(), limit = 100): Promise<number> {
    assertLootDate(now, "now");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RangeError("limit must be a safe integer between 1 and 1000");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const due = await client.query<{ id: string; player_id: string }>(
        `SELECT id,player_id FROM loot_entitlements
          WHERE status='available' AND expires_at <= $1
          ORDER BY expires_at,id
          FOR UPDATE SKIP LOCKED
          LIMIT $2`,
        [now, limit],
      );
      for (const row of due.rows) {
        await client.query("UPDATE loot_entitlements SET status='expired' WHERE id=$1", [row.id]);
        await client.query(
          `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
           VALUES ($1,'loot_entitlement',$2,'loot.entitlement.expired',$3::jsonb)`,
          [randomUUID(), row.id, JSON.stringify({ playerId: row.player_id, expiredAt: now.toISOString() })],
        );
      }
      await client.query("COMMIT");
      return due.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

async function readEntitlementReplay(
  client: PoolClient,
  playerId: string,
  idempotencyKey: string,
  requestHash: Buffer,
): Promise<LootEntitlementResult | null> {
  const replay = await client.query<EntitlementReplayRow>(
    `SELECT request_hash,result FROM loot_entitlements
      WHERE player_id=$1 AND idempotency_key=$2`,
    [playerId, idempotencyKey],
  );
  return entitlementReplayResult(replay.rows[0], requestHash, "idempotency");
}

async function readEntitlementSourceReplay(
  client: PoolClient,
  playerId: string,
  source: string,
  referenceId: string,
  requestHash: Buffer,
): Promise<LootEntitlementResult | null> {
  const replay = await client.query<EntitlementReplayRow>(
    `SELECT request_hash,result FROM loot_entitlements
      WHERE player_id=$1 AND source=$2 AND reference_id=$3`,
    [playerId, source, referenceId],
  );
  return entitlementReplayResult(replay.rows[0], requestHash, "source");
}

function entitlementReplayResult(
  row: EntitlementReplayRow | undefined,
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

async function readOpeningReplay(
  client: PoolClient,
  command: OpenLootCommand,
  requestHash: Buffer,
): Promise<LootOpeningResult | null> {
  const opening = await client.query<LootOpeningRow>(
    `SELECT request_hash,result FROM loot_openings
      WHERE player_id=$1 AND idempotency_key=$2`,
    [command.playerId, command.idempotencyKey],
  );
  const row = opening.rows[0];
  if (!row) return null;
  if (row.request_hash.length !== requestHash.length || !timingSafeEqual(row.request_hash, requestHash)) {
    throw new LootIdempotencyConflictError();
  }
  return { ...row.result, replayed: true };
}

async function loadActiveTableRow(client: PoolClient, tableId: string, now: Date): Promise<LootTableRow> {
  const result = await client.query<LootTableRow>(
    `SELECT table_id,version,pity_group,pity_after,published_at
       FROM loot_table_versions
      WHERE table_id=$1 AND active=true AND published_at IS NOT NULL AND published_at <= $2
      FOR SHARE`,
    [tableId, now],
  );
  const row = result.rows[0];
  if (!row) throw new LootEntitlementTableNotFoundError();
  return row;
}

async function loadEntitledTable(client: PoolClient, entitlement: EntitlementRow): Promise<LootTable> {
  const tableResult = await client.query<LootTableRow>(
    `SELECT table_id,version,pity_group,pity_after,published_at
       FROM loot_table_versions
      WHERE table_id=$1 AND version=$2 AND published_at IS NOT NULL AND published_at <= $3
      FOR SHARE`,
    [entitlement.table_id, entitlement.table_version, entitlement.issued_at],
  );
  const tableRow = tableResult.rows[0];
  if (!tableRow) throw new LootTableNotFoundError();
  const entries = await client.query<LootEntryRow>(
    `SELECT entry_id,item_id,item_version,entry_kind,weight,min_quantity,max_quantity,pity_eligible
       FROM loot_table_entries
      WHERE table_id=$1 AND table_version=$2
      ORDER BY entry_kind,entry_id`,
    [tableRow.table_id, tableRow.version],
  );
  return {
    tableId: tableRow.table_id,
    version: tableRow.version,
    pityGroup: tableRow.pity_group,
    pityAfter: tableRow.pity_after,
    entries: entries.rows.map(rowToEntry),
  };
}

function rowToEntry(row: LootEntryRow): LootEntry {
  return {
    entryId: row.entry_id,
    itemId: row.item_id,
    itemVersion: row.item_version,
    kind: row.entry_kind,
    weight: toSafeNonNegativeInteger(row.weight, "loot weight"),
    minQuantity: toPositiveSafeInteger(row.min_quantity, "minimum loot quantity"),
    maxQuantity: toPositiveSafeInteger(row.max_quantity, "maximum loot quantity"),
    pityEligible: row.pity_eligible,
  };
}

function toSafeNonNegativeInteger(value: string | number, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return parsed;
}

function toPositiveSafeInteger(value: string | number, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new RangeError(`${name} must be a positive safe integer`);
  return parsed;
}

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}
