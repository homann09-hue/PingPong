import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import { presentSlotCell } from "./slot-cell-presentation";

const walkingEvent = (data: Readonly<Record<string, number | string>>): SpinEvent => ({
  type: "wild.walked",
  data,
});

describe("walking wild cell presentation", () => {
  it("derives a movement from the left side", () => {
    const result = presentSlotCell([
      walkingEvent({ positions: "2:1", moves: "1:1>2:1", step: 2, symbol: "W" }),
    ], 2, 1, "W");

    expect(result.className).toContain("is-walking-wild");
    expect(result.className).toContain("walk-from-left");
    expect(result.className).toContain("walk-distance-1");
    expect(result.description).toContain("Walze 2 nach Walze 3");
  });

  it("derives a longer movement from the right side", () => {
    const result = presentSlotCell([
      walkingEvent({ positions: "1:2", moves: "4:2>1:2", step: 3, symbol: "W" }),
    ], 1, 2, "W");

    expect(result.className).toContain("walk-from-right");
    expect(result.className).toContain("walk-distance-3");
    expect(result.badge).toBe("WILD");
  });

  it("keeps a stable fallback for legacy events without moves", () => {
    const result = presentSlotCell([
      walkingEvent({ positions: "3:0", step: 1, symbol: "W" }),
    ], 3, 0, "W");

    expect(result.className).toContain("walk-from-left");
    expect(result.className).toContain("walk-distance-1");
  });
});
