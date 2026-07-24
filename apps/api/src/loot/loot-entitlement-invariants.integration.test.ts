import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import { PostgresLootStore } from "./postgres-loot-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("loot entitlement database invariants", () => {
  const schema = `loot_entitlement_invariants_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresLootStore(pool, new PostgresInventoryStore(pool), () => Buffer.alloc(32));
  const playerId = randomUUID();
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
      await client.query("INSERT INTO players (id) VALUES ($1)", [playerId]);
      await client.query(
        `INSERT INTO inventory_item_definitions
           (item_id,version,category,rarity,max_stack,tradable,active,metadata)
         VALUES ('audit-key',1,'key','common',10,false,true,'{}')`,
      );
      await client.query(
        `INSERT INTO loot_table_versions
           (table_id,version,pity_group,pity_after,active,published_at)
         VALUES ('audit-chest',1,'audit',NULL,true,'2026-07-01T00:00:00Z')`,
      );
      await client.query(
        `INSERT INTO loot_table_entries
           (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,min_quantity,max_quantity,pity_eligible)
         VALUES ('audit-chest',1,'audit-key','audit-key',1,'weighted',1,1,1,false)`,
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

  it("rejects identity edits and deletion before consumption", async () => {
    const entitlement = await store.issue({
      playerId,
      idempotencyKey: "issue:audit",
      tableId: "audit-chest",
      source: "achievement",
      referenceId: "achievement:audit",
      expiresAt: new Date("2026-07-25T12:00:00.000Z"),
      metadata: { version: 1 },
    }, now);

    await expect(pool.query(
      "UPDATE loot_entitlements SET source='tampered' WHERE id=$1",
      [entitlement.entitlementId],
    )).rejects.toThrow(/identity is immutable/);
    await expect(pool.query(
      "UPDATE loot_entitlements SET expires_at=expires_at + interval '1 day' WHERE id=$1",
      [entitlement.entitlementId],
    )).rejects.toThrow(/identity is immutable/);
    await expect(pool.query(
      "DELETE FROM loot_entitlements WHERE id=$1",
      [entitlement.entitlementId],
    )).rejects.toThrow(/append-only/);

    const row = await pool.query<{ source: string; status: string }>(
      "SELECT source,status FROM loot_entitlements WHERE id=$1",
      [entitlement.entitlementId],
    );
    expect(row.rows[0]).toEqual({ source: "achievement", status: "available" });
  });

  it("allows one consumption transition and rejects terminal-state reversal", async () => {
    const entitlement = await pool.query<{ id: string }>(
      "SELECT id FROM loot_entitlements WHERE player_id=$1 AND reference_id='achievement:audit'",
      [playerId],
    );
    const entitlementId = entitlement.rows[0]!.id;
    const opened = await store.open({
      playerId,
      idempotencyKey: "open:audit",
      entitlementId,
    }, now);
    expect(opened).toMatchObject({ entitlementId, tableId: "audit-chest", tableVersion: 1 });

    await expect(pool.query(
      "UPDATE loot_entitlements SET status='available',consumed_at=NULL,consumed_opening_id=NULL WHERE id=$1",
      [entitlementId],
    )).rejects.toThrow(/terminal loot entitlement status is immutable/);
    await expect(pool.query(
      "DELETE FROM loot_entitlements WHERE id=$1",
      [entitlementId],
    )).rejects.toThrow(/append-only/);

    const row = await pool.query<{ status: string; consumed_opening_id: string }>(
      "SELECT status,consumed_opening_id FROM loot_entitlements WHERE id=$1",
      [entitlementId],
    );
    expect(row.rows[0]).toEqual({ status: "consumed", consumed_opening_id: opened.openingId });
  });
});
