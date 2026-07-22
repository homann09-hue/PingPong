import { parseSlotConfig } from "./config.js";
import type { FeatureConfig } from "./types.js";

type Volatility = "low" | "medium" | "high" | "very_high";
type Paytable = Readonly<Record<"A" | "K" | "Q" | "J" | "W" | "X" | "Y" | "Z" | "T", readonly [number, number, number]>>;

const lines = [
  [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0],
  [2,1,1,1,2], [0,1,0,1,0], [2,1,2,1,2], [1,0,1,2,1], [1,2,1,0,1],
  [0,2,0,2,0], [2,0,2,0,2], [0,2,2,2,0], [2,0,0,0,2], [1,0,2,0,1],
] as const;

const balanced: Paytable = {
  A: [4, 12, 50], K: [3, 10, 35], Q: [2, 8, 25], J: [2, 6, 18], W: [5, 20, 100],
  X: [1, 4, 12], Y: [1, 3, 10], Z: [1, 3, 9], T: [1, 2, 8],
};
const highVariance: Paytable = {
  A: [4, 15, 100], K: [3, 10, 55], Q: [2, 7, 30], J: [2, 5, 20], W: [5, 25, 180],
  X: [1, 3, 12], Y: [1, 3, 10], Z: [1, 2, 8], T: [1, 2, 7],
};
const frequentWins: Paytable = {
  A: [3, 6, 15], K: [3, 5, 12], Q: [2, 4, 10], J: [2, 4, 9], W: [4, 10, 30],
  X: [2, 3, 7], Y: [2, 3, 7], Z: [2, 3, 6], T: [2, 3, 6],
};

const calibratedHitFrequency: Readonly<Record<string, number>> = {
  "pharaoh-oasis": 0.39,
  "dragon-peak": 0.321,
  "candy-carnival": 0.63,
  "pirate-bay": 0.299,
  "neon-nights": 0.485,
  "frozen-kingdom": 0.467,
  "jungle-temple": 0.323,
  "vegas-gold": 0.52,
  "midnight-saloon": 0.424,
  "cosmic-voyage": 0.496,
};

function scalePaytable(paytable: Paytable, factor: number): Paytable {
  return Object.fromEntries(Object.entries(paytable).map(([symbol, payouts]) => [
    symbol,
    payouts.map((value) => Math.max(1, Math.round(value * factor))),
  ])) as unknown as Paytable;
}

const neonMultiplierPaytable: Paytable = {
  ...scalePaytable(balanced, 2.5),
  X: [2, 10, 30],
};

function reelStrips(
  patterns: readonly [string, string, string, string, string],
  rotation = 0,
  preserveRuns: readonly string[] = [],
): string[][] {
  const lowSymbols = ["X", "Y", "Z", "T"] as const;
  return patterns.map((pattern, reel) => {
    const source = [...pattern];
    const strip = source.flatMap((symbol, position) => [
      symbol,
      ...(preserveRuns.includes(symbol) && source[position + 1] === symbol
        ? []
        : [lowSymbols[(position + reel) % lowSymbols.length]!]),
    ]);
    const offset = rotation % strip.length;
    return [...strip.slice(offset), ...strip.slice(0, offset)];
  });
}

function symbols(
  paytable: Paytable,
  includeCoin = false,
  includeMultiplier = false,
  includeMystery = false,
) {
  const payout = (values: readonly [number, number, number]) => ({ 3: values[0], 4: values[1], 5: values[2] });
  return {
    A: { kind: "regular" as const, payouts: payout(paytable.A) },
    K: { kind: "regular" as const, payouts: payout(paytable.K) },
    Q: { kind: "regular" as const, payouts: payout(paytable.Q) },
    J: { kind: "regular" as const, payouts: payout(paytable.J) },
    W: { kind: "wild" as const, payouts: payout(paytable.W) },
    X: { kind: "regular" as const, payouts: payout(paytable.X) },
    Y: { kind: "regular" as const, payouts: payout(paytable.Y) },
    Z: { kind: "regular" as const, payouts: payout(paytable.Z) },
    T: { kind: "regular" as const, payouts: payout(paytable.T) },
    S: { kind: "scatter" as const, payouts: { 3: 2, 4: 8, 5: 30 } },
    B: { kind: "scatter" as const, payouts: {} },
    ...(includeCoin ? { C: { kind: "coin" as const, payouts: {} } } : {}),
    ...(includeMultiplier ? { M: { kind: "multiplier" as const, payouts: {} } } : {}),
    ...(includeMystery ? { R: { kind: "mystery" as const, payouts: {} } } : {}),
  };
}

function game(
  id: string,
  name: string,
  volatility: Volatility,
  reels: string[][],
  paytable: Paytable,
  features: FeatureConfig,
  release: { readonly version?: number; readonly mathModelVersion?: string; readonly rows?: number } = {},
) {
  return parseSlotConfig({
    id, name, version: release.version ?? 2, rows: release.rows ?? 3, reels, paylines: lines,
    symbols: symbols(
      paytable,
      reels.some((strip) => strip.includes("C")),
      reels.some((strip) => strip.includes("M")),
      reels.some((strip) => strip.includes("R")),
    ),
    bet: { min: 100, max: 10_000, steps: [100, 200, 500, 1_000, 2_000, 5_000, 10_000] },
    math: {
      targetRtp: 0.94,
      volatility,
      expectedHitFrequency: calibratedHitFrequency[id]!,
      maxWinMultiplier: volatility === "low" ? 1_000 : volatility === "medium" ? 2_500 : volatility === "high" ? 5_000 : 10_000,
      mathModelVersion: release.mathModelVersion ?? "2.0.0",
    },
    winClasses: [
      { name: "SMALL", minimumMultiplier: 1 },
      { name: "NICE", minimumMultiplier: 5 },
      { name: "BIG", minimumMultiplier: 15 },
      { name: "MEGA", minimumMultiplier: 50 },
      { name: "EPIC", minimumMultiplier: 100 },
    ],
    features: {
      ...features,
      jackpots: features.jackpots ?? {
        scatterSymbol: "B",
        tiers: [
          { name: "MINI", minimumCount: 3, multiplier: 5 },
          { name: "MINOR", minimumCount: 4, multiplier: 25 },
          { name: "GRAND", minimumCount: 5, multiplier: 500 },
        ],
      },
    },
    hooks: { spin: `${id}.spin`, win: `${id}.win`, bigWin: `${id}.big_win` },
  });
}

export const pharaohOasisConfig = game(
  "pharaoh-oasis", "Pharaoh Oasis", "high",
  reelStrips([
    "AKQJASQKAWJABKQJASKQAJKSR", "KQAJKSRWQAKJABQKSAJQKAWJQ", "QAKSJWAQKJABAKQJSAQKJARWQ",
    "JKQAWJSKABQAJKSAQJWRKAKA", "AJKQSAQWKBJAKQSAJQKARWKJQ",
  ]),
  scalePaytable(balanced, 2.86),
  {
    expandingWild: { symbols: ["W"] }, respins: { triggerSymbol: "B", minimumCount: 3, count: 2 },
    mysteryReveal: { symbol: "R", targets: ["A", "K", "Q", "J"] },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 12, 5: 20 }, maxTotal: 100, winMultiplier: 2 },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const dragonPeakConfig = game(
  "dragon-peak", "Dragon Peak", "high",
  reelStrips([
    "AKQJAKQSAJKBQJAKWQKAJQKS", "KQAJKQAJWSKQBAJQKAKSJQAJ", "QAJKSAKQJABKQWJAKQSAJKQA",
    "JAKQJSAKQWJABKQAJKSAQKJ", "AQJKSAKQJABQKWJAKQSAJKQA",
  ]),
  scalePaytable(highVariance, 5.4),
  {
    wildMultiplier: { symbol: "W", multiplier: 2, maxTotalMultiplier: 32 },
    cascades: { maxSteps: 8, multiplierStep: 1, maxMultiplier: 10 },
    freeSpins: {
      scatterSymbol: "S", awards: { 3: 6, 4: 10, 5: 15 }, maxTotal: 80,
      multiplierLadder: [
        { fromSpin: 1, multiplier: 2 },
        { fromSpin: 4, multiplier: 3 },
        { fromSpin: 8, multiplier: 5 },
      ],
    },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const candyCarnivalConfig = game(
  "candy-carnival", "Candy Carnival", "very_high",
  reelStrips([
    "AAKQJAAKSWQABAJKQASWJAKA", "KAAQJAKAWSQBAAKQJASAKWQA", "QAAKSJAWAAKBQJASAAKWQJAA",
    "JAAKQAWJASKBAAQJAKSAAWKA", "AAJKSAAQWKBJAAQKSAJAWAKA",
  ]),
  scalePaytable(frequentWins, 5),
  {
    variableRows: {
      optionsByReel: [[2, 3, 4, 5], [2, 3, 4, 5], [2, 3, 4, 5], [2, 3, 4, 5], [2, 3, 4, 5]],
    },
    ways: { minimumReels: 3, betDivisor: 165 },
    stickyWild: { symbol: "W", maxSticky: 15 },
    cascades: { maxSteps: 3, multiplierStep: 0, maxMultiplier: 1 },
    freeSpins: { scatterSymbol: "S", awards: { 3: 5, 4: 8, 5: 12 }, maxTotal: 50, winMultiplier: 1 },
  },
  { version: 5, mathModelVersion: "5.0.0", rows: 5 },
);

export const pirateBayConfig = game(
  "pirate-bay", "Pirate Bay", "high",
  reelStrips([
    "AKQJCKSAQJKBWAKQJACQKJAA", "KQAJKCWJAKSBQAJKSAQJACKJ", "QAJKSCQJAKBWQKJASACKJQAA",
    "JAKQJAWKCJSBAQJAKSAQKJAC", "AQJKSAKQJACWQJAKQSAJKCAA",
  ]),
  scalePaytable(highVariance, 9.1),
  {
    cascades: { maxSteps: 8, multiplierStep: 1, maxMultiplier: 8 },
    freeSpins: { scatterSymbol: "S", awards: { 3: 7, 4: 12, 5: 18 }, maxTotal: 90, winMultiplier: 3 },
    pickBonus: {
      scatterSymbol: "B", minimumCount: 3, picks: 3, boardSize: 9,
      multipliers: [3, 5, 8, 12, 20],
    },
    coinCollect: {
      coinSymbol: "C", collectorSymbol: "W", minimumCoins: 3,
      multipliers: [1, 1, 1, 2, 2, 3, 5],
    },
    bonusBuy: { costMultiplier: 32 },
  },
  { version: 4, mathModelVersion: "4.0.0" },
);

export const neonNightsConfig = game(
  "neon-nights", "Neon Nights", "low",
  reelStrips([
    "AKQJAWKQASJBQJAMKSAQWKJAA", "KQAJKSAWQJKBQAJKAMWQSAJQK", "QAJKSAQJWKBAKQJMASAWKQJAA",
    "JAKQWJAKQASBQJAKMSAQWKJAA", "AQJKSAQWJABKQJAKWMSAJKQAA",
  ]),
  neonMultiplierPaytable,
  {
    walkingWild: { symbol: "W", direction: "right", maxSteps: 4 },
    multiplierSymbols: {
      symbols: [{ symbol: "M", multiplier: 2 }], combination: "add", maxTotalMultiplier: 8,
    },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 14, 5: 22 }, maxTotal: 100, winMultiplier: 2 },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const frozenKingdomConfig = game(
  "frozen-kingdom", "Frozen Kingdom", "very_high",
  reelStrips([
    "AAKQJAAWWSQKBAJAKQASWJAKA", "KAAQJAKSAWWQBAAKQJAWASKQA", "QAAKSWWAJAAKBQJASAAKWQJAA",
    "JAAKQASJAWWKBAAQJAKWASAKA", "AAJKWWAAQSKBJAAQKSAJAWAKA",
  ], 0, ["W"]),
  scalePaytable(frequentWins, 2.56),
  {
    stackedWild: { symbol: "W", minimumSize: 2 },
    stickyWild: { symbol: "W", maxSticky: 15 },
    freeSpins: {
      scatterSymbol: "S", awards: { 3: 5, 4: 8, 5: 12 }, maxTotal: 50, winMultiplier: 1,
      reelStrips: reelStrips([
        "AAKQJAAWWSQKBAJAKQASWWJAKA", "KAAQJAKSAWWQBAAKQJAWASKQWWA", "QAAKSWWAJAAKBQJASAAKWWQJAA",
        "JAAKQASJAWWKBAAQJAKWASAKWWA", "AAJKWWAAQSKBJAAQKSAJAWWAKA",
      ], 0, ["W"]),
      extraWilds: { symbol: "W", count: 1 },
    },
  },
  { version: 4, mathModelVersion: "4.0.0" },
);

export const jungleTempleConfig = game(
  "jungle-temple", "Jungle Temple", "high",
  reelStrips([
    "AKQJAKQSAJKBQJAKWQKAJQKS", "KQAJKQAJWSKQBAJQKAKSJQAJ", "QAJKSAKQJABKQWJAKQSAJKQA",
    "JAKQJSAKQWJABKQAJKSAQKJ", "AQJKSAKQJABQKWJAKQSAJKQA",
  ], 3),
  scalePaytable(highVariance, 7.1),
  {
    cascades: { maxSteps: 10, multiplierStep: 1, maxMultiplier: 12 },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 12, 5: 20 }, maxTotal: 100, winMultiplier: 3 },
    symbolUpgrade: {
      triggerSymbol: "B", minimumCount: 3,
      upgrades: [{ from: "J", to: "Q" }, { from: "Q", to: "K" }, { from: "K", to: "A" }],
    },
    wheelBonus: { scatterSymbol: "B", minimumCount: 3, multipliers: [3, 5, 8, 10, 15, 25, 50, 100] },
    bonusBuy: { costMultiplier: 50 },
  },
  { version: 4, mathModelVersion: "4.0.0" },
);

export const vegasGoldConfig = game(
  "vegas-gold", "Vegas Gold", "medium",
  reelStrips([
    "AKQJAKQSAJKBQJAKWQKAJQKS", "KQAJKQAJWSKQBAJQKAKSJQAJ", "QAJKSAKQJABKQWJAKQSAJKQA",
    "JAKQJSAKQWJABKQAJKSAQKJ", "AQJKSAKQJABQKWJAKQSAJKQA",
  ], 7),
  scalePaytable(highVariance, 7.7),
  {
    bothWays: true,
    holdAndWinBonus: {
      scatterSymbol: "B", minimumCount: 3, spotRange: [6, 12], multipliers: [1, 2, 3, 5, 10, 20],
    },
    jackpots: {
      scatterSymbol: "B",
      tiers: [
        { name: "MINI", minimumCount: 3, multiplier: 5 },
        { name: "MINOR", minimumCount: 4, multiplier: 25 },
        { name: "MAJOR", minimumCount: 5, multiplier: 100 },
        { name: "GRAND", minimumCount: 6, multiplier: 500 },
      ],
    },
    bonusBuy: { costMultiplier: 50 },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const midnightSaloonConfig = game(
  "midnight-saloon", "Midnight Saloon", "high",
  reelStrips([
    "AKQJAWKQASJBQJAKSWQAKJQA", "KQAJKWQASJBQAJKSAWQKJAQK", "QAJKWSAQKJBAKQSAWJKQAJKA",
    "JAKQWJASKQBAQJKSWAKQJAQA", "AQJKWSAKQJBAQKSWAJKQJAKA",
  ]),
  scalePaytable(balanced, 2.52),
  {
    expandingWild: { symbols: ["W"] },
    respins: { triggerSymbol: "B", minimumCount: 3, count: 2 },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 12, 5: 20 }, maxTotal: 100, winMultiplier: 2 },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const cosmicVoyageConfig = game(
  "cosmic-voyage", "Cosmic Voyage", "low",
  reelStrips([
    "AKQJAWKQMSJAQJAKMSWQAKJQ", "KQAJKWMQASJAQJKMSAWQKJAQ", "QAJKWMSAQKJAKQMSAWJKQAJK",
    "JAKQWMJASKQAQJMKSWAKQJAQ", "AQJKWMSAKQJAQKMSWAJKQJAK",
  ]),
  scalePaytable(balanced, 2.03),
  {
    walkingWild: { symbol: "W", direction: "right", maxSteps: 4 },
    multiplierSymbols: { symbols: [{ symbol: "M", multiplier: 2 }], combination: "add", maxTotalMultiplier: 8 },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 14, 5: 22 }, maxTotal: 100, winMultiplier: 2 },
  },
  { version: 3, mathModelVersion: "3.0.0" },
);

export const themedConfigs = [
  pharaohOasisConfig, dragonPeakConfig, candyCarnivalConfig, pirateBayConfig,
  neonNightsConfig, frozenKingdomConfig, jungleTempleConfig, vegasGoldConfig,
  midnightSaloonConfig, cosmicVoyageConfig,
] as const;
