/** Versioned Check-&-Win exchange parameters shared by every store adapter. */
export const checkWinReward = Object.freeze({
  version: 1,
  requiredMarks: 5,
  rewardCoins: 100_000,
  rewardStamps: 1,
});

export interface CheckWinStatus {
  readonly marks: number;
  readonly requiredMarks: number;
  readonly claimable: boolean;
  readonly rewardCoins: number;
  readonly rewardStamps: number;
}

export interface CheckWinClaim {
  readonly claimId: string;
  readonly marksSpent: number;
  readonly coins: number;
  readonly stamps: number;
  readonly coinBalance: number;
  readonly markBalance: number;
  readonly stampBalance: number;
  readonly replayed: boolean;
}

export function checkWinStatus(marks: number): CheckWinStatus {
  return {
    marks,
    requiredMarks: checkWinReward.requiredMarks,
    claimable: marks >= checkWinReward.requiredMarks,
    rewardCoins: checkWinReward.rewardCoins,
    rewardStamps: checkWinReward.rewardStamps,
  };
}
