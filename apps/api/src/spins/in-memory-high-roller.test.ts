import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";
import { HighRollerAlreadyActiveError } from "./spin-store.js";

function result(totalWin: number): SpinResult {
  return {
    configId: "high-roller-test", configVersion: 1, mathModelVersion: "test", seed: "1",
    baseBet: 10_000, wager: 10_000, bonusBuy: false, stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
    wins: [], rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin, events: [] }],
    freeSpinsPlayed: 0, totalWin, maxWinReached: false, maxWinMultiplier: 1_000,
  };
}

describe("InMemorySpinStore High Roller Club", () => {
  it("activates seven-day access once and applies member spin benefits", async () => {
    const store = new InMemorySpinStore(500_000);
    const playerId = randomUUID();
    for (let index = 0; index < 19; index += 1) {
      await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "high-roller-test",
        configVersion: 1, bet: 10_000, seed: BigInt(index) }, () => result(10_000));
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
    await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "high-roller-test",
      configVersion: 1, bet: 10_000, seed: 100n }, () => result(0));
    const profile = await store.getProfile(playerId);
    expect(profile.coinBalance).toBe(before - 9_800);
    expect(profile.balances.find((entry) => entry.currency === "league_point")?.balance).toBe(leagueBefore + 100);
    expect((await store.listWalletTransactions(playerId, 200)).some((entry) => entry.reason === "high_roller_cashback")).toBe(true);
  });
});
