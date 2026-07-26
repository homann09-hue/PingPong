import { describe, expect, it } from "vitest";
import type { SpinWin } from "./contracts";
import { presentSlotWinOverlay } from "./slot-win-overlay-presentation";

const grid = [
  ["A", "K", "Q"],
  ["A", "K", "Q", "J"],
  ["A", "K"],
  ["A", "K", "Q"],
  ["A", "K", "Q", "J", "W"],
] as const;

function win(value: Partial<SpinWin> & Pick<SpinWin, "amount" | "cells">): SpinWin {
  return value;
}

describe("slot win overlay presentation", () => {
  it("creates a left-to-right payline from real server cells", () => {
    const [trace] = presentSlotWinOverlay([win({
      kind: "line",
      amount: 1_250,
      cells: [[0, 0], [1, 2], [2, 1], [3, 0]],
      direction: "left",
      payline: 4,
      symbol: "H1",
      count: 4,
    })], grid);

    expect(trace?.kind).toBe("path");
    expect(trace?.points.map((point) => point.reel)).toEqual([0, 1, 2, 3]);
    expect(trace?.points[1]?.y).toBe(375);
    expect(trace?.badge.x).toBeGreaterThan(600);
  });

  it("reverses right-origin line wins without changing the authoritative cells", () => {
    const [trace] = presentSlotWinOverlay([win({
      kind: "line",
      amount: 900,
      cells: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
      direction: "right",
    })], grid);

    expect(trace?.points.map((point) => point.reel)).toEqual([4, 3, 2, 1, 0]);
    expect(trace?.badge.x).toBeLessThan(200);
  });

  it("renders ways as cells instead of inventing a payline", () => {
    const [trace] = presentSlotWinOverlay([win({
      kind: "ways",
      amount: 4_000,
      ways: 8,
      cells: [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1]],
    })], grid);

    expect(trace?.kind).toBe("ways");
    expect(trace?.edges).toEqual([]);
    expect(trace?.points).toHaveLength(5);
  });

  it("connects only orthogonally adjacent cluster cells", () => {
    const [trace] = presentSlotWinOverlay([win({
      kind: "cluster",
      amount: 2_500,
      cells: [[0, 0], [1, 0], [1, 1], [2, 1], [4, 4]],
    })], grid);

    expect(trace?.kind).toBe("cluster");
    expect(trace?.edges).toHaveLength(3);
    expect(trace?.edges.map((edge) => `${edge.from.reel}:${edge.from.row}>${edge.to.reel}:${edge.to.row}`)).toEqual([
      "0:0>1:0",
      "1:0>1:1",
      "1:1>2:1",
    ]);
  });

  it("deduplicates cells and rejects invalid coordinates or non-positive wins", () => {
    const traces = presentSlotWinOverlay([
      win({ kind: "scatter", amount: 300, cells: [[0, 0], [0, 0], [5, 0], [1, 9]] }),
      win({ kind: "line", amount: 0, cells: [[0, 0], [1, 0]] }),
    ], grid);

    expect(traces).toHaveLength(1);
    expect(traces[0]?.kind).toBe("scatter");
    expect(traces[0]?.points).toHaveLength(1);
  });
});
