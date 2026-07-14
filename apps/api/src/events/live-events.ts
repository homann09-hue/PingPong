export type EventMetric = "spin_count" | "wager_total" | "win_total" | "free_spin_count";
export type EventCadence = "daily" | "weekly";

export interface EventMilestoneDefinition {
  readonly id: string;
  readonly target: number;
  readonly rewardCoins: number;
}

export interface LiveEventDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly subtitle: string;
  readonly cadence: EventCadence;
  readonly metric: EventMetric;
  readonly accent: "gold" | "cyan";
  readonly milestones: readonly EventMilestoneDefinition[];
}

export const liveEventDefinitions: readonly LiveEventDefinition[] = [
  {
    id: "world-fortune",
    version: 1,
    title: "WORLD FORTUNE",
    subtitle: "Gewinne Coins und erreiche die wöchentlichen Schatzstufen.",
    cadence: "weekly",
    metric: "win_total",
    accent: "gold",
    milestones: [
      { id: "bronze", target: 50_000, rewardCoins: 100_000 },
      { id: "royal", target: 250_000, rewardCoins: 500_000 },
      { id: "legend", target: 1_000_000, rewardCoins: 2_000_000 },
    ],
  },
  {
    id: "spin-sprint",
    version: 1,
    title: "SPIN SPRINT",
    subtitle: "Jeder Echtgeld-freie Spin zählt bis zum Tagesfinale.",
    cadence: "daily",
    metric: "spin_count",
    accent: "cyan",
    milestones: [
      { id: "starter", target: 10, rewardCoins: 75_000 },
      { id: "turbo", target: 25, rewardCoins: 200_000 },
      { id: "finish", target: 50, rewardCoins: 500_000 },
    ],
  },
] as const;

export interface EventWindow {
  readonly periodKey: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export function eventWindow(cadence: EventCadence, now: Date): EventWindow {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (cadence === "weekly") startsAt.setUTCDate(startsAt.getUTCDate() - ((startsAt.getUTCDay() + 6) % 7));
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + (cadence === "weekly" ? 7 : 1));
  return { periodKey: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

export function eventIncrement(metric: EventMetric, wager: number, win: number, freeSpins: number): number {
  return { spin_count: 1, wager_total: wager, win_total: win, free_spin_count: freeSpins }[metric];
}
