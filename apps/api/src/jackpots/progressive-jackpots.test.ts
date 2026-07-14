import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { applyProgressiveAward, jackpotContribution, triggeredJackpotTier } from "./progressive-jackpots.js";

const jackpotSpin: SpinResult = {
  configId: "test", configVersion: 1, mathModelVersion: "test", seed: "1",
  baseBet: 100, wager: 100, bonusBuy: false, stops: [0, 0, 0],
  grid: [["A"], ["A"], ["A"]], wins: [], freeSpinsPlayed: 0,
  rounds: [
    { phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], events: [], totalWin: 10 },
    { phase: "bonus", index: 1, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 500,
      events: [{ type: "bonus.awarded", data: { mode: "jackpot", tier: "MINI", multiplier: 5 } }] },
  ],
  totalWin: 510, maxWinReached: false, maxWinMultiplier: 10_000,
};

describe("progressive jackpots", () => {
  it("detects a configured jackpot bonus and replaces only its placeholder award", () => {
    expect(triggeredJackpotTier(jackpotSpin)).toBe("MINI");
    const awarded = applyProgressiveAward(jackpotSpin, "MINI", 750_000);
    expect(awarded.totalWin).toBe(750_010);
    expect(awarded.rounds[1]?.totalWin).toBe(750_000);
    expect(awarded.rounds[1]?.events[0]?.data.progressiveAmount).toBe(750_000);
  });

  it("allocates deterministic wager contributions to every tier", () => {
    expect(jackpotContribution("MINI", 10_000)).toBe(100);
    expect(jackpotContribution("MINOR", 10_000)).toBe(50);
    expect(jackpotContribution("GRAND", 10_000)).toBe(25);
  });
});
