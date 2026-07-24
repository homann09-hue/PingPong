import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAchievementStore } from "./postgres-achievement-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("achievement authoritative backfill", () => {
  const schema = `achievement_backfill_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresAchievementStore(pool);
  const playerId = "00000000-0000-4000-8000-000000000050";
  const now = new Date("2026-07-24T14:00:00.000Z");

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      for (const migration of [
        "001_core.sql",
        "038_achievement_persistence_v1.sql",
        "039_achievement_immutability.sql",
        "040_achievement_authoritative_backfill.sql",
      ]) {
        await client.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
      }
      await client.query("INSERT INTO players (id,level,xp,vip_points) VALUES ($1,1,0,100)", [playerId]);
      await client.query("INSERT INTO wallets (player_id,currency,balance) VALUES ($1,'coin',0)", [playerId]);
      await client.query(
        `INSERT INTO slot_config_versions (slot_id,version,config,config_sha256,published_at)
         VALUES ('achievement-backfill-test',1,'{}',decode(repeat('00',32),'hex'),$1)`,
        [new Date("2026-07-24T10:00:00.000Z")],
      );
      await client.query(
        `INSERT INTO spins
           (id,player_id,idempotency_key,slot_id,config_version,bet,win,rng_seed,result,
            balance_before,balance_after,server_version,math_model_version,progression_after,created_at)
         VALUES ($1,$2,$3,'achievement-backfill-test',1,10,250000,1,'{}',0,249990,'test','test',$4::jsonb,$5)`,
        [randomUUID(), playerId, randomUUID(), JSON.stringify({
          level: 1, xp: 0, spins: 100, totalWon: 250_000, freeSpins: 3, vipPoints: 100,
        }), new Date("2026-07-24T12:00:00.000Z")],
      );
      await client.query("UPDATE players SET level=25,xp=1234,vip_points=7500 WHERE id=$1", [playerId]);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  });

  it("uses current player fields without losing cumulative spin metrics", async () => {
    const views = await store.list(playerId, now);
    expect(views.find((item) => item.id === "achievement-journey-25")).toMatchObject({
      progress: 25,
      completed: true,
    });
    expect(views.find((item) => item.id === "achievement-vip-7500")).toMatchObject({
      progress: 7_500,
      completed: true,
    });
    expect(views.find((item) => item.id === "achievement-high-roller")).toMatchObject({
      progress: 100,
      completed: true,
    });
    expect(views.find((item) => item.id === "achievement-collector")).toMatchObject({
      progress: 250_000,
      completed: true,
    });

    const evidence = await pool.query<{ completion_evidence: { sourceType: string; progression: { vipPoints: number } } }>(
      `SELECT completion_evidence FROM player_achievement_progress
        WHERE player_id=$1 AND achievement_id='achievement-vip-7500'`,
      [playerId],
    );
    expect(evidence.rows[0]?.completion_evidence).toMatchObject({
      sourceType: "backfill",
      progression: { vipPoints: 7_500 },
    });
  });
});
