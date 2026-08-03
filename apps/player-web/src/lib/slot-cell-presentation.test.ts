import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import { presentSlotCell } from "./slot-cell-presentation";

const event = (type: string, data: Readonly<Record<string, number | string>>): SpinEvent => ({ type, data });

describe("presentSlotCell", () => {
  it("marks persistent and newly added sticky wilds", () => {
    const events = [event("wild.stuck", {
      symbol: "W",
      count: 2,
      positions: "1:0,3:2",
      newPositions: "3:2",
    })];

    const persistent = presentSlotCell(events, 1, 0, "W");
    const added = presentSlotCell(events, 3, 2, "W");

    expect(persistent.className).toContain("is-sticky");
    expect(persistent.badge).toBe("LOCK");
    expect(added.className).toContain("is-new-sticky");
    expect(added.badge).toBe("+LOCK");
  });

  it("reads bounded per-cell multiplier values from engine positions", () => {
    const events = [event("multiplier.applied", {
      source: "multiplier_symbols",
      multiplier: 6,
      positions: "0:1=2,4:2=5000000,-1:0=9,broken=3",
    })];

    expect(presentSlotCell(events, 4, 2, "M3")).toMatchObject({
      badge: "×1000",
      description: "1000× Multiplikator-Symbol",
    });
    expect(presentSlotCell(events, 2, 2, "A").className).toBe("");
    expect(presentSlotCell(events, -1, 0, "A").className).toBe("");
  });

  it("combines mystery, extra-wild and walking-wild feature states", () => {
    const events = [
      event("mystery.revealed", { positions: "2:1", target: "H1", count: 1 }),
      event("free_spins.modified", { mode: "extra_wilds", positions: "2:1", symbol: "W", count: 1 }),
      event("wild.walked", { positions: "2:1", step: 2, symbol: "W" }),
    ];

    const presentation = presentSlotCell(events, 2, 1, "W");

    expect(presentation.className).toContain("is-mystery-reveal");
    expect(presentation.className).toContain("is-extra-wild");
    expect(presentation.className).toContain("is-walking-wild");
    expect(presentation.badge).toBe("+W");
  });

  it("marks every visible cell on expanded and stacked wild reels", () => {
    const events = [
      event("wild.expanded", { reel: 1, symbol: "W" }),
      event("wild.stacked", { reel: 1, startRow: 0, size: 3, symbol: "W" }),
    ];

    const presentation = presentSlotCell(events, 1, 2, "W");

    expect(presentation.className).toContain("is-expanded-wild");
    expect(presentation.className).toContain("is-stacked-wild");
    expect(presentation.badge).toBe("FULL");
  });

  it("highlights only exactly positioned scatter and upgraded cells", () => {
    const events = [
      event("scatter.hit", { symbol: "S", count: 3, positions: "0:0,2:1,4:2" }),
      event("symbol.upgraded", { from: "Q", to: "H2", count: 2, triggerCount: 3, positions: "0:1,3:2" }),
    ];

    expect(presentSlotCell(events, 0, 0, "S").className).toContain("is-scatter-hit");
    expect(presentSlotCell(events, 1, 0, "S").className).toBe("");
    expect(presentSlotCell(events, 0, 1, "H2")).toMatchObject({
      badge: "UP",
      description: "Upgrade von Q",
    });
    expect(presentSlotCell(events, 2, 1, "H2").className).toBe("");
  });

  it("does not guess cells when legacy events have no positions", () => {
    const events = [
      event("scatter.hit", { symbol: "S", count: 3 }),
      event("symbol.upgraded", { from: "Q", to: "H2", count: 2, triggerCount: 3 }),
    ];

    expect(presentSlotCell(events, 0, 0, "S").className).toBe("");
    expect(presentSlotCell(events, 0, 1, "H2").className).toBe("");
  });

  it("ignores malformed and negative position evidence", () => {
    const events = [event("mystery.revealed", {
      positions: "-1:0,0:-1,1:2:3,foo:bar,2:1",
      target: "H1",
      count: Number.POSITIVE_INFINITY,
    })];

    expect(presentSlotCell(events, 2, 1, "H1").className).toContain("is-mystery-reveal");
    expect(presentSlotCell(events, 0, 0, "H1").className).toBe("");
  });
});
