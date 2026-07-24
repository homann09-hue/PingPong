import { describe, expect, it } from "vitest";
import { missionCatalog, missionUnlock, missionWindow } from "./mission-system.js";

function missionById(id: string) {
  const mission = missionCatalog.definitions.find((entry) => entry.id === id);
  expect(mission).toBeDefined();
  return mission!;
}

describe("mission catalogue v3", () => {
  it("uses the current catalogue version and unique IDs", () => {
    expect(missionCatalog.version).toBe(3);
    const ids = missionCatalog.definitions.map((mission) => mission.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applies the approved reduced coin rewards", () => {
    expect(missionById("daily-wager-10000").rewards.coins).toBe(15_000);
    expect(missionById("daily-win-50000").rewards.coins).toBe(20_000);
    expect(missionById("weekly-bar-7").rewards.coins).toBe(200_000);
  });

  it("keeps every reward component non-negative and safely representable", () => {
    for (const mission of missionCatalog.definitions) {
      for (const value of Object.values(mission.rewards)) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps direct coin rewards within conservative economy guardrails", () => {
    for (const mission of missionCatalog.definitions) {
      if (mission.metric === "wager_total") {
        expect(mission.rewards.coins).toBeLessThanOrEqual(mission.target * 1.5);
      }

      if (mission.metric === "win_total") {
        expect(mission.rewards.coins).toBeLessThanOrEqual(mission.target * 0.4);
      }
    }
  });

  it("uses UTC daily, three-day, and Monday weekly windows", () => {
    const now = new Date("2026-07-17T23:59:00Z");
    expect(missionWindow("daily", now)).toEqual({
      periodKey: "2026-07-17",
      startsAt: "2026-07-17T00:00:00.000Z",
      endsAt: "2026-07-18T00:00:00.000Z",
    });
    expect(missionWindow("three_day", now).endsAt).toBe("2026-07-18T00:00:00.000Z");
    expect(missionWindow("weekly", now).periodKey).toBe("2026-07-13");
  });

  it("unlocks Super and Crazy tiers only from server-counted claims", () => {
    const superMission = missionCatalog.definitions.find((mission) => mission.tier === "super")!;
    const crazyMission = missionById("crazy-win-500000");
    expect(missionUnlock(superMission, 2, 0).unlocked).toBe(false);
    expect(missionUnlock(superMission, 3, 0).unlocked).toBe(true);
    expect(missionUnlock(crazyMission, 3, 1)).toMatchObject({ unlocked: false, progress: 4, target: 5 });
    expect(missionUnlock(crazyMission, 3, 2).unlocked).toBe(true);
  });
});
