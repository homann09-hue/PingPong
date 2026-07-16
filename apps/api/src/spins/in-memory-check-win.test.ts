import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";
import { CheckWinNotClaimableError } from "./spin-store.js";

describe("InMemorySpinStore Check-&-Win", () => {
  it("consumes five earned win marks and grants coins plus a stamp exactly once", async () => {
    const store = new InMemorySpinStore(1_000);
    const playerId = randomUUID();
    const winningSpin: SpinResult = {
      configId: "check-win-test", configVersion: 1, mathModelVersion: "test",
      seed: "42", baseBet: 10, wager: 10, bonusBuy: false,
      stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
      wins: [{ kind: "line", payline: 0, symbol: "A", count: 3, amount: 5, cells: [[0, 0], [1, 0], [2, 0]] }],
      rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 5, events: [] }],
      freeSpinsPlayed: 0, totalWin: 5, maxWinReached: false, maxWinMultiplier: 1_000,
    };
    for (let index = 0; index < 5; index += 1) {
      await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "check-win-test",
        configVersion: 1, bet: 10, seed: BigInt(index) }, () => winningSpin);
    }
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
});
