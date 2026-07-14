import { describe, expect, it } from "vitest";
import { classicConfig } from "./classic-config.js";
import { SlotEngine } from "./engine.js";
import { DeterministicRng } from "./rng.js";
import { auroraConfig } from "./aurora-config.js";
import { parseSlotConfig } from "./config.js";

describe("deterministic RNG", () => {
  it("replays the same sequence", () => {
    const a = new DeterministicRng(42n); const b = new DeterministicRng(42n);
    expect(Array.from({ length: 100 }, () => a.nextUint64())).toEqual(Array.from({ length: 100 }, () => b.nextUint64()));
  });
  it("rejects invalid bounds", () => expect(() => new DeterministicRng(1n).nextInt(0)).toThrow(RangeError));
});

describe("configuration-driven layouts", () => {
  it("renders a 5x3 game without engine changes", () => {
    const result = new SlotEngine(auroraConfig).spin({ bet: 10, seed: 99n });
    expect(result.grid).toHaveLength(5);
    expect(result.grid.every((reel) => reel.length === 3)).toBe(true);
    expect(result.stops).toHaveLength(5);
  });

  it("runs bounded free spins and emits presentation events", () => {
    const config = parseSlotConfig({
      id: "feature-test", version: 1, name: "Feature Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 2 } } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { freeSpins: { scatterSymbol: "S", awards: { 3: 2 }, maxTotal: 3 } },
    });
    const result = new SlotEngine(config).spin({ bet: 5, seed: 1n });
    expect(result.freeSpinsPlayed).toBe(3);
    expect(result.rounds.filter((round) => round.phase === "free_spin")).toHaveLength(3);
    expect(result.totalWin).toBe(40);
    expect(result.rounds.flatMap((round) => round.events).some((event) => event.type === "free_spins.awarded")).toBe(true);
  });

  it("expands configured wilds and bounds cascade depth", () => {
    const config = parseSlotConfig({
      id: "cascade-test", version: 1, name: "Cascade Test", rows: 3,
      reels: [["W"], ["A"], ["A"]], paylines: [[0,0,0], [1,1,1], [2,2,2]],
      symbols: { A: { kind: "regular", payouts: { 3: 1 } }, W: { kind: "wild", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { expandingWild: { symbols: ["W"] }, cascades: { maxSteps: 2 } },
    });
    const result = new SlotEngine(config).spin({ bet: 1, seed: 1n });
    expect(result.grid[0]).toEqual(["W", "W", "W"]);
    expect(result.rounds.filter((round) => round.phase === "cascade")).toHaveLength(2);
    expect(result.rounds[0]!.events.some((event) => event.type === "wild.expanded")).toBe(true);
  });

  it("settles deterministic pick bonuses as server-authoritative rounds", () => {
    const config = parseSlotConfig({
      id: "bonus-test", version: 1, name: "Bonus Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 2 } } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { pickBonus: { scatterSymbol: "S", minimumCount: 3, multipliers: [7] } },
    });
    const result = new SlotEngine(config).spin({ bet: 5, seed: 1n });
    const bonus = result.rounds.find((round) => round.phase === "bonus");
    expect(bonus?.totalWin).toBe(35);
    expect(bonus?.events[0]).toEqual({ type: "bonus.awarded", data: { amount: 35, multiplier: 7, mode: "pick" } });
    expect(result.totalWin).toBe(45);
  });

  it("settles wheel bonuses with a reproducible segment", () => {
    const config = parseSlotConfig({
      id: "wheel-test", version: 1, name: "Wheel Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 1 } } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { wheelBonus: { scatterSymbol: "S", minimumCount: 3, multipliers: [5, 5] } },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 2n });
    const bonus = result.rounds.find((round) => round.phase === "bonus");
    expect(bonus?.totalWin).toBe(50);
    expect(bonus?.events[0]?.data.mode).toBe("wheel");
    expect(bonus?.events[0]?.data.segment).toBeTypeOf("number");
  });

  it("bounds and settles hold-and-win spot awards", () => {
    const config = parseSlotConfig({
      id: "hold-test", version: 1, name: "Hold Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 1 } } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        holdAndWinBonus: { scatterSymbol: "S", minimumCount: 3, spotRange: [6, 6], multipliers: [2, 2] },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 3n });
    const bonus = result.rounds.find((round) => round.phase === "bonus");
    expect(bonus?.totalWin).toBe(120);
    expect(bonus?.events[0]?.data).toMatchObject({ mode: "hold_and_win", spots: 6, respins: 3 });
  });

  it("keeps sticky wild positions throughout a bounded free-spin sequence", () => {
    const config = parseSlotConfig({
      id: "sticky-test", version: 1, name: "Sticky Test", rows: 2,
      reels: [["S", "W"], ["S", "W"], ["S", "W"]], paylines: [[0,0,0], [1,1,1]],
      symbols: { S: { kind: "scatter", payouts: {} }, W: { kind: "wild", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        stickyWild: { symbol: "W", maxSticky: 6 },
        freeSpins: { scatterSymbol: "S", awards: { 3: 2 }, maxTotal: 2 },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 1, seed: 9n });
    const freeRounds = result.rounds.filter((round) => round.phase === "free_spin");
    expect(freeRounds).toHaveLength(2);
    expect(freeRounds.every((round) => round.events.some((event) => event.type === "wild.stuck"))).toBe(true);
    expect(freeRounds[1]!.grid.flat().filter((symbol) => symbol === "W").length).toBeGreaterThanOrEqual(3);
  });

  it("moves walking wilds across deterministic respin rounds", () => {
    const config = parseSlotConfig({
      id: "walking-test", version: 1, name: "Walking Test", rows: 1,
      reels: [["A"], ["A"], ["A"], ["A"], ["W"]], paylines: [[0,0,0,0,0]],
      symbols: { A: { kind: "regular", payouts: { 5: 1 } }, W: { kind: "wild", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: { walkingWild: { symbol: "W", direction: "left", maxSteps: 4 } },
    });
    const result = new SlotEngine(config).spin({ bet: 1, seed: 4n });
    const respins = result.rounds.filter((round) => round.phase === "respin");
    expect(respins).toHaveLength(4);
    expect(respins.map((round) => round.grid.findIndex((reel) => reel[0] === "W"))).toEqual([3, 2, 1, 0]);
    expect(respins.every((round) => round.events.some((event) => event.type === "wild.walked"))).toBe(true);
  });

  it("awards a configured fixed number of symbol-triggered respins", () => {
    const config = parseSlotConfig({
      id: "respin-test", version: 1, name: "Respin Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 1 } } },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: { respins: { triggerSymbol: "S", minimumCount: 3, count: 2 } },
    });
    const result = new SlotEngine(config).spin({ bet: 2, seed: 5n });
    expect(result.rounds.filter((round) => round.phase === "respin")).toHaveLength(2);
    expect(result.totalWin).toBe(6);
  });

  it("forces only configured bonus games through a reproducible play-money bonus buy", () => {
    const config = parseSlotConfig({
      id: "buy-test", version: 1, name: "Buy Test", rows: 1,
      reels: [["A"], ["A"], ["A"]], paylines: [[0,0,0]],
      symbols: { A: { kind: "regular", payouts: { 3: 1 } }, S: { kind: "scatter", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        wheelBonus: { scatterSymbol: "S", minimumCount: 3, multipliers: [5, 10] },
        bonusBuy: { costMultiplier: 50 },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 7n, bonusBuy: true });
    expect(result.bonusBuy).toBe(true);
    expect(result.wager).toBe(500);
    expect(result.rounds.some((round) => round.phase === "bonus")).toBe(true);
    expect(() => new SlotEngine(classicConfig).spin({ bet: 1, seed: 1n, bonusBuy: true })).toThrow("not configured");
  });

  it("applies and caps configured wild multipliers on winning paylines", () => {
    const config = parseSlotConfig({
      id: "multiplier-test", version: 1, name: "Multiplier Test", rows: 1,
      reels: [["W"], ["W"], ["A"]], paylines: [[0,0,0]],
      symbols: { A: { kind: "regular", payouts: { 3: 1 } }, W: { kind: "wild", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { wildMultiplier: { symbol: "W", multiplier: 2, maxTotalMultiplier: 3 } },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 8n });
    expect(result.totalWin).toBe(30);
    expect(result.rounds[0]!.events).toContainEqual({
      type: "multiplier.applied",
      data: { payline: 0, direction: "left", symbol: "W", wildCount: 2, multiplier: 3 },
    });
  });

  it("treats the wager as total bet across all enabled paylines", () => {
    const config = parseSlotConfig({
      id: "total-bet-test", version: 1, name: "Total Bet Test", rows: 1,
      reels: [["A"], ["A"], ["A"]], paylines: [[0,0,0], [0,0,0]],
      symbols: { A: { kind: "regular", payouts: { 3: 10 } } },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
    });
    const result = new SlotEngine(config).spin({ bet: 100, seed: 10n });
    expect(result.wager).toBe(100);
    expect(result.totalWin).toBe(1_000);
    expect(result.wins).toHaveLength(2);
  });

  it("pays all-wild lines and evaluates optional right-to-left wins", () => {
    const config = parseSlotConfig({
      id: "both-ways-test", version: 1, name: "Both Ways Test", rows: 1,
      reels: [["W"], ["W"], ["W"], ["B"], ["B"]], paylines: [[0,0,0,0,0]],
      symbols: {
        W: { kind: "wild", payouts: { 3: 5 } },
        B: { kind: "regular", payouts: { 5: 3 } },
      },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: { bothWays: true },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 11n });
    expect(result.wins).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "W", count: 3, direction: "left", amount: 50 }),
      expect.objectContaining({ symbol: "B", count: 5, direction: "right", amount: 30 }),
    ]));
  });

  it("enforces configured bet steps and terminates settlement at max win", () => {
    const config = parseSlotConfig({
      id: "max-win-test", version: 1, name: "Max Win Test", rows: 1,
      reels: [["A"], ["A"], ["A"]], paylines: [[0,0,0]],
      symbols: { A: { kind: "regular", payouts: { 3: 1_000 } } },
      bet: { min: 5, max: 10, steps: [5, 10] },
      math: {
        targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1,
        maxWinMultiplier: 10, mathModelVersion: "2.1.0",
      },
    });
    const result = new SlotEngine(config).spin({ bet: 5, seed: 12n });
    expect(result.totalWin).toBe(50);
    expect(result.maxWinReached).toBe(true);
    expect(result.winClass).toBe("MAX");
    expect(result.rounds.at(-1)?.events).toContainEqual({
      type: "max_win.reached", data: { multiplier: 10, amount: 50 },
    });
    expect(() => new SlotEngine(config).spin({ bet: 7, seed: 12n })).toThrow("configured stake step");
  });

  it("awards the highest eligible configured jackpot tier", () => {
    const config = parseSlotConfig({
      id: "jackpot-test", version: 1, name: "Jackpot Test", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: { 3: 2 } } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        jackpots: {
          scatterSymbol: "S",
          tiers: [
            { name: "MINI", minimumCount: 2, multiplier: 5 },
            { name: "GRAND", minimumCount: 3, multiplier: 500 },
          ],
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 9n });
    const jackpot = result.rounds.find(
      (round) => round.phase === "bonus" && round.events[0]?.data.mode === "jackpot",
    );
    expect(jackpot?.totalWin).toBe(5_000);
    expect(jackpot?.events[0]).toEqual({
      type: "bonus.awarded",
      data: { amount: 5_000, multiplier: 500, mode: "jackpot", tier: "GRAND", scatterCount: 3 },
    });
    expect(result.totalWin).toBe(5_020);
  });
});

describe("SlotEngine", () => {
  const engine = new SlotEngine(classicConfig);
  it("reproduces a spin exactly", () => expect(engine.spin({ bet: 5, seed: 123n })).toEqual(engine.spin({ bet: 5, seed: 123n })));
  it("keeps all generated cells inside configured symbols", () => {
    for (let seed = 0n; seed < 1_000n; seed++) {
      const result = engine.spin({ bet: 1, seed });
      expect(result.grid).toHaveLength(3);
      expect(result.grid.flat().every((symbol) => symbol in classicConfig.symbols)).toBe(true);
    }
  });
  it("preserves integer wallet arithmetic", () => {
    for (let seed = 0n; seed < 10_000n; seed++) expect(Number.isSafeInteger(engine.spin({ bet: 7, seed }).totalWin)).toBe(true);
  });
});
