import type { TimedRewardStatus, TimedRewardType } from "../spins/spin-store.js";

export interface TimedRewardState {
  readonly level: number;
  readonly lastClaimedAt: Date | null;
  readonly streak: number;
  readonly cyclePosition: number;
  readonly claimsTowardWheel: number;
}

const dailyCoins = [100_000, 125_000, 150_000, 200_000, 250_000, 350_000, 500_000] as const;

export function rewardStatus(type: TimedRewardType, state: TimedRewardState, now: Date): TimedRewardStatus {
  const availableAt = nextAvailableAt(type, state.lastClaimedAt, now);
  const dailyContinues = state.lastClaimedAt ? utcDay(state.lastClaimedAt) === utcDay(now) - 86_400_000 : false;
  const nextCycle = dailyContinues ? state.cyclePosition % 7 + 1 : 1;
  return {
    type,
    claimable: availableAt <= now,
    availableAt: availableAt.toISOString(),
    nextCoins: type === "hourly"
      ? 50_000 + Math.min(100, Math.max(0, state.level - 1)) * 2_000
      : dailyCoins[nextCycle - 1]!,
    streak: state.streak,
    cyclePosition: state.cyclePosition,
    claimsTowardWheel: state.claimsTowardWheel,
  };
}

export function nextRewardState(type: TimedRewardType, state: TimedRewardState, now: Date) {
  const status = rewardStatus(type, state, now);
  if (!status.claimable) return null;
  if (type === "hourly") {
    const wheelUnlocked = state.claimsTowardWheel === 3;
    return {
      coins: status.nextCoins,
      streak: state.streak,
      cyclePosition: state.cyclePosition,
      claimsTowardWheel: wheelUnlocked ? 0 : state.claimsTowardWheel + 1,
      wheelUnlocked,
    };
  }
  const continues = state.lastClaimedAt ? utcDay(state.lastClaimedAt) === utcDay(now) - 86_400_000 : false;
  return {
    coins: status.nextCoins,
    streak: continues ? state.streak + 1 : 1,
    cyclePosition: continues ? state.cyclePosition % 7 + 1 : 1,
    claimsTowardWheel: state.claimsTowardWheel,
    wheelUnlocked: false,
  };
}

function nextAvailableAt(type: TimedRewardType, last: Date | null, now: Date): Date {
  if (!last) return new Date(now);
  if (type === "hourly") return new Date(last.getTime() + 60 * 60 * 1_000);
  const next = new Date(utcDay(last) + 86_400_000);
  return next > now ? next : new Date(now);
}

function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}
