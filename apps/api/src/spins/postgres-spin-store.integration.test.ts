import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { activeShopOffers } from "../shop/shop-catalog.js";
import { PostgresSpinStore } from "./postgres-spin-store.js";
import { CheckWinNotClaimableError, InsufficientGemsError, RewardNotAvailableError, ShopOfferLimitReachedError } from "./spin-store.js";
import { storeProducts } from "../monetization/store-products.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

function winningSpin(configId: string): SpinResult {
  return {
    configId, configVersion: 1, mathModelVersion: "2.0.0",
    seed: "42", baseBet: 10, wager: 10, bonusBuy: false,
    stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
    wins: [{ kind: "line", payline: 0, symbol: "A", count: 3, amount: 5, cells: [[0, 0], [1, 0], [2, 0]] }],
    rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 5,
      events: [{ type: "scatter.hit", data: { symbol: "S", count: 3 } }] }],
    freeSpinsPlayed: 0, totalWin: 5, maxWinReached: false, maxWinMultiplier: 1_000,
  };
}

databaseSuite("PostgresSpinStore integration", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresSpinStore(pool);
  const playerId = randomUUID();
  const shopPlayerId = randomUUID();
  const concurrentShopPlayerId = randomUUID();
  const storePlayerId = randomUUID();
  const checkWinPlayerId = randomUUID();
  const boostPlayerId = randomUUID();
  const loyaltyPlayerId = randomUUID();
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
    const majorJackpotMigration = await readFile(
      new URL("../../../../infra/postgres/025_major_progressive_jackpot.sql", import.meta.url), "utf8",
    );
    await pool.query(majorJackpotMigration);
    const shopMigration = await readFile(
      new URL("../../../../infra/postgres/013_shop_purchases.sql", import.meta.url), "utf8",
    );
    await pool.query(shopMigration);
    const storeMigration = await readFile(
      new URL("../../../../infra/postgres/018_store_monetization.sql", import.meta.url), "utf8",
    );
    await pool.query(storeMigration);
    const nativeStoreMigration = await readFile(
      new URL("../../../../infra/postgres/019_native_store_semantics.sql", import.meta.url), "utf8",
    );
    await pool.query(nativeStoreMigration);
    const multiCurrencyMigration = await readFile(
      new URL("../../../../infra/postgres/024_multi_currency_economy.sql", import.meta.url), "utf8",
    );
    await pool.query(multiCurrencyMigration);
    const checkWinMigration = await readFile(
      new URL("../../../../infra/postgres/026_check_win_rewards.sql", import.meta.url), "utf8",
    );
    await pool.query(checkWinMigration);
    const boosterMigration = await readFile(
      new URL("../../../../infra/postgres/027_xp_boosters.sql", import.meta.url), "utf8",
    );
    await pool.query(boosterMigration);
    const loyaltyMigration = await readFile(
      new URL("../../../../infra/postgres/028_loyalty_rewards.sql", import.meta.url), "utf8",
    );
    await pool.query(loyaltyMigration);
    const missionTracksMigration = await readFile(
      new URL("../../../../infra/postgres/029_mission_tracks.sql", import.meta.url), "utf8",
    );
    await pool.query(missionTracksMigration);
    const highRollerMigration = await readFile(
      new URL("../../../../infra/postgres/030_high_roller_club.sql", import.meta.url), "utf8",
    );
    await pool.query(highRollerMigration);
    await pool.query("INSERT INTO players (id) VALUES ($1),($2),($3),($4),($5),($6),($7)",
      [playerId, shopPlayerId, concurrentShopPlayerId, storePlayerId, checkWinPlayerId, boostPlayerId, loyaltyPlayerId]);
    await pool.query(
      `INSERT INTO wallets (player_id, currency, balance) VALUES
        ($1,'coin',100),($1,'gem',0),($2,'coin',1000),($2,'gem',320),($3,'coin',1000),($3,'gem',320),
        ($4,'coin',1000),($4,'gem',320),($5,'coin',1000),($5,'gem',0),($5,'check_win_mark',5),($5,'stamp',0),
        ($6,'coin',1000),($6,'gem',0),($6,'stamp',3),($6,'booster',0),
        ($7,'coin',1000),($7,'gem',10),($7,'loyalty_point',500)`,
      [playerId, shopPlayerId, concurrentShopPlayerId, storePlayerId, checkWinPlayerId, boostPlayerId, loyaltyPlayerId],
    );
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
    const spin = winningSpin(slotId);
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
         FROM wallet_ledger WHERE player_id=$1 AND currency='coin' ORDER BY balance_before DESC`,
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
    expect((await store.getProfile(playerId)).balances).toEqual(expect.arrayContaining([
      { currency: "loyalty_point", balance: 1 },
      { currency: "mission_point", balance: 1 },
      { currency: "vip_point", balance: 1 },
    ]));
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
    expect(missions.find((mission) => mission.id === "pro-spins-40")).toMatchObject({
      cadence: "three_day", tier: "pro", translationKey: "mission.pro_spins_40", progress: 1,
    });
    const missionClaim = await store.claimMission(playerId, missionId, new Date());
    expect(missionClaim).toMatchObject({ missionId, coins: 1234 });
    expect((await store.getMissions(playerId, new Date())).find((mission) => mission.id === "weekly-bar-1"))
      .toMatchObject({ progress: 1, completed: true });
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
    expect(await store.getHighRollerClub(playerId, new Date("2026-07-03T04:02:00.000Z")))
      .toMatchObject({ points: 2_150 });
  });

  it("purchases shop offers atomically with replay, limits, and wallet ledger entries", async () => {
    const offer = activeShopOffers(new Date("2026-07-15T12:00:00.000Z"))[0]!;
    const idempotencyKey = randomUUID();
    const first = await store.purchaseShopOffer(shopPlayerId, offer, idempotencyKey);
    const replay = await store.purchaseShopOffer(shopPlayerId, offer, idempotencyKey);
    expect(first).toMatchObject({
      offerId: "daily-fortune",
      coins: 200_000,
      gemsSpent: 20,
      coinBalance: 201_000,
      gemBalance: 300,
    });
    expect(replay).toEqual(first);
    expect(await store.getHighRollerClub(shopPlayerId, new Date())).toMatchObject({ points: 2_000 });
    await expect(
      store.purchaseShopOffer(shopPlayerId, offer, randomUUID()),
    ).rejects.toBeInstanceOf(ShopOfferLimitReachedError);
    await expect(
      store.purchaseShopOffer(
        shopPlayerId,
        { ...offer, id: "too-expensive", periodKey: null, costGems: 301 },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(InsufficientGemsError);

    const ledger = await pool.query<{
      currency: string;
      amount: string;
      balance_before: string;
      balance_after: string;
    }>(
      `SELECT currency, amount, balance_before, balance_after
         FROM wallet_ledger WHERE player_id=$1 AND source='shop' ORDER BY currency`,
      [shopPlayerId],
    );
    expect(ledger.rows).toEqual([
      { currency: "coin", amount: "200000", balance_before: "1000", balance_after: "201000" },
      { currency: "gem", amount: "-20", balance_before: "320", balance_after: "300" },
    ]);

    const concurrentOffer = { ...offer, id: "concurrent-daily" };
    const concurrent = await Promise.allSettled([
      store.purchaseShopOffer(concurrentShopPlayerId, concurrentOffer, randomUUID()),
      store.purchaseShopOffer(concurrentShopPlayerId, concurrentOffer, randomUUID()),
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = concurrent.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(ShopOfferLimitReachedError);
  });

  it("exchanges Check-&-Win marks atomically and replays the same reward", async () => {
    expect(await store.getCheckWinStatus(checkWinPlayerId)).toMatchObject({ marks: 5, claimable: true });
    const key = randomUUID();
    const first = await store.claimCheckWin(checkWinPlayerId, key);
    const replay = await store.claimCheckWin(checkWinPlayerId, key);
    expect(first).toMatchObject({ marksSpent: 5, coins: 100_000, stamps: 1, coinBalance: 101_000,
      markBalance: 0, stampBalance: 1, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(store.claimCheckWin(checkWinPlayerId, randomUUID()))
      .rejects.toBeInstanceOf(CheckWinNotClaimableError);
    const ledger = await pool.query<{ currency: string; amount: string }>(
      "SELECT currency,amount FROM wallet_ledger WHERE player_id=$1 AND source='check_win' ORDER BY currency",
      [checkWinPlayerId],
    );
    expect(ledger.rows).toEqual([
      { currency: "check_win_mark", amount: "-5" },
      { currency: "coin", amount: "100000" },
      { currency: "stamp", amount: "1" },
    ]);
  });

  it("crafts and activates a booster that doubles and consumes one settled XP spin", async () => {
    expect(await store.getBoosterStatus(boostPlayerId)).toMatchObject({ stamps: 3, canCraft: true, activeSpins: 0 });
    const craftKey = randomUUID();
    const craft = await store.craftBooster(boostPlayerId, craftKey);
    expect(await store.craftBooster(boostPlayerId, craftKey)).toEqual({ ...craft, replayed: true });
    const activationKey = randomUUID();
    const activation = await store.activateBooster(boostPlayerId, activationKey);
    expect(await store.activateBooster(boostPlayerId, activationKey)).toEqual({ ...activation, replayed: true });
    expect(activation).toMatchObject({ boosterBalance: 0, activeSpins: 20 });
    expect(await store.getHighRollerClub(boostPlayerId, new Date())).toMatchObject({ points: 500 });
    await store.settle({ playerId: boostPlayerId, idempotencyKey: randomUUID(), slotId,
      configVersion: 1, bet: 10, seed: 42n }, () => winningSpin(slotId));
    expect((await store.getProfile(boostPlayerId)).progression.xp).toBe(20);
    expect(await store.getBoosterStatus(boostPlayerId)).toMatchObject({ activeSpins: 19, xpMultiplier: 2 });
    const ledger = await pool.query<{ count: string }>(
      "SELECT count(*) FROM wallet_ledger WHERE player_id=$1 AND source='xp_booster'",
      [boostPlayerId],
    );
    expect(ledger.rows[0]?.count).toBe("3");
  });

  it("redeems loyalty points atomically and persists an idempotent result", async () => {
    const status = await store.getLoyaltyRewards(loyaltyPlayerId);
    expect(status).toMatchObject({ loyaltyPoints: 500 });
    expect(status.offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "coin-cache", canRedeem: true }),
    ]));
    const key = randomUUID();
    const first = await store.redeemLoyaltyReward(loyaltyPlayerId, "gem-pouch", key);
    const replay = await store.redeemLoyaltyReward(loyaltyPlayerId, "gem-pouch", key);
    expect(first).toMatchObject({ loyaltyPointsSpent: 500, rewardCurrency: "gem",
      rewardAmount: 25, loyaltyPointBalance: 0, rewardBalance: 35, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    const ledger = await pool.query<{ currency: string; amount: string }>(
      "SELECT currency,amount FROM wallet_ledger WHERE player_id=$1 AND source='loyalty_rewards' ORDER BY currency",
      [loyaltyPlayerId],
    );
    expect(ledger.rows).toEqual([
      { currency: "gem", amount: "25" },
      { currency: "loyalty_point", amount: "-500" },
    ]);
  });

  it("grants and refunds a verified provider transaction idempotently without storing its token", async () => {
    const product = storeProducts.find((item) => item.key === "fortune-chest")!;
    const transactionId = `pg-${randomUUID()}`;
    const command = { playerId: storePlayerId, product, verificationHash: "b".repeat(64), verified: {
      platform: "ios" as const, storeProductId: product.storeProductIds.ios, transactionId,
      originalTransactionId: transactionId, accountId: storePlayerId, environment: "sandbox" as const,
      purchasedAt: new Date(), quantity: 1 as const, purchaseState: "purchased" as const, revokedAt: null,
    } };
    const first = await store.grantStorePurchase(command);
    const replay = await store.grantStorePurchase(command);
    expect(first).toMatchObject({ coins: 5_000_000, gems: 150, coinBalance: 5_001_000, gemBalance: 470,
      highRollerPoints: 6_000, highRollerPointBalance: 6_000, replayed: false });
    expect(replay).toMatchObject({ coinBalance: 5_001_000, replayed: true });
    const persisted = await pool.query<{ verification_hash: string }>(
      "SELECT verification_hash FROM verified_store_purchases WHERE platform='ios' AND transaction_id=$1", [transactionId],
    );
    expect(persisted.rows).toEqual([{ verification_hash: "b".repeat(64) }]);
    const eventId = randomUUID();
    expect(await store.refundStorePurchase({ eventId, platform: "ios", transactionId, occurredAt: new Date(), providerPayloadHash: "c".repeat(64) })).toBe(true);
    expect(await store.refundStorePurchase({ eventId, platform: "ios", transactionId, occurredAt: new Date(), providerPayloadHash: "c".repeat(64) })).toBe(false);
    expect(await store.getProfile(storePlayerId)).toMatchObject({ coinBalance: 1000, gemBalance: 320 });
    expect(await store.getHighRollerClub(storePlayerId, new Date())).toMatchObject({ points: 0 });
    const ledger = await pool.query<{ count: string }>(
      "SELECT count(*) FROM wallet_ledger WHERE player_id=$1 AND source IN ('store_purchase','store_refund')", [storePlayerId],
    );
    expect(ledger.rows[0]?.count).toBe("6");
  });
});
