import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";
import { HighRollerAlreadyActiveError } from "./spin-store.js";
import { activeShopOffers } from "../shop/shop-catalog.js";
import { storeProducts } from "../monetization/store-products.js";

function result(totalWin: number, seed: bigint): SpinResult {
  return {
    configId: "high-roller-test", configVersion: 1, mathModelVersion: "test", seed: seed.toString(),
    baseBet: 10_000, wager: 10_000, bonusBuy: false, stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
    wins: [], rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin, events: [] }],
    freeSpinsPlayed: 0, totalWin, maxWinReached: false, maxWinMultiplier: 1_000,
  };
}

describe("InMemorySpinStore High Roller Club", () => {
  it("credits fixed activity sources once and exposes their live availability", async () => {
    const store = new InMemorySpinStore(100_000);
    const playerId = randomUUID();
    const now = new Date("2026-07-17T12:00:00.000Z");
    await store.claimTimedReward(playerId, "daily", now);
    await store.claimTimedReward(playerId, "hourly", now);
    const offer = activeShopOffers(now).find((item) => item.id === "starter-fortune")!;
    const key = randomUUID();
    const purchase = await store.purchaseShopOffer(playerId, offer, key);
    expect(await store.purchaseShopOffer(playerId, offer, key)).toEqual(purchase);

    const club = await store.getHighRollerClub(playerId, now);
    expect(club.points).toBe(2_850);
    expect(club.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "daily_store_bonus", points: 750, available: true }),
      expect.objectContaining({ id: "purchase", points: 2_000, available: true }),
      expect.objectContaining({ id: "space_battle", points: null, available: false }),
    ]));
    expect((await store.listWalletTransactions(playerId, 100))
      .filter((entry) => entry.reason === "high_roller_source")).toHaveLength(3);
  });

  it("grants platform purchase points once and reverses them on refund", async () => {
    const store = new InMemorySpinStore(100_000);
    const playerId = randomUUID();
    const product = storeProducts.find((item) => item.key === "fortune-chest")!;
    const transactionId = `high-roller-${randomUUID()}`;
    const command = { playerId, product, verificationHash: "a".repeat(64), verified: {
      platform: "ios" as const, storeProductId: product.storeProductIds.ios, transactionId,
      originalTransactionId: transactionId, accountId: playerId, environment: "sandbox" as const,
      purchasedAt: new Date(), quantity: 1 as const, purchaseState: "purchased" as const, revokedAt: null,
    } };
    const first = await store.grantStorePurchase(command);
    const replay = await store.grantStorePurchase(command);
    expect(first).toMatchObject({ highRollerPoints: 6_000, highRollerPointBalance: 6_000, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });

    const eventId = randomUUID();
    expect(await store.refundStorePurchase({ eventId, platform: "ios", transactionId,
      occurredAt: new Date(), providerPayloadHash: "b".repeat(64) })).toBe(true);
    expect(await store.refundStorePurchase({ eventId, platform: "ios", transactionId,
      occurredAt: new Date(), providerPayloadHash: "b".repeat(64) })).toBe(false);
    expect(await store.getHighRollerClub(playerId, new Date())).toMatchObject({ points: 0 });
    expect((await store.listWalletTransactions(playerId, 100))
      .filter((entry) => entry.currency === "high_roller_point")).toHaveLength(2);
  });

  it("activates seven-day access once and applies member spin benefits", async () => {
    const store = new InMemorySpinStore(500_000);
    const playerId = randomUUID();
    for (let index = 0; index < 19; index += 1) {
      const seed = BigInt(index);
      await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "high-roller-test",
        configVersion: 1, baseBet: 10_000, effectiveWager: 10_000, bonusBuy: false, seed }, () => result(10_000, seed));
    }
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(await store.getHighRollerClub(playerId, now)).toMatchObject({ points: 20_900, eligible: true, active: false });
    const key = randomUUID();
    const activation = await store.activateHighRollerClub(playerId, key, now);
    expect(activation).toMatchObject({ pointsSpent: 20_000, points: 900, stampsGranted: 1,
      stampBalance: 1, active: true, remainingSeconds: 604_800, replayed: false });
    expect(await store.activateHighRollerClub(playerId, key, now)).toEqual({ ...activation, replayed: true });
    await expect(store.activateHighRollerClub(playerId, randomUUID(), now)).rejects.toBeInstanceOf(HighRollerAlreadyActiveError);

    const beforeProfile = await store.getProfile(playerId);
    const before = beforeProfile.coinBalance;
    const leagueBefore = beforeProfile.balances.find((entry) => entry.currency === "league_point")!.balance;
    const seed = 100n;
    await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "high-roller-test",
      configVersion: 1, baseBet: 10_000, effectiveWager: 10_000, bonusBuy: false, seed }, () => result(0, seed));
    const profile = await store.getProfile(playerId);
    expect(profile.coinBalance).toBe(before - 9_800);
    expect(profile.balances.find((entry) => entry.currency === "league_point")?.balance).toBe(leagueBefore + 100);
    expect((await store.listWalletTransactions(playerId, 200)).some((entry) => entry.reason === "high_roller_cashback")).toBe(true);
  });
});
