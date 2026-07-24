import { describe, expect, it } from "vitest";
import type { SpinResult, Win } from "@aurora/slot-engine";
import { applyProgressiveAward, jackpotContribution, triggeredJackpotTier } from "./progressive-jackpots.js";

const baseWin: Win = {
  kind: "line",
  payline: 0,
  direction: "left",
  symbol: "A",
  count: 3,
  amount: 10,
  cells: [[0, 0], [1, 0], [2, 0]],
};

const sideWin: Win = {
  kind: "scatter",
  symbol: "BONUS",
  count: 3,
  amount: 25,
  cells: [],
};

const placeholderWin: Win = {
  kind: "scatter",
  symbol: "JACKPOT_MINI",
  count: 1,
  amount: 500,
  cells: [],
};

const jackpotSpin: SpinResult = {
  configId: "test",
  configVersion: 1,
  mathModelVersion: "test",
  seed: "1",
  baseBet: 100,
  wager: 100,
  bonusBuy: false,
  stops: [0, 0, 0],
  grid: [["A"], ["A"], ["A"]],
  wins: [baseWin, sideWin, placeholderWin],
  freeSpinsPlayed: 0,
  rounds: [
    {
      phase: "base",
      index: 0,
      grid: [["A"], ["A"], ["A"]],
      wins: [baseWin],
      events: [],
      totalWin: 10,
    },
    {
      phase: "bonus",
      index: 1,
      grid: [["A"], ["A"], ["A"]],
      wins: [sideWin, placeholderWin],
      totalWin: 525,
      events: [
        {
          type: "bonus.awarded",
          data: { mode: "jackpot", tier: "MINI", multiplier: 5 },
        },
      ],
    },
  ],
  totalWin: 535,
  maxWinReached: false,
  maxWinMultiplier: 10_000,
};

function expectSettlementInvariants(spin: SpinResult): void {
  expect(spin.rounds.reduce((sum, round) => sum + round.totalWin, 0)).toBe(spin.totalWin);
  expect(spin.rounds.flatMap((round) => round.wins)).toEqual(spin.wins);
  expect(spin.wins.reduce((sum, win) => sum + win.amount, 0)).toBe(spin.totalWin);
  for (const round of spin.rounds) {
    expect(round.wins.reduce((sum, win) => sum + win.amount, 0)).toBe(round.totalWin);
  }
}

describe("progressive jackpots", () => {
  it("replaces only the matching placeholder and preserves unrelated wins", () => {
    expect(triggeredJackpotTier(jackpotSpin)).toBe("MINI");

    const awarded = applyProgressiveAward(jackpotSpin, "MINI", 750_000);

    expect(awarded.totalWin).toBe(750_035);
    expect(awarded.rounds[0]).toBe(jackpotSpin.rounds[0]);
    expect(awarded.rounds[1]?.totalWin).toBe(750_025);
    expect(awarded.rounds[1]?.wins).toEqual([
      sideWin,
      expect.objectContaining({
        kind: "scatter",
        symbol: "JACKPOT_MINI",
        amount: 750_000,
      }),
    ]);
    expect(awarded.rounds[1]?.events[0]?.data.progressiveAmount).toBe(750_000);
    expect(jackpotSpin.rounds[1]?.totalWin).toBe(525);
    expect(jackpotSpin.rounds[1]?.events[0]?.data.progressiveAmount).toBeUndefined();
    expectSettlementInvariants(awarded);
  });

  it("creates an explicit jackpot win for the current engine placeholder-total shape", () => {
    const engineSpin: SpinResult = {
      ...jackpotSpin,
      wins: [baseWin],
      rounds: [
        jackpotSpin.rounds[0]!,
        {
          ...jackpotSpin.rounds[1]!,
          wins: [],
          totalWin: 500,
        },
      ],
      totalWin: 510,
    };

    const awarded = applyProgressiveAward(engineSpin, "MINI", 750_000);

    expect(awarded.rounds[1]?.wins).toEqual([
      expect.objectContaining({ symbol: "JACKPOT_MINI", amount: 750_000 }),
    ]);
    expect(awarded.rounds[1]?.totalWin).toBe(750_000);
    expect(awarded.totalWin).toBe(750_010);
    expectSettlementInvariants(awarded);
  });

  it("recognizes MAJOR as a settleable progressive tier", () => {
    const majorSpin: SpinResult = {
      ...jackpotSpin,
      wins: [baseWin],
      rounds: [
        jackpotSpin.rounds[0]!,
        {
          ...jackpotSpin.rounds[1]!,
          wins: [],
          totalWin: 15_000_000,
          events: [
            {
              type: "bonus.awarded",
              data: { mode: "jackpot", tier: "MAJOR", multiplier: 150_000 },
            },
          ],
        },
      ],
      totalWin: 15_000_010,
    };

    expect(triggeredJackpotTier(majorSpin)).toBe("MAJOR");

    const awarded = applyProgressiveAward(majorSpin, "MAJOR", 15_500_000);
    expect(awarded.totalWin).toBe(15_500_010);
    expectSettlementInvariants(awarded);
  });

  it("returns the original result when the requested tier was not triggered", () => {
    expect(applyProgressiveAward(jackpotSpin, "GRAND", 50_000_000)).toBe(jackpotSpin);
  });

  it("rejects negative, fractional, non-finite, and unsafe awards", () => {
    for (const amount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => applyProgressiveAward(jackpotSpin, "MINI", amount)).toThrow(RangeError);
    }
  });

  it("allocates deterministic wager contributions to every tier", () => {
    expect(jackpotContribution("MINI", 10_000)).toBe(100);
    expect(jackpotContribution("MINOR", 10_000)).toBe(50);
    expect(jackpotContribution("MAJOR", 10_000)).toBe(35);
    expect(jackpotContribution("GRAND", 10_000)).toBe(25);
  });
});
