import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AchievementAlreadyClaimedError,
  AchievementIdempotencyConflictError,
  AchievementNotClaimableError,
  AchievementPlayerNotFoundError,
} from "./achievement-store.js";
import { PostgresAchievementStore } from "./postgres-achievement-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgresAchievementStore integration", () => {
  const schema = `achievement_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresAchievementStore(pool);
  const playerId = "00000000-0000-4000-8000-000000000010";
  const overflowPlayerId = "00000000-0000-4000-8000-000000000020";
  const backfillPlayerId = "00000000-0000-4000-8000-000000000030";
  const now = new Date("2026-07-24T12:00:00.000Z");

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      for (const migration of ["001_core.sql", "038_achievement_persistence_v1.sql", "039_achievement_immutability.sql"]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query(
        `INSERT INTO players (id,level,xp,vip_points) VALUES
           ($1,10,0,1000),($2,2,0,0),($3,1,0,0)`,
        [playerId, overflowPlayerId, backfillPlayerId],
      );
      await client.query(
        `INSERT INTO wallets (player_id,currency,balance) VALUES
           ($1,'coin',1000),($2,'coin',9007199254740991),($3,'coin',0)`,
        [playerId, overflowPlayerId, backfillPlayerId],
      );
      await client.query(
        `INSERT INTO slot_config_versions (slot_id,version,config,config_sha256,published_at)
         VALUES ('achievement-test',1,'{}',decode(repeat('00',32),'hex'),$1)`,
        [new Date("2026-07-24T10:00:00.000Z")],
      );
      await client.query(
        `INSERT INTO spins
           (id,player_id,idempotency_key,slot_id,config_version,bet,win,rng_seed,result,
            balance_before,balance_after,server_version,math_model_version,progression_after,created_at)
         VALUES ($1,$2,$3,'achievement-test',1,10,5000000,1,'{}',1000,5000990,'test','test',$4::jsonb,$5)`,
        [randomUUID(), playerId, randomUUID(), JSON.stringify({
          level: 10, xp: 0, spins: 100, totalWon: 5_000_000, freeSpins: 25, vipPoints: 1_000,
        }), now],
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

  it("projects active definitions from the spin trigger and exposes durable views", async () => {
    const views = await store.list(playerId, now);
    expect(views).toHaveLength(15);
    expect(views.find((item) => item.id === "achievement-first-spin")).toMatchObject({
      version: 1, progress: 100, completed: true, claimed: false, unlocked: true,
    });
    expect(views.find((item) => item.id === "achievement-high-roller")).toMatchObject({
      progress: 100, completed: true, claimed: false, unlocked: false,
    });
    const evidence = await pool.query<{ completion_evidence: { sourceType: string; sourceId: string } }>(
      `SELECT completion_evidence FROM player_achievement_progress
        WHERE player_id=$1 AND achievement_id='achievement-first-spin'`,
      [playerId],
    );
    expect(evidence.rows[0]?.completion_evidence).toMatchObject({ sourceType: "spin" });
  });

  it("settles concurrent claims exactly once and unlocks the prerequisite chain", async () => {
    const command = {
      playerId,
      achievementId: "achievement-first-spin",
      idempotencyKey: "00000000-0000-4000-8000-000000000101",
    } as const;
    const results = await Promise.all([store.claim(command, now), store.claim(command, now)]);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(new Set(results.map((result) => result.claimId)).size).toBe(1);
    expect(results[0]).toMatchObject({ achievementVersion: 1, coins: 75_000, progress: 100, coinBalance: 76_000 });

    await expect(store.claim({
      ...command,
      achievementId: "achievement-high-roller",
    }, now)).rejects.toBeInstanceOf(AchievementIdempotencyConflictError);
    await expect(store.claim({
      ...command,
      idempotencyKey: "00000000-0000-4000-8000-000000000102",
    }, now)).rejects.toBeInstanceOf(AchievementAlreadyClaimedError);

    const unlocked = await store.list(playerId, now);
    expect(unlocked.find((item) => item.id === "achievement-high-roller")?.unlocked).toBe(true);
    const highRoller = await store.claim({
      playerId,
      achievementId: "achievement-high-roller",
      idempotencyKey: "00000000-0000-4000-8000-000000000103",
    }, now);
    expect(highRoller).toMatchObject({ coins: 500_000, coinBalance: 576_000, replayed: false });

    await expect(store.claim({
      playerId,
      achievementId: "achievement-spin-master",
      idempotencyKey: "00000000-0000-4000-8000-000000000104",
    }, now)).rejects.toBeInstanceOf(AchievementNotClaimableError);
    await expect(store.claim({
      playerId,
      achievementId: "achievement-journey-10",
      idempotencyKey: "00000000-0000-4000-8000-000000000105",
    }, now)).rejects.toBeInstanceOf(AchievementNotClaimableError);
  });

  it("keeps claim, wallet, ledger, and outbox evidence consistent", async () => {
    const claims = await pool.query<{ count: string }>("SELECT count(*) FROM achievement_claims_v1 WHERE player_id=$1", [playerId]);
    const ledger = await pool.query<{ invalid: string; count: string }>(
      `SELECT count(*) FILTER (WHERE balance_after <> balance_before + amount) AS invalid,count(*) AS count
         FROM wallet_ledger WHERE player_id=$1 AND source='achievement'`,
      [playerId],
    );
    const outbox = await pool.query<{ count: string }>(
      "SELECT count(*) FROM outbox_events WHERE aggregate_type='achievement' AND event_type='achievement.claimed'",
    );
    expect(claims.rows[0]?.count).toBe("2");
    expect(ledger.rows[0]).toEqual({ invalid: "0", count: "2" });
    expect(outbox.rows[0]?.count).toBe("2");

    await expect(pool.query(
      `UPDATE player_achievement_progress SET completion_evidence='{}'
        WHERE player_id=$1 AND achievement_id='achievement-first-spin'`,
      [playerId],
    )).rejects.toThrow(/immutable/);
    await expect(pool.query(
      "DELETE FROM achievement_claims_v1 WHERE player_id=$1 AND achievement_id='achievement-first-spin'",
      [playerId],
    )).rejects.toThrow(/append-only/);
  });

  it("fails closed and rolls back claims when the resulting wallet is unsafe", async () => {
    await expect(store.claim({
      playerId: overflowPlayerId,
      achievementId: "achievement-journey-2",
      idempotencyKey: "00000000-0000-4000-8000-000000000201",
    }, now)).rejects.toBeInstanceOf(RangeError);
    const claims = await pool.query<{ count: string }>(
      "SELECT count(*) FROM achievement_claims_v1 WHERE player_id=$1",
      [overflowPlayerId],
    );
    const ledger = await pool.query<{ count: string }>(
      "SELECT count(*) FROM wallet_ledger WHERE player_id=$1 AND source='achievement'",
      [overflowPlayerId],
    );
    expect(claims.rows[0]?.count).toBe("0");
    expect(ledger.rows[0]?.count).toBe("0");
  });

  it("backfills players in stable cursor batches and rejects unknown players", async () => {
    const first = await store.backfillBatch(null, 2, now);
    expect(first).toEqual({ processed: 2, nextPlayerId: overflowPlayerId });
    expect(await store.backfillBatch(first.nextPlayerId, 2, now)).toEqual({ processed: 1, nextPlayerId: null });
    const projected = await pool.query<{ count: string }>(
      "SELECT count(*) FROM player_achievement_progress WHERE player_id=$1",
      [backfillPlayerId],
    );
    expect(projected.rows[0]?.count).toBe("15");
    await expect(store.list("00000000-0000-4000-8000-000000000099", now))
      .rejects.toBeInstanceOf(AchievementPlayerNotFoundError);
  });
});
