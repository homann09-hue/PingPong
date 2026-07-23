import { describe, expect, it } from "vitest";
import { DeterministicRng } from "./rng.js";

describe("DeterministicRng", () => {
  it("rejects invalid integer bounds", () => {
    const rng = new DeterministicRng(1n);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("is deterministic for replayable slot math", () => {
    const first = new DeterministicRng(123_456n);
    const second = new DeterministicRng(123_456n);
    expect(Array.from({ length: 20 }, () => first.nextInt(97)))
      .toEqual(Array.from({ length: 20 }, () => second.nextInt(97)));
  });
});
