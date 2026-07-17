import { describe, expect, it } from "vitest";
import { missionCatalog, missionUnlock, missionWindow } from "./mission-system.js";

describe("mission system", () => {
  it("uses UTC daily, three-day, and Monday weekly windows", () => {
    const now = new Date("2026-07-17T23:59:00Z");
    expect(missionWindow("daily", now).periodKey).toBe("2026-07-17");
    expect(missionWindow("three_day", now).endsAt).toBe("2026-07-18T00:00:00.000Z");
    expect(missionWindow("weekly", now).periodKey).toBe("2026-07-13");
  });

  it("unlocks Super and Crazy tiers only from server-counted claims", () => {
    const superMission = missionCatalog.definitions.find((mission) => mission.tier === "super")!;
    const crazyMission = missionCatalog.definitions.find((mission) => mission.tier === "crazy" && mission.metric !== "daily_mission_claims")!;
    expect(missionUnlock(superMission, 2, 0).unlocked).toBe(false);
    expect(missionUnlock(superMission, 3, 0).unlocked).toBe(true);
    expect(missionUnlock(crazyMission, 3, 1)).toMatchObject({ unlocked: false, progress: 4, target: 5 });
    expect(missionUnlock(crazyMission, 3, 2).unlocked).toBe(true);
  });
});
