import { parseSlotConfig } from "./config.js";

/** Development configuration. Production configs are versioned records signed at publish time. */
export const classicConfig = parseSlotConfig({
  id: "classic-3x3", version: 1, name: "Aurora Classic", rows: 3,
  reels: [
    ["A", "K", "Q", "W", "A", "K", "Q", "A"],
    ["K", "Q", "A", "K", "W", "Q", "A", "K"],
    ["Q", "A", "K", "Q", "A", "W", "K", "A"],
  ],
  paylines: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
  symbols: {
    A: { kind: "regular", payouts: { 3: 10 } },
    K: { kind: "regular", payouts: { 3: 6 } },
    Q: { kind: "regular", payouts: { 3: 4 } },
    W: { kind: "wild", payouts: {} },
  },
  math: { targetRtp: 0.96, volatility: "medium", expectedHitFrequency: 0.25 },
  hooks: { spin: "base.spin", win: "base.win", bigWin: "base.big_win" },
});
