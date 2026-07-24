import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InventoryItemNotFoundError } from "../inventory/inventory.js";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import { LootIdempotencyConflictError } from "./loot-opening.js";
import { PostgresLootStore } from "./postgres-loot-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;
const fixedSeed = Buffer.alloc(32);

databaseSuite("PostgresLootStore integration", () => {
  const schema = `loot_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const inventory = new PostgresInventoryStore(pool);
  const store = new PostgresLootStore(pool, inventory, () => Buffer.from(fixedSeed));
  const playerId = randomUUID();
  const concurrentPlayerId = randomUUID();
  const now = new Date("2026-07-24T12:00:00.000Z");

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      for (const migration of ["001_core.sql", "036_inventory_ledger_v1.sql", "037_loot_openings_v1.sql"]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query("INSERT INTO players (id) VALUES ($1),($2)", [playerId, concurrentPlayerId]);
      await client.query(
        `INSERT INTO inventory_item_definitions
           (item_id,version,category,rarity,max_stack,tradable,active,metadata)
         VALUES
           ('bronze-key',1,'key','common',10,false,true,'{}'),
           ('spin-booster',1,'booster','common',10,false,true,'{}'),
           ('gold-avatar',1,'cosmetic','legendary',1,false,true,'{}'),
           ('inactive-reward',1,'collectible','epic',1,false,false,'{}')`,
      );
      await client.query(
        `INSERT INTO loot_table_versions
           (table_id,version,pity_group,pity_after,active,published_at)
         VALUES
           ('starter-chest',1,'starter-avatar',2,true,'2026-07-01T00:00:00Z'),
           ('inactive-chest',1,'inactive-test',NULL,true,'2026-07-01T00:00:00Z'),
           ('overflow-chest',1,'overflow-test',NULL,true,'2026-07-01T00:00:00Z')`,
      );
      await client.query(
        `INSERT INTO loot_table_entries
           (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,min_quantity,max_quantity,pity_eligible)
         VALUES
           ('starter-chest',1,'guaranteed-key','bronze-key',1,'guaranteed',0,1,1,false),
           ('starter-chest',1,'common-booster','spin-booster',1,'weighted',99,2,2,false),
           ('starter-chest',1,'rare-avatar','gold-avatar',1,'weighted',1,1,1,true),
           ('inactive-chest',1,'inactive','inactive-reward',1,'weighted',1,1,1,false),
           ('overflow-chest',1,'overflow-a','spin-booster',1,'weighted',9007199254740991,1,1,false),
           ('overflow-chest',1,'overflow-b','bronze-key',1,'weighted',9007199254740991,1,1,false)`,
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  });

  it("persists misses, forces pity, and grants every reward atomically", async () => {
    const firstCommand = command(playerId, "open:1", "chest-instance:1");
    const first = await store.open(firstCommand, now);
    const replay = await store.open(firstCommand, new Date(now.getTime() + 1_000));

    expect(first).toMatchObject({
      tableId: "starter-chest",
      tableVersion: 1,
      pityBefore: 0,
      pityAfter: 1,
      forcedPity: false,
      replayed: false,
    });
    expect(first.rewards).toEqual([
      expect.objectContaining({ entryId: "guaranteed-key", itemId: "bronze-key", quantity: 1 }),
      expect.objectContaining({ entryId: "common-booster", itemId: "spin-booster", quantity: 2 }),
    ]);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(store.open({ ...firstCommand, referenceId: "different-instance" }, now))
      .rejects.toBeInstanceOf(LootIdempotencyConflictError);

    const second = await store.open(command(playerId, "open:2", "chest-instance:2"), now);
    expect(second).toMatchObject({ pityBefore: 1, pityAfter: 0, forcedPity: true });
    expect(second.rewards).toEqual([
      expect.objectContaining({ entryId: "guaranteed-key", itemId: "bronze-key", quantity: 1 }),
      expect.objectContaining({ entryId: "rare-avatar", itemId: "gold-avatar", quantity: 1 }),
    ]);

    expect((await inventory.list(playerId, now)).map((stack) => ({ itemId: stack.itemId, quantity: stack.quantity })))
      .toEqual([
        { itemId: "bronze-key", quantity: 2 },
        { itemId: "gold-avatar", quantity: 1 },
        { itemId: "spin-booster", quantity: 2 },
      ]);
    const pity = await pool.query<{ misses: number }>(
      "SELECT misses FROM loot_pity_states WHERE player_id=$1 AND pity_group='starter-avatar'",
      [playerId],
    );
    expect(pity.rows[0]?.misses).toBe(0);
  });

  it("serializes concurrent idempotent openings without duplicate rewards", async () => {
    const concurrentCommand = command(concurrentPlayerId, "concurrent:1", "concurrent-chest:1");
    const results = await Promise.all([
      store.open(concurrentCommand, now),
      store.open(concurrentCommand, now),
    ]);

    expect(new Set(results.map((result) => result.openingId)).size).toBe(1);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect((await inventory.list(concurrentPlayerId, now)).map((stack) => stack.quantity)).toEqual([1, 2]);
    const openings = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_openings WHERE player_id=$1",
      [concurrentPlayerId],
    );
    expect(openings.rows[0]?.count).toBe("1");
  });

  it("rolls back opening, pity, inventory, ledger, and outbox on invalid rewards or weights", async () => {
    await expect(store.open({
      ...command(playerId, "inactive:1", "inactive-instance:1"),
      tableId: "inactive-chest",
    }, now)).rejects.toBeInstanceOf(InventoryItemNotFoundError);
    await expect(store.open({
      ...command(playerId, "overflow:1", "overflow-instance:1"),
      tableId: "overflow-chest",
    }, now)).rejects.toThrow(RangeError);

    const failedOpenings = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_openings WHERE idempotency_key IN ('inactive:1','overflow:1')",
    );
    const failedInventory = await pool.query<{ count: string }>(
      "SELECT count(*) FROM inventory_operations WHERE idempotency_key LIKE 'loot:%' AND player_id=$1",
      [playerId],
    );
    const failedPity = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_pity_states WHERE player_id=$1 AND pity_group IN ('inactive-test','overflow-test')",
      [playerId],
    );
    expect(failedOpenings.rows[0]?.count).toBe("0");
    expect(failedInventory.rows[0]?.count).toBe("4");
    expect(failedPity.rows[0]?.count).toBe("0");
  });

  it("stores reproducible server evidence without exposing the raw seed in results", async () => {
    const openings = await pool.query<{
      id: string;
      server_seed: Buffer;
      seed_commitment: Buffer;
      result: Record<string, unknown>;
    }>(
      "SELECT id,server_seed,seed_commitment,result FROM loot_openings ORDER BY created_at,id",
    );
    expect(openings.rows).toHaveLength(3);
    for (const opening of openings.rows) {
      expect(opening.server_seed.equals(fixedSeed)).toBe(true);
      expect(opening.seed_commitment).toHaveLength(32);
      expect(JSON.stringify(opening.result)).not.toContain("serverSeed");
    }

    const rewards = await pool.query<{ count: string }>("SELECT count(*) FROM loot_opening_rewards");
    const invalidLedger = await pool.query<{ count: string }>(
      "SELECT count(*) FROM inventory_ledger WHERE quantity_after <> quantity_before + delta",
    );
    const eventTypes = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type,count(*)::text AS count
         FROM outbox_events
        WHERE aggregate_type IN ('inventory','loot')
        GROUP BY event_type
        ORDER BY event_type`,
    );
    expect(rewards.rows[0]?.count).toBe("6");
    expect(invalidLedger.rows[0]?.count).toBe("0");
    expect(eventTypes.rows).toEqual([
      { event_type: "inventory.granted", count: "6" },
      { event_type: "loot.opened", count: "3" },
    ]);
  });

  function command(targetPlayerId: string, idempotencyKey: string, referenceId: string) {
    return {
      playerId: targetPlayerId,
      idempotencyKey,
      tableId: "starter-chest",
      source: "chest",
      referenceId,
      metadata: { chestLevel: 1 },
    } as const;
  }
});
