import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import { resolveSlotFeatureStatus } from "./slot-feature-status-presentation";

const event = (type: string, data: Readonly<Record<string, number | string>>): SpinEvent => ({ type, data });

describe("slot feature status presentation", () => {
  it("shows exact ways, combined multiplier and round win", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "cascade",
      index: 2,
      totalWin: 12500,
      mechanicLabel: "Megaways",
      events: [
        event("ways.win", { symbol: "H1", count: 5, ways: 1024 }),
        event("multiplier.applied", { source: "cascade", multiplier: 3 }),
        event("multiplier.applied", { source: "multiplier_symbols", multiplier: 2 }),
      ],
    });

    expect(result.headline).toBe("KASKADE 2");
    expect(result.metrics).toEqual([
      { label: "Kaskade", value: "2" },
      { label: "Ways", value: "1.024" },
      { label: "Multiplikator", value: "6×" },
      { label: "Rundengewinn", value: "12.500" },
    ]);
  });

  it("derives walking direction from the authoritative move path", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "respin",
      index: 1,
      totalWin: 0,
      mechanicLabel: "Walking Wild",
      events: [event("wild.walked", { count: 2, moves: "3:1>2:1,4:0>3:0" })],
    });

    expect(result.headline).toBe("WALKING WILD");
    expect(result.metrics).toContainEqual({ label: "Wild-Pfad", value: "← LINKS · 2" });
  });

  it("uses mechanic-specific bonus labels and bonus tags", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "bonus",
      index: 0,
      totalWin: 40000,
      mechanicLabel: "Bonus",
      events: [event("bonus.awarded", {
        mode: "hold_and_win",
        amount: 40000,
        multiplier: 40,
        boardSize: 15,
        initialSpots: "0=5,2=10,7=25",
        respinSteps: "2:;3:10=5;2:;1:;0:",
      })],
    });

    expect(result.headline).toBe("HOLD & WIN");
    expect(result.kicker).toBe("BONUS LIVE");
    expect(result.metrics).toContainEqual({ label: "Bonus", value: "40×" });
    expect(result.tags).toContain("5 RESPIN-STUFEN");
  });

  it("surfaces cluster, mystery and sticky mechanics with bounded priorities", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "base",
      index: 0,
      totalWin: 2500,
      mechanicLabel: "Mystery Cluster",
      events: [
        event("cluster.win", { symbol: "H2", count: 11 }),
        event("mystery.revealed", { symbol: "M", target: "H2", count: 4, positions: "0:0,1:1,2:2,3:0" }),
        event("wild.stuck", { count: 3, positions: "0:0,1:1,2:2", newPositions: "2:2" }),
        event("symbol.upgraded", { from: "L1", to: "H1", count: 6, triggerCount: 3 }),
      ],
    });

    expect(result.headline).toBe("MYSTERY REVEAL");
    expect(result.metrics).toContainEqual({ label: "Cluster", value: "11 Symbole" });
    expect(result.metrics).toContainEqual({ label: "Reveal", value: "4 → H2" });
    expect(result.tags).toEqual(["3 WILDS LOCKED", "6 UPGRADED"]);
  });

  it("always reserves the final metric for the authoritative payout", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "free_spin",
      index: 7,
      totalWin: 98765,
      mechanicLabel: "Free Spins",
      events: [
        event("ways.win", { symbol: "H1", count: 5, ways: 4096 }),
        event("multiplier.applied", { source: "multiplier_symbols", multiplier: 8 }),
        event("free_spins.awarded", { count: 12 }),
      ],
    });

    expect(result.metrics).toHaveLength(4);
    expect(result.metrics.at(-1)).toEqual({ label: "Rundengewinn", value: "98.765" });
    expect(result.metrics.some((metric) => metric.label === "Gewonnen")).toBe(false);
  });

  it("bounds hostile numeric payloads before they reach the HUD", () => {
    const result = resolveSlotFeatureStatus({
      active: true,
      phase: "base",
      index: Number.MAX_VALUE,
      totalWin: Number.MAX_VALUE,
      mechanicLabel: "Max Win",
      events: [
        event("max_win.reached", { multiplier: Number.MAX_VALUE }),
        event("ways.win", { ways: Number.MAX_VALUE, count: Number.MAX_VALUE }),
        event("wild.stuck", { count: Number.MAX_VALUE }),
      ],
    });

    expect(result.headline).toBe("MAX WIN");
    expect(result.metrics.at(-1)).toEqual({ label: "Limit", value: "1.000.000.000" });
    expect(result.metrics).toContainEqual({ label: "Ways", value: "10.000.000" });
    expect(result.tags).toContain("100 WILDS LOCKED");
    expect(result.tags).toContain("1.000.000× MAX");
  });

  it("returns a stable idle state", () => {
    expect(resolveSlotFeatureStatus({
      active: false,
      index: 0,
      totalWin: 0,
      events: [],
      mechanicLabel: "Cascades",
    })).toEqual({
      kicker: "AURORA FEATURE",
      headline: "FEATURE READY",
      metrics: [
        { label: "Mechanik", value: "Cascades" },
        { label: "Status", value: "Bereit" },
      ],
      tags: [],
      tone: "idle",
    });
  });
});
