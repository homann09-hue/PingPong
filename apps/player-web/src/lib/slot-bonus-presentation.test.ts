import { describe, expect, it } from "vitest";
import type { SpinEvent } from "./contracts";
import { resolveSlotBonusPresentation } from "./slot-bonus-presentation";

const event = (data: Readonly<Record<string, number | string>>): SpinEvent => ({ type: "bonus.awarded", data });

describe("resolveSlotBonusPresentation", () => {
  it("reconstructs hold-and-win positions and reveal order", () => {
    const result = resolveSlotBonusPresentation([event({
      mode: "hold_and_win",
      multiplier: 24,
      boardSize: 15,
      initialSpots: "0=2,7=5,14=3",
      respinSteps: "2:;3:4=4,9=2;2:;3:12=8;0:",
    })]);

    expect(result.mode).toBe("hold-and-win");
    expect(result.columns).toBe(5);
    expect(result.respinSteps).toBe(5);
    expect(result.spots).toEqual([
      { position: 0, multiplier: 2, revealOrder: 0, initial: true },
      { position: 7, multiplier: 5, revealOrder: 0, initial: true },
      { position: 14, multiplier: 3, revealOrder: 0, initial: true },
      { position: 4, multiplier: 4, revealOrder: 2, initial: false },
      { position: 9, multiplier: 2, revealOrder: 2, initial: false },
      { position: 12, multiplier: 8, revealOrder: 4, initial: false },
    ]);
  });

  it("uses real coin-collect positions and multipliers", () => {
    const result = resolveSlotBonusPresentation([event({
      mode: "coin_collect",
      multiplier: 11,
      coinCount: 3,
      collectorCount: 1,
      coins: "1=2,6=4,13=5",
    })]);

    expect(result.mode).toBe("coin-collect");
    expect(result.collectorCount).toBe(1);
    expect(result.spots.map((spot) => [spot.position, spot.multiplier])).toEqual([[1, 2], [6, 4], [13, 5]]);
  });

  it("resolves pick, wheel and jackpot metadata", () => {
    expect(resolveSlotBonusPresentation([event({ mode: "pick", picks: "2,5,10", multiplier: 17 })]).picks).toEqual([2, 5, 10]);
    expect(resolveSlotBonusPresentation([event({ mode: "wheel", segment: 4, multiplier: 25 })])).toMatchObject({ mode: "wheel", segment: 4, multiplier: 25 });
    expect(resolveSlotBonusPresentation([event({ mode: "jackpot", tier: "MAJOR", multiplier: 500 })])).toMatchObject({ mode: "jackpot", tier: "MAJOR", multiplier: 500 });
  });

  it("keeps malformed payloads bounded and safe", () => {
    const result = resolveSlotBonusPresentation([event({ mode: "hold_and_win", boardSize: 999, initialSpots: "-1=5,2=nope,3=4" })]);
    expect(result.boardSize).toBe(30);
    expect(result.spots).toEqual([{ position: 3, multiplier: 4, revealOrder: 0, initial: true }]);
  });
});
