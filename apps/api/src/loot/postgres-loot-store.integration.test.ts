import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InventoryItemNotFoundError } from "../inventory/inventory.js";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import {
  LootEntitlementIdempotencyConflictError,
  LootEntitlementSourceConflictError,
  type IssueLootEntitlementCommand,
} from "./loot-entitlement.js";
import {
  LootEntitlementExpiredError,
  LootEntitlementNotAvailableError,
  LootIdempotencyConflictError,
} from "./loot-opening.js";
import { PostgresLootStore } from "./postgres-loot-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;
const fixedSeed = Buffer.alloc(32);

databaseSuite("PostgresLootStore entitlement integration", () => {
  const schema = `loot_entitlement_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const inventory = new PostgresInventoryStore(pool);
  const store = new PostgresLootStore(pool, inventory, () => Buffer.from(fixedSeed));
  const playerId = randomUUID();
  const concurrentPlayerId = randomUUID();
  const failurePlayerId = randomUUID();
  const expiryPlayerId = randomUUID();
  const versionPlayerId = randomUUID();
  const now = new Date("2026-07-24T12:00:00.000Z");

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      for (const migration of [
        "001_core.sql",
        "036_inventory_ledger_v1.sql",
        "037_loot_openings_v1.sql",
        "041_loot_entitlements_v1.sql",
        "042_loot_entitlement_invariants.sql",
      ]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query(
        "INSERT INTO players (id) VALUES ($1),($2),($3),($4),($5)",
        [playerId, concurrentPlayerId, failurePlayerId, expiryPlayerId, versionPlayerId],
      );
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
           ('overflow-chest',1,'overflow-test',NULL,true,'2026-07-01T00:00:00Z'),
           ('versioned-chest',1,'version-test',NULL,true,'2026-07-01T00:00:00Z')`,
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
           ('overflow-chest',1,'overflow-b','bronze-key',1,'weighted',9007199254740991,1,1,false),
           ('versioned-chest',1,'version-one','bronze-key',1,'weighted',1,1,1,false)`,
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

  it("issues idempotently and deduplicates the authoritative source reference", async () => {
    const command = issueCommand(playerId, "issue:1", "reward:1");
    const first = await store.issue(command, now);
    const replay = await store.issue(command, new Date(now.getTime() + 1_000));
    const sourceReplay = await store.issue({ ...command, idempotencyKey: "issue:source-retry" }, now);

    expect(first).toMatchObject({
      tableId: "starter-chest",
      tableVersion: 1,
      source: "achievement",
      referenceId: "reward:1",
      status: "available",
      replayed: false,
    });
    expect(replay).toEqual({ ...first, replayed: true });
    expect(sourceReplay).toEqual({ ...first, replayed: true });
    await expect(store.issue({ ...command, referenceId: "reward:other" }, now))
      .rejects.toBeInstanceOf(LootEntitlementIdempotencyConflictError);
    await expect(store.issue({ ...command, idempotencyKey: "issue:other", tableId: "inactive-chest" }, now))
      .rejects.toBeInstanceOf(LootEntitlementSourceConflictError);

    const entitlements = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_entitlements WHERE player_id=$1",
      [playerId],
    );
    expect(entitlements.rows[0]?.count).toBe("1");
  });

  it("consumes each entitlement once while preserving pity and atomic inventory grants", async () => {
    const firstEntitlement = await store.issue(issueCommand(playerId, "issue:open:1", "reward:open:1"), now);
    const firstCommand = openCommand(playerId, "open:1", firstEntitlement.entitlementId);
    const first = await store.open(firstCommand, now);
    const replay = await store.open(firstCommand, new Date(now.getTime() + 1_000));

    expect(first).toMatchObject({
      entitlementId: firstEntitlement.entitlementId,
      tableId: "starter-chest",
      tableVersion: 1,
      source: "achievement",
      referenceId: "reward:open:1",
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
    await expect(store.open({ ...firstCommand, idempotencyKey: "open:new-key" }, now))
      .rejects.toBeInstanceOf(LootEntitlementNotAvailableError);
    await expect(store.open({ ...firstCommand, entitlementId: randomUUID() }, now))
      .rejects.toBeInstanceOf(LootIdempotencyConflictError);

    const secondEntitlement = await store.issue(issueCommand(playerId, "issue:open:2", "reward:open:2"), now);
    const second = await store.open(openCommand(playerId, "open:2", secondEntitlement.entitlementId), now);
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
    const consumed = await pool.query<{ status: string; consumed_opening_id: string | null }>(
      "SELECT status,consumed_opening_id FROM loot_entitlements WHERE id=$1",
      [firstEntitlement.entitlementId],
    );
    expect(consumed.rows[0]).toMatchObject({ status: "consumed", consumed_opening_id: first.openingId });
  });

  it("serializes concurrent opening retries without duplicate rewards", async () => {
    const entitlement = await store.issue(
      issueCommand(concurrentPlayerId, "issue:concurrent", "reward:concurrent"), now,
    );
    const command = openCommand(concurrentPlayerId, "open:concurrent", entitlement.entitlementId);
    const results = await Promise.all([store.open(command, now), store.open(command, now)]);

    expect(new Set(results.map((result) => result.openingId)).size).toBe(1);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect((await inventory.list(concurrentPlayerId, now)).map((stack) => stack.quantity)).toEqual([1, 2]);
    const openings = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_openings WHERE player_id=$1",
      [concurrentPlayerId],
    );
    expect(openings.rows[0]?.count).toBe("1");
  });

  it("keeps a failed entitlement available and rolls back pity, inventory, ledger, and opening evidence", async () => {
    const inactive = await store.issue({
      ...issueCommand(failurePlayerId, "issue:inactive", "reward:inactive"),
      tableId: "inactive-chest",
    }, now);
    const overflow = await store.issue({
      ...issueCommand(failurePlayerId, "issue:overflow", "reward:overflow"),
      tableId: "overflow-chest",
    }, now);

    await expect(store.open(openCommand(failurePlayerId, "open:inactive", inactive.entitlementId), now))
      .rejects.toBeInstanceOf(InventoryItemNotFoundError);
    await expect(store.open(openCommand(failurePlayerId, "open:overflow", overflow.entitlementId), now))
      .rejects.toThrow(RangeError);

    const failedOpenings = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_openings WHERE player_id=$1",
      [failurePlayerId],
    );
    const failedInventory = await pool.query<{ count: string }>(
      "SELECT count(*) FROM inventory_operations WHERE player_id=$1",
      [failurePlayerId],
    );
    const failedPity = await pool.query<{ count: string }>(
      "SELECT count(*) FROM loot_pity_states WHERE player_id=$1",
      [failurePlayerId],
    );
    const statuses = await pool.query<{ status: string }>(
      "SELECT status FROM loot_entitlements WHERE player_id=$1 ORDER BY reference_id",
      [failurePlayerId],
    );
    expect(failedOpenings.rows[0]?.count).toBe("0");
    expect(failedInventory.rows[0]?.count).toBe("0");
    expect(failedPity.rows[0]?.count).toBe("0");
    expect(statuses.rows).toEqual([{ status: "available" }, { status: "available" }]);
  });

  it("rejects expired openings and expires due entitlements through the cleanup path", async () => {
    const entitlement = await store.issue({
      ...issueCommand(expiryPlayerId, "issue:expiry", "reward:expiry"),
      expiresAt: new Date("2026-07-24T12:01:00.000Z"),
    }, now);
    const afterExpiry = new Date("2026-07-24T12:02:00.000Z");
    await expect(store.open(openCommand(expiryPlayerId, "open:expiry", entitlement.entitlementId), afterExpiry))
      .rejects.toBeInstanceOf(LootEntitlementExpiredError);
    expect(await store.expireDue(afterExpiry, 100)).toBe(1);

    const row = await pool.query<{ status: string }>("SELECT status FROM loot_entitlements WHERE id=$1", [entitlement.entitlementId]);
    expect(row.rows[0]?.status).toBe("expired");
    await expect(store.open(openCommand(expiryPlayerId, "open:expiry:retry", entitlement.entitlementId), afterExpiry))
      .rejects.toBeInstanceOf(LootEntitlementExpiredError);
  });

  it("opens the exact issued table version even after publication moves to a newer version", async () => {
    const entitlement = await store.issue({
      ...issueCommand(versionPlayerId, "issue:version", "reward:version"),
      tableId: "versioned-chest",
    }, now);
    await pool.query("UPDATE loot_table_versions SET active=false WHERE table_id='versioned-chest' AND version=1");
    await pool.query(
      `INSERT INTO loot_table_versions (table_id,version,pity_group,pity_after,active,published_at)
       VALUES ('versioned-chest',2,'version-test',NULL,true,'2026-07-24T12:00:30Z')`,
    );
    await pool.query(
      `INSERT INTO loot_table_entries
         (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,min_quantity,max_quantity,pity_eligible)
       VALUES ('versioned-chest',2,'version-two','gold-avatar',1,'weighted',1,1,1,false)`,
    );

    const opened = await store.open(
      openCommand(versionPlayerId, "open:version", entitlement.entitlementId),
      new Date("2026-07-24T12:01:00.000Z"),
    );
    expect(opened).toMatchObject({ tableId: "versioned-chest", tableVersion: 1 });
    expect(opened.rewards).toEqual([
      expect.objectContaining({ entryId: "version-one", itemId: "bronze-key" }),
    ]);
  });

  it("keeps entitlement, opening, inventory, and outbox evidence consistent", async () => {
    const invalidInventoryLedger = await pool.query<{ count: string }>(
      "SELECT count(*) FROM inventory_ledger WHERE quantity_after <> quantity_before + delta",
    );
    const consumedMismatch = await pool.query<{ count: string }>(
      `SELECT count(*)
         FROM loot_entitlements entitlement
         LEFT JOIN loot_openings opening ON opening.id=entitlement.consumed_opening_id
        WHERE entitlement.status='consumed'
          AND (opening.id IS NULL OR opening.entitlement_id<>entitlement.id)`,
    );
    const duplicateUse = await pool.query<{ count: string }>(
      `SELECT count(*) FROM (
         SELECT entitlement_id FROM loot_openings WHERE entitlement_id IS NOT NULL
         GROUP BY entitlement_id HAVING count(*) > 1
       ) duplicate`,
    );
    const rawSeeds = await pool.query<{ server_seed: Buffer; result: Record<string, unknown> }>(
      "SELECT server_seed,result FROM loot_openings ORDER BY created_at,id",
    );
    const eventTypes = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type,count(*)::text AS count
         FROM outbox_events
        WHERE aggregate_type IN ('inventory','loot','loot_entitlement')
        GROUP BY event_type
        ORDER BY event_type`,
    );

    expect(invalidInventoryLedger.rows[0]?.count).toBe("0");
    expect(consumedMismatch.rows[0]?.count).toBe("0");
    expect(duplicateUse.rows[0]?.count).toBe("0");
    for (const opening of rawSeeds.rows) {
      expect(opening.server_seed.equals(fixedSeed)).toBe(true);
      expect(JSON.stringify(opening.result)).not.toContain("serverSeed");
    }
    expect(eventTypes.rows).toEqual([
      { event_type: "inventory.granted", count: "7" },
      { event_type: "loot.entitlement.consumed", count: "4" },
      { event_type: "loot.entitlement.expired", count: "1" },
      { event_type: "loot.entitlement.issued", count: "8" },
      { event_type: "loot.opened", count: "4" },
    ]);
  });

  function issueCommand(
    targetPlayerId: string,
    idempotencyKey: string,
    referenceId: string,
  ): IssueLootEntitlementCommand {
    return {
      playerId: targetPlayerId,
      idempotencyKey,
      tableId: "starter-chest",
      source: "achievement",
      referenceId,
      expiresAt: new Date("2026-07-25T12:00:00.000Z"),
      metadata: { achievementVersion: 1 },
    };
  }

  function openCommand(targetPlayerId: string, idempotencyKey: string, entitlementId: string) {
    return { playerId: targetPlayerId, idempotencyKey, entitlementId } as const;
  }
});
