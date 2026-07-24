import type { PlayerProgression } from "../spins/spin-store.js";

export type AchievementCategory = "journey" | "spins" | "wins" | "free_spins" | "vip";
export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementMetric = "level" | "spins" | "total_won" | "free_spins" | "vip_points";

export interface AchievementDefinition {
  readonly id: string;
  readonly version: number;
  readonly category: AchievementCategory;
  readonly tier: AchievementTier;
  readonly name: string;
  readonly description: string;
  readonly metric: AchievementMetric;
  readonly target: number;
  readonly coins: number;
  readonly prerequisiteId?: string;
}

export interface AchievementView extends AchievementDefinition {
  readonly rewardId: string;
  readonly progress: number;
  readonly completed: boolean;
  readonly claimed: boolean;
  readonly unlocked: boolean;
}

const chain = (
  category: AchievementCategory,
  metric: AchievementMetric,
  values: readonly [AchievementTier, string, string, number, number][],
): readonly AchievementDefinition[] => values.map(([tier, id, name, target, coins], index) => ({
  id, version: 1, category, tier, name, metric, target, coins,
  description: descriptionFor(metric, target),
  ...(index > 0 ? { prerequisiteId: values[index - 1]![1] } : {}),
}));

export const achievementCatalog: readonly AchievementDefinition[] = [
  ...chain("journey", "level", [
    ["bronze", "achievement-journey-2", "AUFBRUCH", 2, 100_000],
    ["silver", "achievement-journey-10", "CASINO-ENTDECKER", 10, 750_000],
    ["gold", "achievement-journey-25", "LEGENDÄRE REISE", 25, 3_000_000],
  ]),
  ...chain("spins", "spins", [
    ["bronze", "achievement-first-spin", "FIRST SPIN", 1, 75_000],
    ["silver", "achievement-high-roller", "HIGH ROLLER", 100, 500_000],
    ["gold", "achievement-spin-master", "SPIN MASTER", 1_000, 5_000_000],
  ]),
  ...chain("wins", "total_won", [
    ["bronze", "achievement-collector", "COIN COLLECTOR", 250_000, 250_000],
    ["silver", "achievement-millionaire", "MILLIONENJÄGER", 5_000_000, 1_000_000],
    ["gold", "achievement-vault-breaker", "VAULT BREAKER", 50_000_000, 7_500_000],
  ]),
  ...chain("free_spins", "free_spins", [
    ["bronze", "achievement-free-spins-3", "BONUS STARTER", 3, 200_000],
    ["silver", "achievement-free-spins-25", "FREE-SPIN FAN", 25, 1_000_000],
    ["gold", "achievement-free-spins-100", "BONUS LEGEND", 100, 5_000_000],
  ]),
  ...chain("vip", "vip_points", [
    ["bronze", "achievement-vip-100", "VIP ANWÄRTER", 100, 150_000],
    ["silver", "achievement-vip-1000", "VIP SILBER", 1_000, 1_000_000],
    ["gold", "achievement-vip-7500", "VIP PLATIN", 7_500, 7_500_000],
  ]),
];

const definitionsById = new Map(achievementCatalog.map((definition) => [definition.id, definition]));

export function achievementById(id: string): AchievementDefinition | undefined {
  return definitionsById.get(id);
}

export function achievementProgress(definition: AchievementDefinition, progression: PlayerProgression): number {
  return switchMetric(definition.metric, progression);
}

export function achievementViews(progression: PlayerProgression, claimedRewards: ReadonlySet<string>): readonly AchievementView[] {
  return achievementCatalog.map((definition) => {
    const progress = achievementProgress(definition, progression);
    return {
      ...definition,
      rewardId: definition.id,
      progress,
      completed: progress >= definition.target,
      claimed: claimedRewards.has(definition.id),
      unlocked: definition.prerequisiteId === undefined || claimedRewards.has(definition.prerequisiteId),
    };
  });
}

export function canClaimAchievement(
  definition: AchievementDefinition,
  progression: PlayerProgression,
  claimedRewards: ReadonlySet<string>,
): boolean {
  return achievementProgress(definition, progression) >= definition.target
    && (definition.prerequisiteId === undefined || claimedRewards.has(definition.prerequisiteId));
}

function switchMetric(metric: AchievementMetric, progression: PlayerProgression): number {
  switch (metric) {
    case "level": return progression.level;
    case "spins": return progression.spins;
    case "total_won": return progression.totalWon;
    case "free_spins": return progression.freeSpins;
    case "vip_points": return progression.vipPoints;
  }
}

function descriptionFor(metric: AchievementMetric, target: number): string {
  const amount = new Intl.NumberFormat("de-DE").format(target);
  switch (metric) {
    case "level": return `Erreiche Level ${amount}`;
    case "spins": return `Spiele ${amount} Spins`;
    case "total_won": return `Gewinne insgesamt ${amount} Coins`;
    case "free_spins": return `Spiele insgesamt ${amount} Freispiele`;
    case "vip_points": return `Sammle ${amount} VIP-Punkte`;
  }
}
