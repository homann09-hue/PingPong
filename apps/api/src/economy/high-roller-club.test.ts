import { describe, expect, it } from "vitest";
import { highRollerCashback, highRollerClubRules, highRollerSourcePoints, highRollerSpinPoints, highRollerStatus } from "./high-roller-club.js";

describe("high roller club", () => {
  it("requires 20,000 points and expires access after seven days", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(highRollerStatus(19_999, null, now)).toMatchObject({ eligible: false, active: false });
    expect(highRollerStatus(20_000, null, now)).toMatchObject({ eligible: true, active: false });
    expect(highRollerStatus(0, new Date("2026-07-24T12:00:00.000Z"), now))
      .toMatchObject({ active: true, remainingSeconds: 7 * 86_400 });
  });

  it("awards wager and Level Up Plus points", () => {
    expect(highRollerSpinPoints(999, 0)).toBe(0);
    expect(highRollerSpinPoints(10_000, 0)).toBe(100);
    expect(highRollerSpinPoints(10_000, 2)).toBe(100 + 2 * highRollerClubRules.levelUpPoints);
  });

  it("publishes versioned fixed source awards", () => {
    expect(highRollerClubRules.version).toBe(2);
    expect(highRollerSourcePoints("daily_store_bonus")).toBe(750);
    expect(highRollerSourcePoints("lobby_express")).toBe(100);
    expect(highRollerSourcePoints("wheel")).toBe(250);
    expect(highRollerSourcePoints("booster")).toBe(500);
    expect(highRollerSourcePoints("purchase")).toBe(2_000);
  });

  it("pays cashback only for active losing spins", () => {
    expect(highRollerCashback(10_000, 0, true)).toBe(200);
    expect(highRollerCashback(10_000, 10_000, true)).toBe(0);
    expect(highRollerCashback(10_000, 0, false)).toBe(0);
  });
});
