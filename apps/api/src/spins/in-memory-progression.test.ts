import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";

const losingSpin: SpinResult = {
  configId: "progression-test",
  configVersion: 1,
  mathModelVersion: "test",
  seed: "1",
  baseBet: 10_000,
  wager: 10_000,
  bonusBuy: false,
  stops: [0, 0, 0],
  grid: [["A"], ["A"], ["A"]],
  wins: [],
  rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 0, events: [] }],
  freeSpinsPlayed: 0,
  totalWin: 0,
  maxWinReached: false,
  maxWinMultiplier: 1_000,
};

describe("InMemorySpinStore progression curve", () => {
  it("uses the shared curve for multi-level settlement and idempotent replay", async () => {
    const store = new InMemorySpinStore(100_000);
    const playerId = randomUUID();
    const idempotencyKey = randomUUID();
    const command = {
      playerId,
      idempotencyKey,
      slotId: "progression-test",
      configVersion: 1,
      bet: 10_000,
      seed: 1n,
    };

    const first = await store.settle(command, () => losingSpin);
    const replay = await store.settle(command, () => { throw new Error("must not recalculate"); });

    expect(first.progression).toMatchObject({
      level: 14,
      xp: 133,
      spins: 1,
      totalWon: 0,
      freeSpins: 0,
      vipPoints: 2_550,
    });
    expect(replay).toEqual(first);
    expect((await store.getHighRollerClub(playerId, new Date())).points).toBe(2_100);
  });
});
