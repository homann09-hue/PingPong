import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresInventoryStore } from "../inventory/postgres-inventory-store.js";
import { LootEntitlementTableNotFoundError } from "../loot/loot-entitlement.js";
import { PostgresLootStore } from "../loot/postgres-loot-store.js";
import { PostgresSpinStore } from "./postgres-spin-store.js";
import { MissionIdempotencyConflictError } from "./spin-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("mission loot reward producer", () => {
  const schema = `mission_loot_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresSpinStore(pool);
  const inventory = new PostgresInventoryStore(pool);
  const lootStore = new PostgresLootStore(pool, inventory, () => Buffer.alloc(32));
  const playerId = "00000000-0000-4000-8000-000000000061";
  const rollbackPlayerId = "00000000-0000-4000-8000-000000000062";
  const now = new Date("2026-07-24T12:00:00.000Z");

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      for (const migration of [
        "001_core.sql",
        "008_missions.sql",
        "009_mission_tiers.sql",
        "024_multi_currency_economy.sql",
        "029_mission_tracks.sql",
        "034_mission_catalog_v3.sql",
        "036_inventory_ledger_v1.sql",
        "037_loot_openings_v1.sql",
        "038_achievement_persistence_v1.sql",
        "039_achievement_immutability.sql",
        "041_loot_entitlements_v1.sql",
        "042_loot_entitlement_invariants.sql",
        "043_achievement_loot_rewards_v1.sql",
        "044_achievement_loot_reward_invariants.sql",
        "045_mission_claims_and_loot_rewards_v1.sql",
        "046_mission_claim_invariants.sql",
      ]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query(
        "INSERT INTO players (id,level,xp,vip_points) VALUES ($1,12,0,0),($2,12,0,0)",
        [playerId, rollbackPlayerId],
      );
      await client.query(
        "INSERT INTO wallets (player_id,currency,balance) VALUES ($1,'coin',1000),($2,'coin',1000)",
        [playerId, rollbackPlayerId],
      );
      await client.query(
        `INSERT INTO mission_progress
           (player_id,mission_id,mission_version,period_key,progress,completed_at)
         VALUES
           ($1,'daily-spins-10',3,'2026-07-24',10,$3),
           ($1,'daily-wager-10000',3,'2026-07-24',10000,$3)`,
        [playerId, rollbackPlayerId, now],
      );
      await client.query(
        `INSERT INTO loot_table_versions
           (table_id,version,pity_group,pity_after,active,metadata,published_at)
         VALUES ('mission-future-reward',1,'mission-future',NULL,true,'{}',$1)`,
        [new Date("2026-08-01T00:00:00.000Z")],
      );
      await client.query(
        `INSERT INTO loot_table_entries
           (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,
            min_quantity,max_quantity,pity_eligible,metadata)
         VALUES ('mission-future-reward',1,'future-ticket','achievement-spin-ticket',1,
                 'guaranteed',0,1,1,false,'{}')`,
      );
      await client.query(
        `INSERT INTO mission_definition_versions
           (mission_id,version,cadence,tier,translation_key,metric,target,reward_coins,
            reward_mission_points,reward_loyalty_points,reward_stamps,reward_toolboxes,
            reward_boosters,unlock_daily_claims,unlock_pro_claims,reward_loot_table_id,
            reward_loot_table_version,reward_loot_expires_in_seconds,active,published_at,metadata)
         VALUES ('daily-spins-10',99,'daily','standard','mission.test.future','spin_count',10,12500,
                 10,25,0,0,0,0,0,'mission-future-reward',1,604800,true,$1,'{}')`,
        [now],
      );
      await client.query(
        `INSERT INTO mission_progress
           (player_id,mission_id,mission_version,period_key,progress,completed_at)
         VALUES ($1,'daily-spins-10',99,'2026-07-24',10,$2)`,
        [rollbackPlayerId, now],
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

  it("settles concurrent retries into one claim and one entitlement", async () => {
    const command = {
      playerId,
      missionId: "daily-spins-10",
      idempotencyKey: "00000000-0000-4000-8000-000000000601",
    } as const;
    const results = await Promise.all([store.claimMission(command, now), store.claimMission(command, now)]);
    const settled = results.find((result) => !result.replayed)!;

    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(new Set(results.map((result) => result.claimId)).size).toBe(1);
    expect(new Set(results.map((result) => result.lootEntitlement?.entitlementId)).size).toBe(1);
    expect(settled).toMatchObject({
      missionId: "daily-spins-10",
      missionVersion: 3,
      periodKey: "2026-07-24",
      coins: 12_500,
      coinBalance: 13_500,
      replayed: false,
      lootEntitlement: {
        tableId: "mission-standard-reward",
        tableVersion: 1,
        source: "mission",
        referenceId: "daily-spins-10:v3:2026-07-24",
        status: "available",
      },
    });
    expect(settled.lootEntitlement?.expiresAt).toBe("2026-07-31T12:00:00.000Z");

    const semanticReplay = await store.claimMission({ ...command, idempotencyKey: randomUUID() }, now);
    expect(semanticReplay.claimId).toBe(settled.claimId);
    expect(semanticReplay.replayed).toBe(true);

    await expect(store.claimMission({
      ...command,
      missionId: "daily-wager-10000",
    }, now)).rejects.toBeInstanceOf(MissionIdempotencyConflictError);
  });

  it("opens the mission entitlement through the authoritative loot and inventory stores", async () => {
    const claim = await pool.query<{ loot_entitlement_id: string }>(
      `SELECT loot_entitlement_id FROM mission_claims_v1
        WHERE player_id=$1 AND mission_id='daily-spins-10'`,
      [playerId],
    );
    const entitlementId = claim.rows[0]!.loot_entitlement_id;
    const opened = await lootStore.open({
      playerId,
      entitlementId,
      idempotencyKey: "mission-open:daily-spins-10",
    }, new Date(now.getTime() + 1000));

    expect(opened).toMatchObject({
      entitlementId,
      tableId: "mission-standard-reward",
      tableVersion: 1,
      source: "mission",
      referenceId: "daily-spins-10:v3:2026-07-24",
      replayed: false,
    });
    expect(opened.rewards).toContainEqual(expect.objectContaining({
      entryId: "standard-ticket",
      itemId: "achievement-spin-ticket",
      quantity: 1,
    }));
    const stacks = await inventory.list(playerId, new Date(now.getTime() + 1000));
    expect(stacks.some((stack) => stack.itemId === "achievement-spin-ticket")).toBe(true);
  });

  it("rolls back the entire claim when the pinned loot table is not yet published", async () => {
    await expect(store.claimMission({
      playerId: rollbackPlayerId,
      missionId: "daily-spins-10",
      idempotencyKey: "00000000-0000-4000-8000-000000000602",
    }, now)).rejects.toBeInstanceOf(LootEntitlementTableNotFoundError);

    const evidence = await pool.query<{
      claimed_at: Date | null; claims: string; entitlements: string; balance: string;
    }>(
      `SELECT progress.claimed_at,
              (SELECT count(*) FROM mission_claims_v1 claim WHERE claim.player_id=$1)::text AS claims,
              (SELECT count(*) FROM loot_entitlements entitlement WHERE entitlement.player_id=$1)::text AS entitlements,
              wallet.balance::text AS balance
         FROM mission_progress progress
         JOIN wallets wallet ON wallet.player_id=progress.player_id AND wallet.currency='coin'
        WHERE progress.player_id=$1 AND progress.mission_id='daily-spins-10'`,
      [rollbackPlayerId],
    );
    expect(evidence.rows[0]).toEqual({ claimed_at: null, claims: "0", entitlements: "0", balance: "1000" });
  });

  it("rejects forged progress claims and mutation of durable evidence", async () => {
    await expect(pool.query(
      `UPDATE mission_progress SET claimed_at=$2
        WHERE player_id=$1 AND mission_id='daily-wager-10000'`,
      [playerId, now],
    )).rejects.toThrow(/durable claim evidence/);
    await expect(pool.query(
      `UPDATE mission_definition_versions SET reward_coins=1
        WHERE mission_id='daily-wager-10000' AND version=3`,
    )).rejects.toThrow(/append-only/);
    await expect(pool.query(
      "DELETE FROM mission_claims_v1 WHERE player_id=$1",
      [playerId],
    )).rejects.toThrow(/append-only/);
  });

  it("keeps ledger and outbox evidence linked to the claim", async () => {
    const claim = await pool.query<{ id: string; loot_entitlement_id: string }>(
      "SELECT id,loot_entitlement_id FROM mission_claims_v1 WHERE player_id=$1",
      [playerId],
    );
    const ledger = await pool.query<{ invalid: string; count: string }>(
      `SELECT count(*) FILTER (WHERE balance_after<>balance_before+amount)::text AS invalid,
              count(*)::text AS count
         FROM wallet_ledger WHERE player_id=$1 AND source='mission'`,
      [playerId],
    );
    const outbox = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type,count(*)::text AS count FROM outbox_events
        WHERE aggregate_id IN ($1,$2)
        GROUP BY event_type ORDER BY event_type`,
      [claim.rows[0]!.id, claim.rows[0]!.loot_entitlement_id],
    );

    expect(ledger.rows[0]).toEqual({ invalid: "0", count: "3" });
    expect(outbox.rows).toEqual([
      { event_type: "loot.entitlement.issued", count: "1" },
      { event_type: "mission.claimed", count: "1" },
    ]);
  });
});
