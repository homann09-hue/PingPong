import { describe, expect, it } from "vitest";
import { boosterStatus, xpBoosterRules } from "./xp-booster.js";

describe("XP booster rules", () => {
  it("derives crafting and activation availability from authoritative balances", () => {
    expect(boosterStatus(2, 0, 0)).toMatchObject({ canCraft: false, canActivate: false });
    expect(boosterStatus(3, 1, 7)).toEqual({
      stamps: 3,
      stampsPerBooster: 3,
      boosters: 1,
      activeSpins: 7,
      boostedSpinsPerToken: 20,
      xpMultiplier: 2,
      maxActiveSpins: 200,
      canCraft: true,
      canActivate: true,
    });
    expect(boosterStatus(0, 1, 200).canActivate).toBe(false);
    expect(xpBoosterRules.version).toBe(1);
  });
});
