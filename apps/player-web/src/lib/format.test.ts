import { describe, expect, it } from "vitest";
import { coinNumber, compactNumber, describeMission, missionTierLabel, timeLeft } from "./format";

describe("wallet formatting", () => {
  it("keeps exact coin balances readable in German locale", () => expect(coinNumber(8_399_900)).toBe("8.399.900"));
  it("compacts lobby jackpot values in German locale", () => expect(compactNumber(72_450_000)).toBe("72,5 Mio."));
});

describe("mission copy", () => {
  it("describes spin missions", () => expect(describeMission("spin_count", 10)).toBe("Spiele 10 Spins"));
  it("describes wager missions", () => expect(describeMission("wager_total", 10_000)).toBe("Setze insgesamt 10.000 Coins"));
  it("describes win missions", () => expect(describeMission("win_total", 50_000)).toBe("Gewinne insgesamt 50.000 Coins"));
  it("labels weekly missions", () => expect(missionTierLabel("standard", "weekly")).toBe("Woche"));
  it("labels daily standard missions", () => expect(missionTierLabel("standard", "daily")).toBe("Täglich"));
});

describe("time remaining", () => {
  it("is empty without a date", () => expect(timeLeft(undefined)).toBe(""));
  it("is empty for past dates", () => expect(timeLeft("2000-01-01T00:00:00.000Z")).toBe(""));
});
