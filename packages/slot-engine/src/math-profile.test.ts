import { describe, expect, it } from "vitest";
import { SlotEngine } from "./engine.js";
import { themedConfigs } from "./themed-configs.js";

describe("published theme math profiles", () => {
  it("keeps deterministic RTP, hit frequency, and volatility inside release guardrails", () => {
    const samples = 100_000;
    const bet = 100;
    const varianceRanges = {
      low: { minimum: 0, maximum: 10 },
      medium: { minimum: 10, maximum: 18 },
      high: { minimum: 18, maximum: 30 },
      very_high: { minimum: 30, maximum: Number.POSITIVE_INFINITY },
    } as const;
    for (const config of themedConfigs) {
      const engine = new SlotEngine(config);
      let returned = 0;
      let squaredMultipliers = 0;
      let hits = 0;
      for (let seed = 0n; seed < BigInt(samples); seed++) {
        const result = engine.spin({ bet, seed });
        returned += result.totalWin;
        squaredMultipliers += (result.totalWin / bet) ** 2;
        if (result.totalWin > 0) hits++;
      }
      const sampledRtp = returned / (samples * bet);
      const sampledHitFrequency = hits / samples;
      const sampledVariance = squaredMultipliers / samples - sampledRtp ** 2;
      const varianceRange = varianceRanges[config.math.volatility];
      expect(sampledRtp, `${config.id} sampled RTP`).toBeGreaterThan(0.75);
      expect(sampledRtp, `${config.id} sampled RTP`).toBeLessThan(1.15);
      if (["pharaoh-oasis", "dragon-peak", "candy-carnival", "pirate-bay", "neon-nights", "frozen-kingdom", "jungle-temple", "vegas-gold"].includes(config.id)) {
        expect(Math.abs(sampledRtp - config.math.targetRtp), `${config.id} calibrated RTP`).toBeLessThan(0.02);
      }
      expect(
        Math.abs(sampledHitFrequency - config.math.expectedHitFrequency),
        `${config.id} sampled hit frequency`,
      ).toBeLessThan(0.06);
      expect(sampledVariance, `${config.id} minimum ${config.math.volatility} variance`).toBeGreaterThanOrEqual(varianceRange.minimum);
      expect(sampledVariance, `${config.id} maximum ${config.math.volatility} variance`).toBeLessThan(varianceRange.maximum);
    }
  }, 30_000);

  it("publishes a distinct versioned reel model for every theme", () => {
    const signatures = themedConfigs.map((config) => JSON.stringify(config.reels));
    expect(new Set(signatures).size).toBe(themedConfigs.length);
    expect(themedConfigs.find((config) => config.id === "candy-carnival")).toMatchObject({
      version: 5,
      rows: 5,
      math: { mathModelVersion: "5.0.0", volatility: "very_high" },
    });
    expect(themedConfigs.find((config) => config.id === "vegas-gold")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(themedConfigs.find((config) => config.id === "pirate-bay")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(themedConfigs.find((config) => config.id === "jungle-temple")).toMatchObject({
      version: 4,
      math: { mathModelVersion: "4.0.0", volatility: "high" },
    });
    expect(themedConfigs.find((config) => config.id === "frozen-kingdom")).toMatchObject({
      version: 4,
      math: { mathModelVersion: "4.0.0" },
      features: { freeSpins: { extraWilds: { symbol: "W", count: 1 } } },
    });
    expect(themedConfigs.find((config) => config.id === "neon-nights")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(themedConfigs.find((config) => config.id === "dragon-peak")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(themedConfigs.find((config) => config.id === "pharaoh-oasis")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
      symbols: { R: { kind: "mystery", payouts: {} } },
    });
    expect(themedConfigs.every((config) => config.version >= 3)).toBe(true);
  });
});
