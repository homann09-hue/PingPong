import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { PostgresSpinStore } from "./postgres-spin-store.js";
import { RewardNotAvailableError } from "./spin-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgresSpinStore integration", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresSpinStore(pool);
  const playerId = randomUUID();
  const slotId = `integration-${randomUUID()}`;
  const missionId = `integration-mission-${randomUUID()}`;

  beforeAll(async () => {
    const exists = await pool.query<{ table_name: string | null }>("SELECT to_regclass('public.players') AS table_name");
    if (!exists.rows[0]?.table_name) {
      const migration = await readFile(new URL("../../../../infra/postgres/001_core.sql", import.meta.url), "utf8");
      await pool.query(migration);
    }
    const progressionMigration = await readFile(
      new URL("../../../../infra/postgres/002_spin_progression.sql", import.meta.url), "utf8",
    );
    await pool.query(progressionMigration);
    const auditMigration = await readFile(
      new URL("../../../../infra/postgres/003_spin_audit.sql", import.meta.url), "utf8",
    );
    await pool.query(auditMigration);
    const walletLedgerMigration = await readFile(
      new URL("../../../../infra/postgres/004_wallet_ledger_audit.sql", import.meta.url), "utf8",
    );
    await pool.query(walletLedgerMigration);
    const timedRewardMigration = await readFile(
      new URL("../../../../infra/postgres/006_timed_rewards.sql", import.meta.url), "utf8",
    );
    await pool.query(timedRewardMigration);
    const wheelMigration = await readFile(
      new URL("../../../../infra/postgres/007_bonus_wheels.sql", import.meta.url), "utf8",
    );
    await pool.query(wheelMigration);
    const missionMigration = await readFile(
      new URL("../../../../infra/postgres/008_missions.sql", import.meta.url), "utf8",
    );
    await pool.query(missionMigration);
    const missionTierMigration = await readFile(
      new URL("../../../../infra/postgres/009_mission_tiers.sql", import.meta.url), "utf8",
    );
    await pool.query(missionTierMigration);
    const liveEventMigration = await readFile(
      new URL("../../../../infra/postgres/010_live_events.sql", import.meta.url), "utf8",
    );
    await pool.query(liveEventMigration);
    const tournamentMigration = await readFile(
      new URL("../../../../infra/postgres/011_tournaments.sql", import.meta.url), "utf8",
    );
    await pool.query(tournamentMigration);
    const jackpotMigration = await readFile(
      new URL("../../../../infra/postgres/012_progressive_jackpots.sql", import.meta.url), "utf8",
    );
    await pool.query(jackpotMigration);
    const shopMigration = await readFile(
      new URL("../../../../infra/postgres/013_shop_purchases.sql", import.meta.url), "utf8",
    );
    await pool.query(shopMigration);
    await pool.query("INSERT INTO players (id) VALUES ($1)", [playerId]);
    await pool.query("INSERT INTO wallets (player_id, currency, balance) VALUES ($1,'coin',100),($1,'gem',0)", [playerId]);
    await pool.query(
      "INSERT INTO slot_config_versions (slot_id, version, config, config_sha256, published_at) VALUES ($1,1,'{}',$2,now())",
      [slotId, Buffer.alloc(32)],
    );
    await pool.query(
      "INSERT INTO mission_definitions (id,version,cadence,tier,translation_key,metric,target,reward_coins) VALUES ($1,1,'daily','standard',$2,'spin_count',1,1234)",
      [missionId, `mission.${missionId}`],
    );
  });

  afterAll(async () => store.close());

  it("atomically settles and persistently replays a spin", async () => {
    const idempotencyKey = randomUUID();
    const spin: SpinResult = {
      configId: slotId, configVersion: 1, mathModelVersion: "2.0.0",
      seed: "42", baseBet: 10, wager: 10, bonusBuy: false,
      stops: [0, 0, 0],
      grid: [["A"], ["A"], ["A"]],
      wins: [{ kind: "line", payline: 0, symbol: "A", count: 3, amount: 5, cells: [[0,0], [1,0], [2,0]] }],
      rounds: [{
        phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 5,
        events: [{ type: "scatter.hit", data: { symbol: "S", count: 3 } }],
      }],
      freeSpinsPlayed: 0, totalWin: 5, maxWinReached: false, maxWinMultiplier: 1_000,
    };
    const command = { playerId, idempotencyKey, slotId, configVersion: 1, bet: 10, seed: 42n };
    const first = await store.settle(command, () => spin);
    const replay = await store.settle(command, () => { throw new Error("must not recalculate"); });

    expect(first).toEqual({
      spin,
      coinBalance: 95,
      progression: { level: 1, xp: 10, spins: 1, totalWon: 5, freeSpins: 0, vipPoints: 1 },
    });
    expect(replay).toEqual(first);
    const wallet = await pool.query<{ balance: string }>("SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin'", [playerId]);
    const ledger = await pool.query<{
      amount: string;
      source: string;
      balance_before: string;
      balance_after: string;
      idempotency_key: string;
    }>(
      `SELECT amount, source, balance_before, balance_after, idempotency_key
         FROM wallet_ledger WHERE player_id=$1 ORDER BY balance_before DESC`,
      [playerId],
    );
    const outbox = await pool.query<{ count: string }>("SELECT count(*) FROM outbox_events WHERE payload->>'playerId'=$1", [playerId]);
    const audit = await pool.query<{ balance_before: string; server_version: string; math_model_version: string }>(
      "SELECT balance_before, server_version, math_model_version FROM spins WHERE player_id=$1", [playerId],
    );
    const events = await pool.query<{ count: string }>(
      "SELECT count(*) FROM spin_events WHERE spin_id IN (SELECT id FROM spins WHERE player_id=$1)", [playerId],
    );
    expect(wallet.rows[0]?.balance).toBe("95");
    expect(ledger.rows).toEqual([
      expect.objectContaining({
        amount: "-10", source: "slot", balance_before: "100", balance_after: "90",
        idempotency_key: idempotencyKey,
      }),
      expect.objectContaining({
        amount: "5", source: "slot", balance_before: "90", balance_after: "95",
        idempotency_key: `${idempotencyKey}:win`,
      }),
    ]);
    expect(outbox.rows[0]?.count).toBe("1");
    expect(audit.rows[0]).toMatchObject({ balance_before: "100", math_model_version: "2.0.0" });
    expect(audit.rows[0]?.server_version).toBeTruthy();
    expect(events.rows[0]?.count).toBe("1");
    const transactions = await store.listWalletTransactions(playerId, 10);
    expect(transactions).toHaveLength(2);
    expect(transactions.every((entry) => entry.balanceAfter === entry.balanceBefore + entry.amount)).toBe(true);
    const missions = await store.getMissions(playerId, new Date());
    expect(missions.find((mission) => mission.id === missionId)).toMatchObject({ progress: 1, completed: true, claimed: false });
    expect(missions.find((mission) => mission.id === "weekly-spins-100")).toMatchObject({
      cadence: "weekly", tier: "pro", translationKey: "mission.weekly_spins_100", progress: 1,
    });
    const missionClaim = await store.claimMission(playerId, missionId, new Date());
    expect(missionClaim).toMatchObject({ missionId, coins: 1234 });
    await expect(store.claimMission(playerId, missionId, new Date())).rejects.toBeInstanceOf(Error);
    const liveEvents = await store.getLiveEvents(playerId, new Date());
    expect(liveEvents.find((event) => event.id === "spin-sprint")).toMatchObject({ progress: 1 });
    expect(liveEvents.find((event) => event.id === "world-fortune")).toMatchObject({ progress: 5 });
  });

  it("claims timed rewards once, advances daily streak, and unlocks every fourth hourly wheel", async () => {
    const dayOne = new Date("2026-07-01T10:00:00.000Z");
    const firstDaily = await store.claimTimedReward(playerId, "daily", dayOne);
    expect(firstDaily).toMatchObject({ coins: 100_000, streak: 1, cyclePosition: 1, wheelUnlocked: false });
    await expect(store.claimTimedReward(playerId, "daily", dayOne)).rejects.toBeInstanceOf(RewardNotAvailableError);
    const secondDaily = await store.claimTimedReward(playerId, "daily", new Date("2026-07-02T00:01:00.000Z"));
    expect(secondDaily).toMatchObject({ coins: 125_000, streak: 2, cyclePosition: 2 });

    const hourlyWins = [];
    for (let hour = 0; hour < 4; hour++) {
      hourlyWins.push(await store.claimTimedReward(playerId, "hourly", new Date(Date.UTC(2026, 6, 3, hour))));
    }
    expect(hourlyWins.map((claim) => claim.wheelUnlocked)).toEqual([false, false, false, true]);
    expect(hourlyWins[3]?.claimsTowardWheel).toBe(0);
    const transitions = await pool.query<{ invalid: string }>(
      `SELECT count(*) FILTER (WHERE balance_after <> balance_before + amount) AS invalid
         FROM wallet_ledger WHERE player_id=$1 AND source='timed_reward'`, [playerId],
    );
    expect(transitions.rows[0]?.invalid).toBe("0");

    const key = randomUUID();
    const wheel = await store.spinWheel(playerId, key, 0.85, new Date("2026-07-03T04:01:00.000Z"));
    const replay = await store.spinWheel(playerId, key, 0, new Date("2026-07-03T04:02:00.000Z"));
    expect(wheel).toEqual(replay);
    expect(wheel).toMatchObject({ rewardCurrency: "gem", rewardAmount: 25, availableSpins: 0 });
    const gems = await pool.query<{ balance: string }>("SELECT balance FROM wallets WHERE player_id=$1 AND currency='gem'", [playerId]);
    expect(gems.rows[0]?.balance).toBe("25");
  });
});
