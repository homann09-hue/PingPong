import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import {
  buildSlotMechanicSequence,
  nextSlotMechanicStep,
  slotMechanicEventSignature,
} from "./slot-mechanic-sequence";

const event = (type: string, data: Readonly<Record<string, number | string>> = {}): SpinEvent => ({ type, data });

describe("slot mechanic sequence", () => {
  it("keeps max win exclusive so no lower-priority effect obscures it", () => {
    expect(buildSlotMechanicSequence("cascade", 50_000, [
      event("cascade.started", { step: 4 }),
      event("mystery.revealed", { target: "A" }),
      event("max_win.reached", { multiplier: 10_000 }),
    ], null)).toEqual([{ effect: "jackpot", durationMs: 1_900 }]);
  });

  it("presents simultaneous mechanics once in deterministic engine order", () => {
    expect(buildSlotMechanicSequence("respin", 2_500, [
      event("wild.walked", { moves: "0:0>1:0" }),
      event("mystery.revealed", { target: "H1" }),
      event("symbol.upgraded", { from: "J", to: "A" }),
      event("multiplier.applied", { source: "multiplier_symbols", multiplier: 3 }),
      event("bonus.awarded", { mode: "coin_collect" }),
    ], null).map((step) => step.effect)).toEqual([
      "respin",
      "upgrade",
      "mystery",
      "walking-wild",
      "multiplier",
      "bonus",
    ]);
  });

  it("keeps a normal free-spin HUD persistent without replaying its structural multiplier", () => {
    expect(buildSlotMechanicSequence("free_spin", 1_000, [
      event("multiplier.applied", { source: "free_spin", multiplier: 4 }),
    ], "active").map((step) => step.effect)).toEqual(["hit"]);

    expect(buildSlotMechanicSequence("free_spin", 1_000, [
      event("multiplier.applied", { source: "free_spin", multiplier: 4 }),
      event("multiplier.applied", { source: "multiplier_symbols", multiplier: 2 }),
    ], "active").map((step) => step.effect)).toEqual(["multiplier"]);
  });

  it("queues entry and retrigger reveals but not an ordinary free spin", () => {
    expect(buildSlotMechanicSequence("base", 0, [event("free_spins.awarded", { count: 8 })], "entry")[0]?.effect).toBe("free-spin");
    expect(buildSlotMechanicSequence("free_spin", 0, [event("free_spins.awarded", { count: 4 })], "retrigger")[0]?.effect).toBe("free-spin");
    expect(buildSlotMechanicSequence("free_spin", 0, [], "active")).toEqual([]);
  });

  it("uses a generic hit only when no specific mechanic exists", () => {
    expect(buildSlotMechanicSequence("base", 250, [], null)).toEqual([{ effect: "hit", durationMs: 820 }]);
    expect(buildSlotMechanicSequence("base", 0, [], null)).toEqual([]);
  });

  it("advances once and stops after the final mechanic", () => {
    expect(nextSlotMechanicStep(0, 3)).toBe(1);
    expect(nextSlotMechanicStep(2, 3)).toBe(3);
    expect(nextSlotMechanicStep(3, 3)).toBe(3);
    expect(nextSlotMechanicStep(-4, 3)).toBe(1);
    expect(nextSlotMechanicStep(4, 0)).toBe(0);
  });

  it("creates a stable signature independent of event data key order", () => {
    const left = slotMechanicEventSignature("base", 0, 100, [event("mystery.revealed", { target: "A", count: 2 })]);
    const right = slotMechanicEventSignature("base", 0, 100, [event("mystery.revealed", { count: 2, target: "A" })]);
    expect(left).toBe(right);
  });
});
