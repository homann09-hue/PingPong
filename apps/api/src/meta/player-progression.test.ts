import { describe, expect, it } from "vitest";
import {
  applyPlayerXp,
  defaultPlayerProgressionConfig,
  totalXpRequiredForLevel,
  xpRequiredForNextLevel,
} from "./player-progression.js";

describe("player progression", () => {
  it("uses a deterministic, monotonically increasing XP curve", () => {
    const requirements = Array.from(
      { length: 100 },
      (_, index) => xpRequiredForNextLevel(index + 1),
    );

    expect(requirements).toEqual(Array.from(
      { length: 100 },
      (_, index) => xpRequiredForNextLevel(index + 1),
    ));

    for (let index = 1; index < requirements.length; index += 1) {
      expect(requirements[index]).toBeGreaterThanOrEqual(requirements[index - 1]!);
    }
  });

  it("applies XP across multiple levels without losing remainder XP", () => {
    const first = xpRequiredForNextLevel(1);
    const second = xpRequiredForNextLevel(2);

    const result = applyPlayerXp(
      { level: 1, xpIntoLevel: 40 },
      first + second + 25,
    );

    expect(result).toEqual({
      level: 3,
      xpIntoLevel: 65,
      previousLevel: 1,
      levelsGained: 2,
      xpToNextLevel: xpRequiredForNextLevel(3) - 65,
      overflowXp: 0,
    });
  });

  it("calculates cumulative XP consistently", () => {
    expect(totalXpRequiredForLevel(1)).toBe(0);
    expect(totalXpRequiredForLevel(4)).toBe(
      xpRequiredForNextLevel(1)
        + xpRequiredForNextLevel(2)
        + xpRequiredForNextLevel(3),
    );
  });

  it("caps players at max level and reports overflow XP", () => {
    const config = {
      ...defaultPlayerProgressionConfig,
      maxLevel: 3,
    };

    const result = applyPlayerXp(
      { level: 2, xpIntoLevel: 0 },
      xpRequiredForNextLevel(2, config) + 500,
      config,
    );

    expect(result).toEqual({
      level: 3,
      xpIntoLevel: 0,
      previousLevel: 2,
      levelsGained: 1,
      xpToNextLevel: 0,
      overflowXp: 500,
    });
  });

  it("reports all new XP as overflow for an already capped player", () => {
    const config = {
      ...defaultPlayerProgressionConfig,
      maxLevel: 3,
    };

    expect(applyPlayerXp({ level: 3, xpIntoLevel: 0 }, 250, config)).toEqual({
      level: 3,
      xpIntoLevel: 0,
      previousLevel: 3,
      levelsGained: 0,
      xpToNextLevel: 0,
      overflowXp: 250,
    });
  });

  it("rejects malformed or unsafe progression input", () => {
    expect(() => applyPlayerXp({ level: 0, xpIntoLevel: 0 }, 1)).toThrow(RangeError);
    expect(() => applyPlayerXp({ level: 1, xpIntoLevel: -1 }, 1)).toThrow(RangeError);
    expect(() => applyPlayerXp({ level: 1, xpIntoLevel: 0 }, -1)).toThrow(RangeError);
    expect(() => applyPlayerXp({ level: 1, xpIntoLevel: 0 }, 1.5)).toThrow(RangeError);
    expect(() => applyPlayerXp({ level: 1, xpIntoLevel: 0 }, Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => applyPlayerXp(
      { level: 1, xpIntoLevel: xpRequiredForNextLevel(1) },
      0,
    )).toThrow(RangeError);
    expect(() => applyPlayerXp(
      { level: defaultPlayerProgressionConfig.maxLevel, xpIntoLevel: 1 },
      0,
    )).toThrow(RangeError);
  });
});
