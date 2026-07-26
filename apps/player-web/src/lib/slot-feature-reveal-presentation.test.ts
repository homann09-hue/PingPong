import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import {
  resolveFreeSpinReveal,
  resolveMultiplierReveal,
  resolveMysteryReveal,
} from "./slot-feature-reveal-presentation";

const event = (type: string, data: Readonly<Record<string, number | string>>): SpinEvent => ({ type, data });

describe("slot feature reveal presentation", () => {
  it("uses the real mystery target, count and server positions", () => {
    const result = resolveMysteryReveal([
      event("mystery.revealed", {
        symbol: "M",
        target: "H2",
        count: 3,
        positions: "0:1,2:0,4:2,not-a-cell,2:0",
      }),
    ]);

    expect(result).toMatchObject({ source: "M", target: "H2", count: 3, visibleCards: 3 });
    expect(result.positions).toEqual(["0:1", "2:0", "4:2"]);
  });

  it("combines free-spin awards with ladder, extra-wild and special-reel modifiers", () => {
    const result = resolveFreeSpinReveal("free_spin", 4, [
      event("free_spins.awarded", { count: 6 }),
      event("free_spins.modified", { mode: "multiplier_ladder", spin: 4, multiplier: 3 }),
      event("free_spins.modified", { mode: "extra_wilds", count: 2, positions: "1:0,3:2", symbol: "W" }),
      event("free_spins.modified", { mode: "special_reels" }),
    ]);

    expect(result).toEqual({
      primary: "+6",
      label: "FREISPIELE",
      awarded: 6,
      multiplier: 3,
      extraWilds: 2,
      specialReels: true,
      positions: ["1:0", "3:2"],
    });
  });

  it("multiplies round-wide sources but does not multiply unrelated payline events together", () => {
    const result = resolveMultiplierReveal([
      event("multiplier.applied", { source: "free_spin", multiplier: 2 }),
      event("multiplier.applied", { source: "multiplier_symbols", multiplier: 3 }),
      event("multiplier.applied", { payline: 1, multiplier: 4 }),
      event("multiplier.applied", { payline: 3, multiplier: 5 }),
    ]);

    expect(result.multiplier).toBe(6);
    expect(result.sources).toEqual(["free_spin", "multiplier_symbols"]);
    expect(result.paylineEvents).toBe(2);
  });

  it("falls back to the highest payline multiplier when no round-wide source exists", () => {
    expect(resolveMultiplierReveal([
      event("multiplier.applied", { payline: 2, multiplier: 2 }),
      event("multiplier.applied", { payline: 4, multiplier: 5 }),
    ])).toMatchObject({ multiplier: 5, label: "WILD MULTIPLIKATOR", paylineEvents: 2 });
  });

  it("bounds malformed counts and produces stable empty defaults", () => {
    expect(resolveMysteryReveal([event("mystery.revealed", { count: 10_000, positions: "" })])).toMatchObject({
      count: 100,
      visibleCards: 12,
    });
    expect(resolveFreeSpinReveal("base", 0, [])).toMatchObject({ primary: "+", multiplier: 1, extraWilds: 0 });
    expect(resolveMultiplierReveal([])).toMatchObject({ multiplier: 1, label: "MULTIPLIKATOR" });
  });
});
