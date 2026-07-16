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

  it("detects reel-strip wild stacks without changing the settled grid", () => {
    const config = parseSlotConfig({
      id: "stacked-wild-test", version: 1, name: "Stacked Wild Test", rows: 3,
      reels: [["W"], ["A"], ["A"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 3: 1 } },
        W: { kind: "wild", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { stackedWild: { symbol: "W", minimumSize: 2 } },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 5n });
    expect(result.grid[0]).toEqual(["W", "W", "W"]);
    expect(result.rounds[0]!.events).toContainEqual({
      type: "wild.stacked", data: { reel: 0, startRow: 0, size: 3, symbol: "W" },
    });
  });

  it("rejects stacked-wild configurations without a matching reel block", () => {
    expect(() => parseSlotConfig({
      id: "invalid-stacked-wild", version: 1, name: "Invalid Stacked Wild", rows: 3,
      reels: [["W", "A", "A"], ["A"], ["A"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: {} },
        W: { kind: "wild", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { stackedWild: { symbol: "W", minimumSize: 2 } },
    })).toThrow("matching reel-strip stack");
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
      id: "hold-test", version: 1, name: "Hold Test", rows: 2,
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
    expect(bonus?.events[0]?.data).toMatchObject({
      mode: "hold_and_win", spots: 6, respins: 3, boardSize: 6,
    });
    const data = bonus!.events[0]!.data;
    const encoded = `${data.initialSpots};${data.respinSteps}`;
    const awards = [...encoded.matchAll(/(\d+)=(\d+)/g)].map((match) => ({
      position: Number(match[1]), multiplier: Number(match[2]),
    }));
    expect(awards).toHaveLength(6);
    expect(new Set(awards.map((award) => award.position)).size).toBe(6);
    expect(awards.reduce((sum, award) => sum + award.multiplier, 0)).toBe(12);
    expect(String(data.respinSteps).split(";").some((step) => step.startsWith("3:") && step.includes("="))).toBe(true);
    expect(String(data.respinSteps).split(";").slice(-3).map((step) => step.split(":")[0])).toEqual(["2", "1", "0"]);

    const replay = new SlotEngine(config).spin({ bet: 10, seed: 3n });
    expect(replay).toEqual(result);
  });

  it("collects deterministic values from every visible coin", () => {
    const config = parseSlotConfig({
      id: "coin-collect-test", version: 1, name: "Coin Collect Test", rows: 1,
      reels: [["C"], ["C"], ["C"], ["W"]], paylines: [[0,0,0,0]],
      symbols: {
        C: { kind: "coin", payouts: {} },
        W: { kind: "wild", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: {
        coinCollect: {
          coinSymbol: "C", collectorSymbol: "W", minimumCoins: 3, multipliers: [2],
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 31n });
    const collect = result.rounds.find((round) => round.events[0]?.data.mode === "coin_collect");
    expect(collect?.totalWin).toBe(60);
    expect(collect?.events[0]).toEqual({
      type: "bonus.awarded",
      data: {
        amount: 60, multiplier: 6, mode: "coin_collect",
        coinCount: 3, collectorCount: 1, coins: "0=2,1=2,2=2",
      },
    });
    expect(new SlotEngine(config).spin({ bet: 10, seed: 31n })).toEqual(result);
  });

  it("collects coins that land during a free-spin round", () => {
    const config = parseSlotConfig({
      id: "free-spin-coin-collect", version: 1, name: "Free Spin Coin Collect", rows: 1,
      reels: [["S"], ["S"], ["S"], ["S"]], paylines: [[0,0,0,0]],
      symbols: {
        C: { kind: "coin", payouts: {} },
        S: { kind: "scatter", payouts: {} },
        W: { kind: "wild", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: {
        freeSpins: {
          scatterSymbol: "S", awards: { 4: 1 }, maxTotal: 1,
          reelStrips: [["C"], ["C"], ["C"], ["W"]],
        },
        coinCollect: {
          coinSymbol: "C", collectorSymbol: "W", minimumCoins: 3, multipliers: [3],
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 37n });
    const collect = result.rounds.find((round) => round.events[0]?.data.mode === "coin_collect");
    expect(result.freeSpinsPlayed).toBe(1);
    expect(collect?.totalWin).toBe(90);
    expect(collect?.events[0]?.data).toMatchObject({
      mode: "coin_collect", coinCount: 3, collectorCount: 1, multiplier: 9,
    });
  });

  it("rejects hold-and-win spot ranges that cannot fit the grid", () => {
    expect(() => parseSlotConfig({
      id: "invalid-hold", version: 1, name: "Invalid Hold", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0,0,0]],
      symbols: { S: { kind: "scatter", payouts: {} } },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        holdAndWinBonus: { scatterSymbol: "S", minimumCount: 3, spotRange: [3, 4], multipliers: [1, 2] },
      },
    })).toThrow("fit the configured grid");
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

  it("selects MAJOR between the lower tiers and GRAND", () => {
    const config = parseSlotConfig({
      id: "major-jackpot-test", version: 1, name: "Major Jackpot Test", rows: 1,
      reels: [["S"], ["S"], ["S"], ["S"], ["S"], ["A"]], paylines: [[0,0,0,0,0,0]],
      symbols: {
        A: { kind: "regular", payouts: {} },
        S: { kind: "scatter", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        jackpots: {
          scatterSymbol: "S",
          tiers: [
            { name: "MINI", minimumCount: 3, multiplier: 5 },
            { name: "MINOR", minimumCount: 4, multiplier: 25 },
            { name: "MAJOR", minimumCount: 5, multiplier: 100 },
            { name: "GRAND", minimumCount: 6, multiplier: 500 },
          ],
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 11n });
    expect(result.rounds.at(-1)?.events[0]).toEqual({
      type: "bonus.awarded",
      data: { amount: 1_000, multiplier: 100, mode: "jackpot", tier: "MAJOR", scatterCount: 5 },
    });
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

describe("configurable evaluation and feature modifiers", () => {
  it("evaluates deterministic all-ways combinations from the leftmost reel", () => {
    const config = parseSlotConfig({
      id: "ways-test", version: 1, name: "Ways Test", rows: 2,
      reels: [["A"], ["A"], ["A"]], paylines: [[0, 0, 0]],
      symbols: { A: { kind: "regular", payouts: { 3: 5 } } },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: { ways: { minimumReels: 3, betDivisor: 8 } },
    });
    const result = new SlotEngine(config).spin({ bet: 100, seed: 17n });
    expect(result.wins).toContainEqual({
      kind: "ways", symbol: "A", count: 3, ways: 8, amount: 500,
      cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
    });
    expect(result.rounds[0]!.events).toContainEqual({
      type: "ways.win", data: { symbol: "A", count: 3, ways: 8 },
    });
  });

  it("lets a leading wild substitute for a symbol introduced on a later reel", () => {
    const config = parseSlotConfig({
      id: "ways-leading-wild", version: 1, name: "Ways Leading Wild", rows: 1,
      reels: [["W"], ["B"], ["B"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 3: 2 } },
        B: { kind: "regular", payouts: { 3: 3 } },
        W: { kind: "wild", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 1 },
      features: { ways: { minimumReels: 3, betDivisor: 1 } },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 19n });
    expect(result.wins).toContainEqual({
      kind: "ways", symbol: "B", count: 3, ways: 1, amount: 30,
      cells: [[0, 0], [1, 0], [2, 0]],
    });
    expect(result.wins.some((win) => win.kind === "ways" && win.symbol === "A")).toBe(false);
  });

  it("reveals mystery symbols before authoritative win evaluation", () => {
    const config = parseSlotConfig({
      id: "mystery-test", version: 1, name: "Mystery Test", rows: 1,
      reels: [["M"], ["M"], ["M"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 3: 4 } },
        M: { kind: "mystery", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: { mysteryReveal: { symbol: "M", targets: ["A"] } },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 9n });
    expect(result.grid).toEqual([["A"], ["A"], ["A"]]);
    expect(result.totalWin).toBe(40);
    expect(result.rounds[0]!.events).toContainEqual({
      type: "mystery.revealed", data: { symbol: "M", target: "A", count: 3 },
    });
  });

  it("upgrades configured symbols before authoritative win evaluation", () => {
    const config = parseSlotConfig({
      id: "symbol-upgrade-test", version: 1, name: "Symbol Upgrade Test", rows: 2,
      reels: [["B", "J"], ["B", "J"], ["B", "J"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 3: 4 } },
        J: { kind: "regular", payouts: { 3: 1 } },
        B: { kind: "scatter", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        ways: { minimumReels: 3, betDivisor: 1 },
        symbolUpgrade: {
          triggerSymbol: "B", minimumCount: 3,
          upgrades: [{ from: "J", to: "A" }],
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 29n });
    expect(result.grid.flat()).not.toContain("J");
    expect(result.wins).toContainEqual(expect.objectContaining({ kind: "ways", symbol: "A", count: 3 }));
    expect(result.rounds[0]!.events).toContainEqual({
      type: "symbol.upgraded", data: { from: "J", to: "A", count: 3, triggerCount: 3 },
    });
  });

  it("rejects symbol upgrades with duplicate source symbols", () => {
    expect(() => parseSlotConfig({
      id: "invalid-symbol-upgrade", version: 1, name: "Invalid Symbol Upgrade", rows: 1,
      reels: [["B"], ["B"], ["B"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: {} },
        J: { kind: "regular", payouts: {} },
        B: { kind: "scatter", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        symbolUpgrade: {
          triggerSymbol: "B", minimumCount: 3,
          upgrades: [{ from: "J", to: "A" }, { from: "J", to: "A" }],
        },
      },
    })).toThrow("sources must be unique");
  });

  it("uses special free-spin reels and injects deterministic extra wilds", () => {
    const config = parseSlotConfig({
      id: "enhanced-free-spins", version: 1, name: "Enhanced Free Spins", rows: 1,
      reels: [["S"], ["S"], ["S"]], paylines: [[0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 3: 3 } },
        W: { kind: "wild", payouts: {} },
        S: { kind: "scatter", payouts: {} },
      },
      math: { targetRtp: 0.9, volatility: "high", expectedHitFrequency: 1 },
      features: {
        freeSpins: {
          scatterSymbol: "S", awards: { 3: 1 }, maxTotal: 1,
          reelStrips: [["A"], ["A"], ["A"]],
          extraWilds: { symbol: "W", count: 1 },
        },
      },
    });
    const result = new SlotEngine(config).spin({ bet: 10, seed: 23n });
    const freeSpin = result.rounds.find((round) => round.phase === "free_spin")!;
    expect(freeSpin.grid.flat().filter((symbol) => symbol === "W")).toHaveLength(1);
    expect(freeSpin.events).toContainEqual({
      type: "free_spins.modified", data: { mode: "extra_wilds", symbol: "W", count: 1 },
    });
    expect(freeSpin.events).toContainEqual({
      type: "free_spins.modified", data: { mode: "special_reels" },
    });
    expect(result).toEqual(new SlotEngine(config).spin({ bet: 10, seed: 23n }));
  });
});
