import { describe, expect, it } from "vitest";
import { checkWinReward, checkWinStatus } from "./check-win.js";

describe("Check-&-Win reward", () => {
  it("becomes claimable only when the configured mark threshold is reached", () => {
    expect(checkWinStatus(checkWinReward.requiredMarks - 1)).toMatchObject({ claimable: false, marks: 4 });
    expect(checkWinStatus(checkWinReward.requiredMarks)).toEqual({
      marks: 5,
      requiredMarks: 5,
      claimable: true,
      rewardCoins: 100_000,
      rewardStamps: 1,
    });
  });
});
