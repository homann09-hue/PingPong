import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";
import { BoosterActionConflictError, CheckWinNotClaimableError } from "./spin-store.js";

const winningSpin: SpinResult = {
  configId: "check-win-test", configVersion: 1, mathModelVersion: "test",
  seed: "42", baseBet: 10, wager: 10, bonusBuy: false,
  stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
  wins: [{ kind: "line", payline: 0, symbol: "A", count: 3, amount: 5, cells: [[0, 0], [1, 0], [2, 0]] }],
  rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 5, events: [] }],
  freeSpinsPlayed: 0, totalWin: 5, maxWinReached: false, maxWinMultiplier: 1_000,
};

async function awardWins(store: InMemorySpinStore, playerId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "check-win-test",
      configVersion: 1, bet: 10, seed: BigInt(index) }, () => winningSpin);
  }
}

describe("InMemorySpinStore Check-&-Win", () => {
  it("consumes five earned win marks and grants coins plus a stamp exactly once", async () => {
    const store = new InMemorySpinStore(1_000);
    const playerId = randomUUID();
    await awardWins(store, playerId, 5);
    expect(await store.getCheckWinStatus(playerId)).toMatchObject({ marks: 5, claimable: true });
    const key = randomUUID();
    const first = await store.claimCheckWin(playerId, key);
    const replay = await store.claimCheckWin(playerId, key);
    expect(first).toMatchObject({ marksSpent: 5, coins: 100_000, stamps: 1,
      coinBalance: 100_975, markBalance: 0, stampBalance: 1, replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    expect((await store.listWalletTransactions(playerId, 100))
      .filter((entry) => entry.source === "check_win")).toHaveLength(3);
    await expect(store.claimCheckWin(playerId, randomUUID()))
      .rejects.toBeInstanceOf(CheckWinNotClaimableError);
  });

  it("crafts and activates a replay-safe XP booster that is consumed by settled spins", async () => {
    const store = new InMemorySpinStore(10_000);
    const playerId = randomUUID();
    await awardWins(store, playerId, 15);
    for (let claim = 0; claim < 3; claim += 1) await store.claimCheckWin(playerId, randomUUID());
    expect(await store.getBoosterStatus(playerId)).toMatchObject({ stamps: 3, boosters: 0, canCraft: true });

    const craftKey = randomUUID();
    const craft = await store.craftBooster(playerId, craftKey);
    expect(await store.craftBooster(playerId, craftKey)).toEqual({ ...craft, replayed: true });
    await expect(store.activateBooster(playerId, craftKey)).rejects.toBeInstanceOf(BoosterActionConflictError);
    const activationKey = randomUUID();
    const activation = await store.activateBooster(playerId, activationKey);
    expect(activation).toMatchObject({ boosterBalance: 0, activeSpins: 20, replayed: false });
    expect(await store.activateBooster(playerId, activationKey)).toEqual({ ...activation, replayed: true });

    const before = (await store.getProfile(playerId)).progression.xp;
    await awardWins(store, playerId, 1);
    expect((await store.getProfile(playerId)).progression.xp).toBe(before + 20);
    expect(await store.getBoosterStatus(playerId)).toMatchObject({ activeSpins: 19, xpMultiplier: 2 });
    expect((await store.listWalletTransactions(playerId, 100))
      .filter((entry) => entry.source === "xp_booster")).toHaveLength(3);
  });
});
