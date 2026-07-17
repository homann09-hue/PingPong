import { describe, expect, it } from "vitest";
import { achievementById, achievementCatalog, achievementViews, canClaimAchievement } from "./achievement-system.js";

const progression = { level: 10, xp: 0, spins: 100, totalWon: 5_000_000, freeSpins: 25, vipPoints: 1_000 };

describe("achievement system", () => {
  it("publishes three durable tiers for every category", () => {
    expect(achievementCatalog).toHaveLength(15);
    expect(new Set(achievementCatalog.map((item) => item.id)).size).toBe(15);
    for (const category of ["journey", "spins", "wins", "free_spins", "vip"]) {
      expect(achievementCatalog.filter((item) => item.category === category).map((item) => item.tier))
        .toEqual(["bronze", "silver", "gold"]);
    }
  });

  it("derives progress and unlocks higher tiers only after the prior claim", () => {
    const locked = achievementViews(progression, new Set());
    expect(locked.find((item) => item.id === "achievement-high-roller")).toMatchObject({ progress: 100, completed: true, unlocked: false });
    const unlocked = achievementViews(progression, new Set(["achievement-first-spin"]));
    expect(unlocked.find((item) => item.id === "achievement-high-roller")).toMatchObject({ completed: true, unlocked: true });
  });

  it("validates both the server metric and prerequisite", () => {
    const highRoller = achievementById("achievement-high-roller")!;
    expect(canClaimAchievement(highRoller, progression, new Set())).toBe(false);
    expect(canClaimAchievement(highRoller, progression, new Set(["achievement-first-spin"]))).toBe(true);
  });
});
