export interface TournamentWindow {
  readonly periodKey: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export const activeTournamentDefinition = {
  id: "world-fortune-championship",
  version: 1,
  name: "WORLD FORTUNE CHAMPIONSHIP",
  subtitle: "Sammle faire Turnierpunkte aus jedem Spin.",
  scoring: "normalized_win_points",
  prizePool: 25_000_000,
} as const;

export function tournamentWindow(now: Date): TournamentWindow {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = (startsAt.getUTCDay() + 6) % 7;
  startsAt.setUTCDate(startsAt.getUTCDate() - weekday);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 7);
  return { periodKey: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

/** Bet-normalized scoring keeps the competition meaningful across stake levels. */
export function tournamentPoints(bet: number, totalWin: number): number {
  const participation = 25;
  if (totalWin <= 0) return participation;
  return participation + Math.min(10_000, Math.floor((totalWin / Math.max(1, bet)) * 100));
}

export function demoTournamentLeaders(now: Date): readonly { readonly name: string; readonly score: number }[] {
  const window = tournamentWindow(now);
  const elapsed = Math.max(0, Math.min(1, (now.getTime() - window.startsAt.getTime()) / (window.endsAt.getTime() - window.startsAt.getTime())));
  const pace = 20_000 + Math.floor(elapsed * 480_000);
  return [
    { name: "JackpotJenna", score: pace + 18_450 },
    { name: "RoyalRico", score: pace + 12_920 },
    { name: "SpinSofia", score: pace + 9_780 },
    { name: "DragonMax", score: pace + 6_210 },
    { name: "CandyLuna", score: pace + 3_400 },
  ];
}
