import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import { evaluateLootTable, type LootEntry, type LootTable } from "./loot-engine.js";
import {
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

interface PityRow {
  readonly misses: number;
}

export type LootSeedFactory = () => Buffer;

/**
 * Coordinates loot evidence, pity state, inventory grants, ledgers, and outbox
 * messages in one PostgreSQL transaction.
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

  public async open(command: OpenLootCommand, now = new Date()): Promise<LootOpeningResult> {
    validateOpenLootCommand(command);
    assertValidDate(now, "now");
    const requestHash = lootOpeningRequestHash(command);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new LootPlayerNotFoundError();

      const replay = await readReplay(client, command, requestHash);
      if (replay !== null) {
        await client.query("COMMIT");
        return replay;
      }

      const table = await loadActiveTable(client, command.tableId, now);
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
            lootTableId: table.tableId,
            lootTableVersion: table.version,
            lootEntryId: reward.entryId,
            seedCommitment: evaluation.proof.seedCommitment,
            commandSource: command.source,
            commandReferenceId: command.referenceId,
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
        tableId: table.tableId,
        tableVersion: table.version,
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
           (id,player_id,idempotency_key,request_hash,table_id,table_version,pity_group,
            pity_before,pity_after,forced_pity,proof_version,server_seed,seed_commitment,draws,result,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16)`,
        [openingId, command.playerId, command.idempotencyKey, requestHash,
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
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'loot',$2,'loot.opened',$3::jsonb)`,
        [randomUUID(), openingId, JSON.stringify({
          playerId: command.playerId,
          source: command.source,
          referenceId: command.referenceId,
          metadata: command.metadata ?? {},
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
}

async function readReplay(
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

async function loadActiveTable(client: PoolClient, tableId: string, now: Date): Promise<LootTable> {
  const tableResult = await client.query<LootTableRow>(
    `SELECT table_id,version,pity_group,pity_after
       FROM loot_table_versions
      WHERE table_id=$1 AND active=true AND published_at IS NOT NULL AND published_at <= $2
      FOR SHARE`,
    [tableId, now],
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
    weight: toPositiveSafeInteger(row.weight, "loot weight"),
    minQuantity: toPositiveSafeInteger(row.min_quantity, "minimum loot quantity"),
    maxQuantity: toPositiveSafeInteger(row.max_quantity, "maximum loot quantity"),
    pityEligible: row.pity_eligible,
  };
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

function assertValidDate(value: Date, name: string): void {
  if (!Number.isFinite(value.getTime())) throw new RangeError(`${name} must be a valid date`);
}
