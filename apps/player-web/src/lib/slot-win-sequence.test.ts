import { describe, expect, it } from "vitest";
import type { SpinWin } from "./contracts";
import type { SlotWinTrace } from "./slot-win-overlay-presentation";
import {
  buildSlotWinSequence,
  buildSlotWinSequenceForRound,
  nextSlotWinStep,
  slotWinSequenceHoldMs,
  slotWinTraceCellKeys,
} from "./slot-win-sequence";

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

  it("shortens every trace in turbo mode without dropping sequence steps", () => {
    expect(buildSlotWinSequence([trace("path", 3), trace("cluster", 8)], true)).toEqual([
      { traceIndex: 0, durationMs: 388 },
      { traceIndex: 1, durationMs: 535 },
    ]);
  });

  it("caps long traces so malformed payloads cannot stall the presentation", () => {
    expect(buildSlotWinSequence([trace("cluster", 100)])[0]?.durationMs).toBe(1_970);
  });

  it("derives one authoritative sequence from the settled round grid", () => {
    const wins: readonly SpinWin[] = [{
      kind: "line",
      amount: 500,
      cells: [[0, 0], [1, 0], [2, 0]],
      symbol: "A",
      count: 3,
      payline: 0,
    }];
    const grid = [["A", "K", "Q"], ["A", "Q", "K"], ["A", "J", "Q"]] as const;

    expect(buildSlotWinSequenceForRound(wins, grid)).toEqual([{ traceIndex: 0, durationMs: 1_385 }]);
  });

  it("holds the round until one complete win cycle has played", () => {
    const sequence = buildSlotWinSequence([trace("path", 3), trace("cluster", 8)]);
    expect(slotWinSequenceHoldMs(sequence)).toBe(3_435);
    expect(slotWinSequenceHoldMs(buildSlotWinSequence([trace("path", 3), trace("cluster", 8)], true), true)).toBe(973);
    expect(slotWinSequenceHoldMs([])).toBe(0);
  });

  it("cycles deterministically and handles empty or malformed lengths", () => {
    expect(nextSlotWinStep(0, 3)).toBe(1);
    expect(nextSlotWinStep(2, 3)).toBe(0);
    expect(nextSlotWinStep(-4, 3)).toBe(1);
    expect(nextSlotWinStep(4, 1)).toBe(0);
    expect(nextSlotWinStep(4, 0)).toBe(0);
  });

  it("returns exact unique reel and row keys for the active trace", () => {
    const active = trace("ways", 3);
    const duplicate: SlotWinTrace = {
      ...active,
      points: [...active.points, active.points[1]!],
    };

    expect(slotWinTraceCellKeys(duplicate)).toEqual(["0:0", "1:0", "2:0"]);
    expect(slotWinTraceCellKeys(undefined)).toEqual([]);
  });
});
