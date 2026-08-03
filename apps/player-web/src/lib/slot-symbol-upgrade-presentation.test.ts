import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import { resolveSymbolUpgradePresentation } from "./slot-symbol-upgrade-presentation";

const event = (data: Readonly<Record<string, number | string>>): SpinEvent => ({ type: "symbol.upgraded", data });

describe("symbol upgrade presentation", () => {
  it("preserves multiple authoritative upgrade transitions", () => {
    const result = resolveSymbolUpgradePresentation([
      event({ from: "J", to: "A", count: 3, triggerCount: 4, positions: "0:1,2:0,4:2" }),
      event({ from: "Q", to: "K", count: 2, triggerCount: 4, positions: "1:1,3:0" }),
    ]);

    expect(result.totalCount).toBe(5);
    expect(result.triggerCount).toBe(4);
    expect(result.exactPositionCount).toBe(5);
    expect(result.steps).toEqual([
      { from: "J", to: "A", count: 3, triggerCount: 4, positions: ["0:1", "2:0", "4:2"] },
      { from: "Q", to: "K", count: 2, triggerCount: 4, positions: ["1:1", "3:0"] },
    ]);
  });

  it("deduplicates positions and ignores malformed transitions", () => {
    const result = resolveSymbolUpgradePresentation([
      event({ from: "J", to: "A", count: 2, positions: "0:0,0:0,bad,2:x" }),
      event({ from: "K", to: "K", count: 8 }),
      event({ from: "", to: "H1", count: 1 }),
    ]);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.positions).toEqual(["0:0"]);
    expect(result.exactPositionCount).toBe(1);
  });

  it("bounds hostile counts and limits the visible transition list", () => {
    const result = resolveSymbolUpgradePresentation(Array.from({ length: 7 }, (_, index) => event({
      from: `L${index}`,
      to: `H${index}`,
      count: 10_000,
      triggerCount: 10_000,
    })));

    expect(result.steps).toHaveLength(4);
    expect(result.totalCount).toBe(400);
    expect(result.triggerCount).toBe(100);
  });
});
