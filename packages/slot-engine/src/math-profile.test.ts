import { describe, expect, it } from "vitest";
import { SlotEngine } from "./engine.js";
import { themedConfigs } from "./themed-configs.js";

describe("published theme math profiles", () => {
  it("keeps deterministic RTP, hit frequency, and volatility inside release guardrails", () => {
    const samples = 100_000;
    const bet = 100;
    const varianceByProfile = new Map<string, number[]>();
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
      const profileVariances = varianceByProfile.get(config.math.volatility) ?? [];
      profileVariances.push(sampledVariance);
      varianceByProfile.set(config.math.volatility, profileVariances);
      expect(sampledRtp, `${config.id} sampled RTP`).toBeGreaterThan(0.75);
      expect(sampledRtp, `${config.id} sampled RTP`).toBeLessThan(1.15);
      if (config.id === "candy-carnival" || config.id === "vegas-gold") {
        expect(Math.abs(sampledRtp - config.math.targetRtp), `${config.id} calibrated RTP`).toBeLessThan(0.02);
      }
      expect(
        Math.abs(sampledHitFrequency - config.math.expectedHitFrequency),
        `${config.id} sampled hit frequency`,
      ).toBeLessThan(0.06);
    }
    const average = (profile: string) => {
      const values = varianceByProfile.get(profile)!;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    expect(average("low")).toBeLessThan(average("medium"));
    expect(average("medium")).toBeLessThan(average("high"));
    expect(average("high")).toBeLessThan(average("very_high"));
  }, 30_000);

  it("publishes a distinct versioned reel model for every theme", () => {
    const signatures = themedConfigs.map((config) => JSON.stringify(config.reels));
    expect(new Set(signatures).size).toBe(themedConfigs.length);
    expect(themedConfigs.find((config) => config.id === "candy-carnival")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(themedConfigs.find((config) => config.id === "vegas-gold")).toMatchObject({
      version: 3,
      math: { mathModelVersion: "3.0.0" },
    });
    expect(
      themedConfigs
        .filter((config) => config.id !== "candy-carnival" && config.id !== "vegas-gold")
        .every((config) => config.version === 2),
    ).toBe(true);
  });
});
