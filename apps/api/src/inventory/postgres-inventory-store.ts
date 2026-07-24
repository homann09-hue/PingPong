import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  InventoryIdempotencyConflictError,
  InventoryInsufficientQuantityError,
  InventoryItemNotFoundError,
  inventoryRequestHash,
  validateInventoryMutation,
  type ConsumeInventoryCommand,
  type GrantInventoryCommand,
  type InventoryMutationCommand,
  type InventoryMutationResult,
  type InventoryStackView,
} from "./inventory.js";

interface StackRow {
  readonly id: string;
  readonly item_id: string;
  readonly item_version: number;
  readonly quantity: string;
  readonly max_stack: string;
  readonly stack_index: number;
  readonly expires_at: Date | null;
  readonly event_id: string | null;
  readonly acquired_at: Date;
  readonly updated_at: Date;
}

interface DefinitionRow {
  readonly max_stack: string;
}

interface OperationRow {
  readonly request_hash: Buffer;
  readonly result: InventoryMutationResult;
}

interface QuantityRow {
  readonly quantity: string;
}

export class InventoryPlayerNotFoundError extends Error {
  public constructor() {
    super("Inventory player was not found");
    this.name = "InventoryPlayerNotFoundError";
  }
}

/** PostgreSQL-backed inventory mutations. Clients never author stack or ledger rows directly. */
export class PostgresInventoryStore {
  public constructor(private readonly pool: Pool) {}

  public async list(playerId: string, now = new Date()): Promise<readonly InventoryStackView[]> {
    assertValidDate(now, "now");
    const result = await this.pool.query<StackRow>(
      `SELECT id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at
         FROM inventory_stacks
        WHERE player_id=$1 AND (expires_at IS NULL OR expires_at > $2)
        ORDER BY item_id,item_version,expires_at NULLS LAST,stack_index`,
      [playerId, now],
    );
    return result.rows.map(rowToStack);
  }

  public async grant(command: GrantInventoryCommand, now = new Date()): Promise<InventoryMutationResult> {
    validateInventoryMutation(command);
    assertValidDate(now, "now");
    if (command.expiresAt !== null && command.expiresAt.getTime() <= now.getTime()) {
      throw new RangeError("expiresAt must be later than the inventory grant time");
    }
    return this.mutate(command, now);
  }

  public async consume(command: ConsumeInventoryCommand, now = new Date()): Promise<InventoryMutationResult> {
    validateInventoryMutation(command);
    assertValidDate(now, "now");
    return this.mutate(command, now);
  }

  /** Server-only cleanup path. Expired stacks are removed and audited in the same transaction. */
  public async expireDue(now = new Date(), limit = 100): Promise<number> {
    assertValidDate(now, "now");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RangeError("limit must be a safe integer between 1 and 1000");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const due = await client.query<StackRow & { readonly player_id: string }>(
        `SELECT id,player_id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at
           FROM inventory_stacks
          WHERE expires_at IS NOT NULL AND expires_at <= $1
          ORDER BY expires_at,id
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [now, limit],
      );

      for (const [sequence, row] of due.rows.entries()) {
        const operationId = randomUUID();
        const expiresAt = row.expires_at;
        if (expiresAt === null) throw new Error("Locked expiry row has no expiration timestamp");
        const idempotencyKey = `expire:${row.id}:${expiresAt.toISOString()}`;
        const requestHash = createHash("sha256")
          .update(`${row.player_id}|${row.id}|${row.quantity}|${expiresAt.toISOString()}`)
          .digest();
        const result = {
          operationId,
          operationType: "expire",
          itemId: row.item_id,
          itemVersion: row.item_version,
          quantity: toSafeInteger(row.quantity, "expired quantity"),
          remainingQuantity: 0,
          changedStacks: [{ ...rowToStack(row), quantity: 0 }],
          replayed: false,
        } as const;

        await client.query(
          `INSERT INTO inventory_operations
             (id,player_id,idempotency_key,operation_type,request_hash,result)
           VALUES ($1,$2,$3,'expire',$4,$5::jsonb)`,
          [operationId, row.player_id, idempotencyKey, requestHash, JSON.stringify(result)],
        );
        await insertLedger(client, {
          operationId,
          sequence,
          playerId: row.player_id,
          stackId: row.id,
          itemId: row.item_id,
          itemVersion: row.item_version,
          delta: -result.quantity,
          quantityBefore: result.quantity,
          quantityAfter: 0,
          reason: "expired",
          source: "inventory_cleanup",
          referenceId: row.id,
          metadata: { expiresAt: expiresAt.toISOString() },
        });
        await client.query("DELETE FROM inventory_stacks WHERE id=$1", [row.id]);
        await insertOutbox(client, operationId, row.player_id, "inventory.expired", result);
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

  private async mutate(command: InventoryMutationCommand, now: Date): Promise<InventoryMutationResult> {
    const requestHash = inventoryRequestHash(command);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new InventoryPlayerNotFoundError();

      const replay = await readReplay(client, command, requestHash);
      if (replay !== null) {
        await client.query("COMMIT");
        return replay;
      }

      const result = command.operationType === "grant"
        ? await this.applyGrant(client, command, requestHash, now)
        : await this.applyConsume(client, command, requestHash, now);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyGrant(
    client: PoolClient,
    command: GrantInventoryCommand,
    requestHash: Buffer,
    now: Date,
  ): Promise<InventoryMutationResult> {
    const definition = await client.query<DefinitionRow>(
      `SELECT max_stack FROM inventory_item_definitions
        WHERE item_id=$1 AND version=$2 AND active=true
        FOR SHARE`,
      [command.itemId, command.itemVersion],
    );
    const definitionRow = definition.rows[0];
    if (!definitionRow) throw new InventoryItemNotFoundError();
    const maxStack = toSafeInteger(definitionRow.max_stack, "max stack");
    const operationId = randomUUID();
    await insertOperation(client, operationId, command, requestHash);

    const existing = await client.query<StackRow>(
      `SELECT id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at
         FROM inventory_stacks
        WHERE player_id=$1 AND item_id=$2 AND item_version=$3
          AND event_id IS NOT DISTINCT FROM $4
          AND expires_at IS NOT DISTINCT FROM $5
          AND quantity < max_stack
        ORDER BY stack_index
        FOR UPDATE`,
      [command.playerId, command.itemId, command.itemVersion, command.eventId, command.expiresAt],
    );

    let quantityLeft = command.quantity;
    let ledgerSequence = 0;
    const changedStacks: InventoryStackView[] = [];

    for (const row of existing.rows) {
      if (quantityLeft === 0) break;
      const quantityBefore = toSafeInteger(row.quantity, "stack quantity");
      const rowMaxStack = toSafeInteger(row.max_stack, "stack max quantity");
      const delta = Math.min(quantityLeft, rowMaxStack - quantityBefore);
      if (delta <= 0) continue;
      const updated = await client.query<StackRow>(
        `UPDATE inventory_stacks
            SET quantity=quantity+$2,version=version+1,updated_at=$3
          WHERE id=$1
          RETURNING id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at`,
        [row.id, delta, now],
      );
      const updatedRow = updated.rows[0];
      if (!updatedRow) throw new Error("Inventory stack update did not return a row");
      await insertLedger(client, mutationLedger(command, operationId, ledgerSequence, row.id,
        quantityBefore, quantityBefore + delta, delta));
      ledgerSequence += 1;
      quantityLeft -= delta;
      changedStacks.push(rowToStack(updatedRow));
    }

    const nextIndexResult = await client.query<{ readonly next_index: number }>(
      `SELECT COALESCE(max(stack_index),-1)+1 AS next_index
         FROM inventory_stacks
        WHERE player_id=$1 AND item_id=$2 AND item_version=$3
          AND event_id IS NOT DISTINCT FROM $4
          AND expires_at IS NOT DISTINCT FROM $5`,
      [command.playerId, command.itemId, command.itemVersion, command.eventId, command.expiresAt],
    );
    let nextIndex = nextIndexResult.rows[0]?.next_index ?? 0;

    while (quantityLeft > 0) {
      const stackQuantity = Math.min(quantityLeft, maxStack);
      const stackId = randomUUID();
      const inserted = await client.query<StackRow>(
        `INSERT INTO inventory_stacks
           (id,player_id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         RETURNING id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at`,
        [stackId, command.playerId, command.itemId, command.itemVersion, stackQuantity, maxStack,
          nextIndex, command.expiresAt, command.eventId, now],
      );
      const insertedRow = inserted.rows[0];
      if (!insertedRow) throw new Error("Inventory stack insert did not return a row");
      await insertLedger(client, mutationLedger(command, operationId, ledgerSequence, stackId,
        0, stackQuantity, stackQuantity));
      ledgerSequence += 1;
      nextIndex += 1;
      quantityLeft -= stackQuantity;
      changedStacks.push(rowToStack(insertedRow));
    }

    return finalizeMutation(client, command, requestHash, operationId, changedStacks, now);
  }

  private async applyConsume(
    client: PoolClient,
    command: ConsumeInventoryCommand,
    requestHash: Buffer,
    now: Date,
  ): Promise<InventoryMutationResult> {
    const definition = await client.query(
      `SELECT 1 FROM inventory_item_definitions
        WHERE item_id=$1 AND version=$2
        FOR SHARE`,
      [command.itemId, command.itemVersion],
    );
    if (definition.rowCount !== 1) throw new InventoryItemNotFoundError();

    const available = await client.query<StackRow>(
      `SELECT id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at
         FROM inventory_stacks
        WHERE player_id=$1 AND item_id=$2 AND item_version=$3
          AND event_id IS NOT DISTINCT FROM $4
          AND (expires_at IS NULL OR expires_at > $5)
        ORDER BY expires_at ASC NULLS LAST,acquired_at,stack_index
        FOR UPDATE`,
      [command.playerId, command.itemId, command.itemVersion, command.eventId, now],
    );
    const totalAvailable = available.rows.reduce(
      (total, row) => checkedAdd(total, toSafeInteger(row.quantity, "stack quantity"), "available inventory"),
      0,
    );
    if (totalAvailable < command.quantity) throw new InventoryInsufficientQuantityError();

    const operationId = randomUUID();
    await insertOperation(client, operationId, command, requestHash);
    let quantityLeft = command.quantity;
    let ledgerSequence = 0;
    const changedStacks: InventoryStackView[] = [];

    for (const row of available.rows) {
      if (quantityLeft === 0) break;
      const quantityBefore = toSafeInteger(row.quantity, "stack quantity");
      const consumed = Math.min(quantityLeft, quantityBefore);
      const quantityAfter = quantityBefore - consumed;
      if (quantityAfter === 0) {
        await client.query("DELETE FROM inventory_stacks WHERE id=$1", [row.id]);
        changedStacks.push({ ...rowToStack(row), quantity: 0, updatedAt: now.toISOString() });
      } else {
        const updated = await client.query<StackRow>(
          `UPDATE inventory_stacks
              SET quantity=$2,version=version+1,updated_at=$3
            WHERE id=$1
            RETURNING id,item_id,item_version,quantity,max_stack,stack_index,expires_at,event_id,acquired_at,updated_at`,
          [row.id, quantityAfter, now],
        );
        const updatedRow = updated.rows[0];
        if (!updatedRow) throw new Error("Inventory stack update did not return a row");
        changedStacks.push(rowToStack(updatedRow));
      }
      await insertLedger(client, mutationLedger(command, operationId, ledgerSequence, row.id,
        quantityBefore, quantityAfter, -consumed));
      ledgerSequence += 1;
      quantityLeft -= consumed;
    }

    return finalizeMutation(client, command, requestHash, operationId, changedStacks, now);
  }
}

async function readReplay(
  client: PoolClient,
  command: InventoryMutationCommand,
  requestHash: Buffer,
): Promise<InventoryMutationResult | null> {
  const operation = await client.query<OperationRow>(
    `SELECT request_hash,result FROM inventory_operations
      WHERE player_id=$1 AND idempotency_key=$2`,
    [command.playerId, command.idempotencyKey],
  );
  const row = operation.rows[0];
  if (!row) return null;
  if (row.request_hash.length !== requestHash.length || !timingSafeEqual(row.request_hash, requestHash)) {
    throw new InventoryIdempotencyConflictError();
  }
  return { ...row.result, replayed: true };
}

async function insertOperation(
  client: PoolClient,
  operationId: string,
  command: InventoryMutationCommand,
  requestHash: Buffer,
): Promise<void> {
  await client.query(
    `INSERT INTO inventory_operations
       (id,player_id,idempotency_key,operation_type,request_hash,result)
     VALUES ($1,$2,$3,$4,$5,'{}'::jsonb)`,
    [operationId, command.playerId, command.idempotencyKey, command.operationType, requestHash],
  );
}

async function finalizeMutation(
  client: PoolClient,
  command: InventoryMutationCommand,
  requestHash: Buffer,
  operationId: string,
  changedStacks: readonly InventoryStackView[],
  now: Date,
): Promise<InventoryMutationResult> {
  const remaining = await client.query<QuantityRow>(
    `SELECT COALESCE(sum(quantity),0)::text AS quantity
       FROM inventory_stacks
      WHERE player_id=$1 AND item_id=$2 AND item_version=$3
        AND event_id IS NOT DISTINCT FROM $4
        AND (expires_at IS NULL OR expires_at > $5)`,
    [command.playerId, command.itemId, command.itemVersion, command.eventId, now],
  );
  const result: InventoryMutationResult = {
    operationId,
    operationType: command.operationType,
    itemId: command.itemId,
    itemVersion: command.itemVersion,
    quantity: command.quantity,
    remainingQuantity: toSafeInteger(remaining.rows[0]?.quantity ?? "0", "remaining inventory"),
    changedStacks,
    replayed: false,
  };
  const update = await client.query(
    `UPDATE inventory_operations SET result=$2::jsonb
      WHERE id=$1 AND request_hash=$3`,
    [operationId, JSON.stringify(result), requestHash],
  );
  if (update.rowCount !== 1) throw new Error("Inventory operation result could not be finalized");
  const eventType = command.operationType === "grant" ? "inventory.granted" : "inventory.consumed";
  await insertOutbox(client, operationId, command.playerId, eventType, result);
  return result;
}

function mutationLedger(
  command: InventoryMutationCommand,
  operationId: string,
  sequence: number,
  stackId: string,
  quantityBefore: number,
  quantityAfter: number,
  delta: number,
): LedgerInsert {
  return {
    operationId,
    sequence,
    playerId: command.playerId,
    stackId,
    itemId: command.itemId,
    itemVersion: command.itemVersion,
    delta,
    quantityBefore,
    quantityAfter,
    reason: command.reason,
    source: command.source,
    referenceId: command.referenceId,
    metadata: command.metadata ?? {},
  };
}

interface LedgerInsert {
  readonly operationId: string;
  readonly sequence: number;
  readonly playerId: string;
  readonly stackId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly delta: number;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
  readonly reason: string;
  readonly source: string;
  readonly referenceId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

async function insertLedger(client: PoolClient, entry: LedgerInsert): Promise<void> {
  await client.query(
    `INSERT INTO inventory_ledger
       (id,operation_id,sequence,player_id,stack_id,item_id,item_version,delta,quantity_before,quantity_after,
        reason,source,reference_id,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [randomUUID(), entry.operationId, entry.sequence, entry.playerId, entry.stackId, entry.itemId,
      entry.itemVersion, entry.delta, entry.quantityBefore, entry.quantityAfter,
      entry.reason, entry.source, entry.referenceId, JSON.stringify(entry.metadata)],
  );
}

async function insertOutbox(
  client: PoolClient,
  operationId: string,
  playerId: string,
  eventType: string,
  result: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
     VALUES ($1,'inventory',$2,$3,$4::jsonb)`,
    [randomUUID(), operationId, eventType, JSON.stringify({ playerId, result })],
  );
}

function rowToStack(row: StackRow): InventoryStackView {
  return {
    stackId: row.id,
    itemId: row.item_id,
    itemVersion: row.item_version,
    quantity: toSafeInteger(row.quantity, "stack quantity"),
    maxStack: toSafeInteger(row.max_stack, "stack max quantity"),
    stackIndex: row.stack_index,
    expiresAt: row.expires_at?.toISOString() ?? null,
    eventId: row.event_id,
    acquiredAt: row.acquired_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSafeInteger(value: string | number, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new RangeError(`${name} is outside the safe integer range`);
  return parsed;
}

function checkedAdd(left: number, right: number, name: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) throw new RangeError(`${name} exceeds the safe integer range`);
  return result;
}

function assertValidDate(value: Date, name: string): void {
  if (!Number.isFinite(value.getTime())) throw new RangeError(`${name} must be a valid date`);
}
