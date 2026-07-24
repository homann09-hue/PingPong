export type MissionCadence = "daily" | "three_day" | "weekly" | "event";
export type MissionTier = "standard" | "pro" | "super" | "crazy";
export type MissionMetric = "spin_count" | "wager_total" | "win_total" | "free_spin_count" | "daily_mission_claims";

export interface MissionRewards {
  readonly coins: number;
  readonly missionPoints: number;
  readonly loyaltyPoints: number;
  readonly stamps: number;
  readonly toolboxes: number;
  readonly boosters: number;
}

export interface MissionLootReward {
  readonly tableId: string;
  readonly tableVersion: number;
  readonly expiresInSeconds: number;
}

export interface MissionDefinition {
  readonly id: string;
  readonly version: number;
  readonly cadence: MissionCadence;
  readonly tier: MissionTier;
  readonly translationKey: string;
  readonly metric: MissionMetric;
  readonly target: number;
  readonly rewards: MissionRewards;
  readonly lootReward: MissionLootReward;
  readonly unlockDailyClaims: number;
  readonly unlockProClaims: number;
}

const reward = (coins: number, missionPoints: number, loyaltyPoints: number,
  stamps = 0, toolboxes = 0, boosters = 0): MissionRewards =>
  ({ coins, missionPoints, loyaltyPoints, stamps, toolboxes, boosters });

const lootReward = (tier: MissionTier): MissionLootReward => ({
  tableId: `mission-${tier}-reward`,
  tableVersion: 1,
  expiresInSeconds: 7 * 24 * 60 * 60,
});

/** Versioned mission content mirrored into PostgreSQL by additive migrations. */
export const missionCatalog = {
  version: 3,
  definitions: [
    { id: "daily-spins-10", version: 3, cadence: "daily", tier: "standard", translationKey: "mission.daily_spins_10",
      metric: "spin_count", target: 10, rewards: reward(12_500, 10, 25), lootReward: lootReward("standard"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "daily-wager-10000", version: 3, cadence: "daily", tier: "standard", translationKey: "mission.daily_wager_10000",
      metric: "wager_total", target: 10_000, rewards: reward(15_000, 15, 40), lootReward: lootReward("standard"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "daily-win-50000", version: 3, cadence: "daily", tier: "standard", translationKey: "mission.daily_win_50000",
      metric: "win_total", target: 50_000, rewards: reward(20_000, 20, 60, 1), lootReward: lootReward("standard"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "pro-spins-40", version: 3, cadence: "three_day", tier: "pro", translationKey: "mission.pro_spins_40",
      metric: "spin_count", target: 40, rewards: reward(45_000, 40, 100, 1), lootReward: lootReward("pro"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "pro-wager-100000", version: 3, cadence: "three_day", tier: "pro", translationKey: "mission.pro_wager_100000",
      metric: "wager_total", target: 100_000, rewards: reward(75_000, 60, 150, 0, 1), lootReward: lootReward("pro"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "super-free-spins-3", version: 3, cadence: "daily", tier: "super", translationKey: "mission.super_free_spins_3",
      metric: "free_spin_count", target: 3, rewards: reward(35_000, 50, 125, 1, 0, 1), lootReward: lootReward("super"), unlockDailyClaims: 3, unlockProClaims: 0 },
    { id: "crazy-win-500000", version: 3, cadence: "three_day", tier: "crazy", translationKey: "mission.crazy_win_500000",
      metric: "win_total", target: 500_000, rewards: reward(150_000, 150, 300, 2, 1, 1), lootReward: lootReward("crazy"), unlockDailyClaims: 3, unlockProClaims: 2 },
    { id: "weekly-bar-1", version: 3, cadence: "weekly", tier: "standard", translationKey: "mission.weekly_bar_1",
      metric: "daily_mission_claims", target: 1, rewards: reward(15_000, 10, 25), lootReward: lootReward("standard"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "weekly-bar-3", version: 3, cadence: "weekly", tier: "pro", translationKey: "mission.weekly_bar_3",
      metric: "daily_mission_claims", target: 3, rewards: reward(60_000, 30, 75, 1), lootReward: lootReward("pro"), unlockDailyClaims: 0, unlockProClaims: 0 },
    { id: "weekly-bar-7", version: 3, cadence: "weekly", tier: "crazy", translationKey: "mission.weekly_bar_7",
      metric: "daily_mission_claims", target: 7, rewards: reward(200_000, 100, 250, 2, 1, 1), lootReward: lootReward("crazy"), unlockDailyClaims: 0, unlockProClaims: 0 },
  ] satisfies readonly MissionDefinition[],
} as const;

export interface MissionWindow { readonly periodKey: string; readonly startsAt: string; readonly endsAt: string }

export function missionWindow(cadence: MissionCadence, now: Date): MissionWindow {
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  let startDay = day;
  let days = 1;
  if (cadence === "weekly") { startDay = day - ((now.getUTCDay() + 6) % 7); days = 7; }
  if (cadence === "three_day") { startDay = day - (day % 3); days = 3; }
  const startsAt = new Date(startDay * 86_400_000);
  const endsAt = new Date((startDay + days) * 86_400_000);
  return { periodKey: startsAt.toISOString().slice(0, 10), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function missionUnlock(definition: MissionDefinition, dailyClaims: number, proClaims: number): {
  readonly unlocked: boolean; readonly progress: number; readonly target: number;
} {
  const target = definition.unlockDailyClaims + definition.unlockProClaims;
  const progress = Math.min(definition.unlockDailyClaims, dailyClaims)
    + Math.min(definition.unlockProClaims, proClaims);
  return { unlocked: progress >= target, progress, target };
}
