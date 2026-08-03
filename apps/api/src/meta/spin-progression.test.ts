import { describe, expect, it } from "vitest";
import { xpRequiredForNextLevel } from "./player-progression.js";
import { advanceSpinProgression } from "./spin-progression.js";

const previous = {
  level: 1,
  xp: 0,
  spins: 4,
  totalWon: 250,
  freeSpins: 2,
  vipPoints: 10,
};

describe("spin progression", () => {
  it("applies settled spin activity and the deterministic XP curve", () => {
    const result = advanceSpinProgression({
      previous,
      bet: 1_000,
      xpMultiplier: 1,
      totalWin: 5_000,
      freeSpinsPlayed: 3,
    });

    expect(result).toEqual({
      earnedXp: 100,
      levelsGained: 1,
      overflowXp: 0,
      progression: {
        level: 2,
        xp: 0,
        spins: 5,
        totalWon: 5_250,
        freeSpins: 5,
        vipPoints: 20,
      },
    });
  });

  it("applies boosters before resolving multiple levels and remainder XP", () => {
    const first = xpRequiredForNextLevel(1);
    const second = xpRequiredForNextLevel(2);
    const bet = Math.ceil((first + second + 25) / 2) * 10;
    const earnedXp = Math.max(10, Math.floor(bet / 10)) * 2;

    const result = advanceSpinProgression({
      previous,
      bet,
      xpMultiplier: 2,
      totalWin: 0,
      freeSpinsPlayed: 0,
    });

    expect(result.progression.level).toBe(3);
    expect(result.progression.xp).toBe(earnedXp - first - second);
    expect(result.levelsGained).toBe(2);
  });

  it("reports overflow at max level without creating a level above the cap", () => {
    const result = advanceSpinProgression({
      previous: { ...previous, level: 1_000, xp: 0 },
      bet: 500,
      xpMultiplier: 2,
      totalWin: 0,
      freeSpinsPlayed: 0,
    });

    expect(result).toMatchObject({
      earnedXp: 100,
      levelsGained: 0,
      overflowXp: 100,
      progression: { level: 1_000, xp: 0 },
    });
  });

  it("rejects invalid economy and progression arithmetic", () => {
    expect(() => advanceSpinProgression({ ...baseInput(), bet: 0 })).toThrow(RangeError);
    expect(() => advanceSpinProgression({ ...baseInput(), xpMultiplier: 1.5 })).toThrow(RangeError);
    expect(() => advanceSpinProgression({ ...baseInput(), totalWin: -1 })).toThrow(RangeError);
    expect(() => advanceSpinProgression({
      ...baseInput(),
      previous: { ...previous, totalWon: Number.MAX_SAFE_INTEGER },
      totalWin: 1,
    })).toThrow(RangeError);
  });
});

function baseInput() {
  return {
    previous,
    bet: 100,
    xpMultiplier: 1,
    totalWin: 0,
    freeSpinsPlayed: 0,
  } as const;
}
