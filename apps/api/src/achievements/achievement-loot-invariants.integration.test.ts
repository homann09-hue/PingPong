import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAchievementStore } from "./postgres-achievement-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("achievement loot database invariants", () => {
  const schema = `achievement_loot_invariants_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresAchievementStore(pool);
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
        "038_achievement_persistence_v1.sql",
        "039_achievement_immutability.sql",
        "040_achievement_authoritative_backfill.sql",
        "041_loot_entitlements_v1.sql",
        "042_loot_entitlement_invariants.sql",
        "043_achievement_loot_rewards_v1.sql",
        "044_achievement_loot_reward_invariants.sql",
      ]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query(
        "INSERT INTO players (id,level,xp,vip_points) VALUES ($1,2,0,100)",
        [playerId],
      );
      await client.query(
        "INSERT INTO wallets (player_id,currency,balance) VALUES ($1,'coin',1000)",
        [playerId],
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

  it("accepts a correctly bound transactional claim", async () => {
    const result = await store.claim({
      playerId,
      achievementId: "achievement-journey-2",
      idempotencyKey: "claim:journey-2",
    }, now);

    expect(result).toMatchObject({
      achievementId: "achievement-journey-2",
      coins: 100_000,
      coinBalance: 101_000,
      lootEntitlement: {
        tableId: "achievement-bronze-reward",
        tableVersion: 1,
        source: "achievement",
        referenceId: "achievement-journey-2:v1",
      },
    });
  });

  it("rejects semantic edits to published achievement versions", async () => {
    await expect(pool.query(
      `UPDATE achievement_definition_versions
          SET reward_coins=reward_coins+1
        WHERE achievement_id='achievement-vip-100' AND version=1`,
    )).rejects.toThrow(/semantics are immutable/);
    await expect(pool.query(
      `UPDATE achievement_definition_versions
          SET reward_loot_expires_in_seconds=120
        WHERE achievement_id='achievement-vip-100' AND version=1`,
    )).rejects.toThrow(/semantics are immutable/);

    const definition = await pool.query<{
      reward_coins: string;
      reward_loot_expires_in_seconds: number;
    }>(
      `SELECT reward_coins,reward_loot_expires_in_seconds
         FROM achievement_definition_versions
        WHERE achievement_id='achievement-vip-100' AND version=1`,
    );
    expect(definition.rows[0]).toEqual({
      reward_coins: "150000",
      reward_loot_expires_in_seconds: 604_800,
    });
  });

  it("rejects direct claims without a correctly bound entitlement", async () => {
    await store.list(playerId, now);
    const progress = await pool.query<{
      progress: string;
      completion_evidence: Readonly<Record<string, unknown>>;
    }>(
      `SELECT progress,completion_evidence
         FROM player_achievement_progress
        WHERE player_id=$1 AND achievement_id='achievement-vip-100' AND achievement_version=1`,
      [playerId],
    );
    const claimId = randomUUID();

    await expect(pool.query(
      `INSERT INTO achievement_claims_v1
         (id,player_id,achievement_id,achievement_version,idempotency_key,request_hash,
          progress_at_claim,completion_evidence,reward_coins,coin_balance_after,
          loot_entitlement_id,result,claimed_at)
       VALUES ($1,$2,'achievement-vip-100',1,'direct-invalid',decode(repeat('00',32),'hex'),
               $3,$4::jsonb,150000,251000,NULL,'{}'::jsonb,$5)`,
      [claimId, playerId, progress.rows[0]!.progress,
        JSON.stringify(progress.rows[0]!.completion_evidence), now],
    )).rejects.toThrow(/requires an entitlement/);

    const claims = await pool.query<{ count: string }>(
      "SELECT count(*) FROM achievement_claims_v1 WHERE id=$1",
      [claimId],
    );
    expect(claims.rows[0]?.count).toBe("0");
  });
});
