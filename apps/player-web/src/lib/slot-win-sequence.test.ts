import { describe, expect, it } from "vitest";
import type { SlotWinTrace } from "./slot-win-overlay-presentation";
import { buildSlotWinSequence, nextSlotWinStep } from "./slot-win-sequence";

const trace = (kind: SlotWinTrace["kind"], pointCount: number): SlotWinTrace => ({
  id: `${kind}-${pointCount}`,
  kind,
  amount: 1_000,
  count: pointCount,
  label: `${kind}-${pointCount}`,
  points: Array.from({ length: pointCount }, (_, index) => ({ reel: index, row: 0, x: index * 100, y: 100, width: 200, height: 200 })),
  edges: [],
  badge: { x: 500, y: 100 },
});

describe("slot win sequence", () => {
  it("gives complex clusters more presentation time than simple lines", () => {
    const sequence = buildSlotWinSequence([trace("path", 3), trace("cluster", 8)]);

    expect(sequence).toEqual([
      { traceIndex: 0, durationMs: 1_385 },
      { traceIndex: 1, durationMs: 1_910 },
    ]);
  });

  it("caps long traces so malformed payloads cannot stall the presentation", () => {
    expect(buildSlotWinSequence([trace("cluster", 100)])[0]?.durationMs).toBe(1_970);
  });

  it("cycles deterministically and handles empty or malformed lengths", () => {
    expect(nextSlotWinStep(0, 3)).toBe(1);
    expect(nextSlotWinStep(2, 3)).toBe(0);
    expect(nextSlotWinStep(-4, 3)).toBe(1);
    expect(nextSlotWinStep(4, 1)).toBe(0);
    expect(nextSlotWinStep(4, 0)).toBe(0);
  });
});
