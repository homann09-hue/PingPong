import { parseSlotConfig } from "./config.js";

/** Five-reel reference game proving that layout and math data are configuration-driven. */
export const auroraConfig = parseSlotConfig({
  id: "aurora-5x3", version: 1, name: "Aurora Lights", rows: 3,
  reels: [
    ["A", "K", "Q", "J", "W", "A", "S", "K", "Q", "A", "J", "K"],
    ["K", "Q", "A", "J", "S", "K", "W", "Q", "A", "J", "K", "Q"],
    ["Q", "A", "K", "S", "J", "W", "A", "Q", "K", "J", "A", "Q"],
    ["J", "K", "Q", "A", "W", "J", "S", "K", "A", "Q", "J", "A"],
    ["A", "J", "K", "Q", "S", "A", "Q", "W", "K", "J", "A", "Q"],
  ],
  paylines: [
    [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
    [0,0,1,2,2], [2,2,1,0,0], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0],
  ],
  symbols: {
    A: { kind: "regular", payouts: { 3: 4, 4: 10, 5: 30 } },
    K: { kind: "regular", payouts: { 3: 3, 4: 8, 5: 20 } },
    Q: { kind: "regular", payouts: { 3: 2, 4: 6, 5: 15 } },
    J: { kind: "regular", payouts: { 3: 2, 4: 5, 5: 12 } },
    W: { kind: "wild", payouts: {} },
    S: { kind: "scatter", payouts: { 3: 2, 4: 10, 5: 50 } },
  },
  features: {
    expandingWild: { symbols: ["W"] },
    freeSpins: { scatterSymbol: "S", awards: { 3: 8, 4: 12, 5: 20 }, maxTotal: 100 },
    cascades: { maxSteps: 20 },
  },
  math: { targetRtp: 0.96, volatility: "medium", expectedHitFrequency: 0.28 },
  hooks: { spin: "aurora.spin", win: "aurora.win", bigWin: "aurora.big_win" },
});
