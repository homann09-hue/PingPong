export const highRollerClubRules = {
  version: 1,
  entryPoints: 20_000,
  accessDays: 7,
  losingSpinCashbackBasisPoints: 200,
  levelUpPoints: 1_000,
  diamondStampsPerActivation: 1,
  leaguePointMultiplier: 2,
} as const;

/** Slot ids whose virtual-coin spin path requires an active club term. */
export const highRollerExclusiveSlotIds = ["neon-nights"] as const;

export function requiresHighRollerMembership(slotId: string): boolean {
  return (highRollerExclusiveSlotIds as readonly string[]).includes(slotId);
}

export const highRollerPointSources = [
  { id: "spins", label: "Spins nach Einsatzhöhe" },
  { id: "level_up", label: "Levelaufstiege" },
  { id: "daily_store_bonus", label: "Täglicher Store-Bonus" },
  { id: "lobby_express", label: "Lobby Express Bonus" },
  { id: "wheel", label: "Wheel Bonus" },
  { id: "space_battle", label: "Space Battle" },
  { id: "oinky", label: "Oinky" },
  { id: "booster", label: "Booster" },
  { id: "golden_pass", label: "Golden Pass" },
  { id: "purchase", label: "Käufe" },
] as const;

export const highRollerBenefits = [
  { id: "endless_cashback", label: "Endless Cashback", detail: "2 % Cashback auf Verlust-Spins" },
  { id: "diamond_stamp", label: "Diamond Stamp", detail: "1 Stamp bei jeder Aktivierung" },
  { id: "level_up_plus", label: "Level Up Plus", detail: "1.000 Zusatzpunkte pro Level" },
  { id: "exclusive_slots", label: "High-Roller-Slots", detail: "Zugang zu exklusiven Spielen" },
  { id: "double_league", label: "Doppelte League-Punkte", detail: "2× World-Slots-League-Punkte" },
] as const;

export interface HighRollerClubStatus {
  readonly version: number;
  readonly points: number;
  readonly entryPoints: number;
  readonly eligible: boolean;
  readonly active: boolean;
  readonly activeUntil: string | null;
  readonly remainingSeconds: number;
  readonly sources: typeof highRollerPointSources;
  readonly benefits: readonly (typeof highRollerBenefits[number] & { readonly active: boolean })[];
}

export interface HighRollerActivation extends HighRollerClubStatus {
  readonly activationId: string;
  readonly pointsSpent: number;
  readonly stampsGranted: number;
  readonly stampBalance: number;
  readonly replayed: boolean;
}

export function highRollerStatus(points: number, activeUntil: Date | null, now: Date): HighRollerClubStatus {
  const active = activeUntil !== null && activeUntil.getTime() > now.getTime();
  return {
    version: highRollerClubRules.version,
    points,
    entryPoints: highRollerClubRules.entryPoints,
    eligible: !active && points >= highRollerClubRules.entryPoints,
    active,
    activeUntil: active ? activeUntil!.toISOString() : null,
    remainingSeconds: active ? Math.max(0, Math.ceil((activeUntil!.getTime() - now.getTime()) / 1_000)) : 0,
    sources: highRollerPointSources,
    benefits: highRollerBenefits.map((benefit) => ({ ...benefit, active })),
  };
}

export function highRollerSpinPoints(bet: number, levelsGained: number): number {
  const wagerPoints = bet >= 1_000 ? Math.max(1, Math.floor(bet / 100)) : 0;
  return wagerPoints + Math.max(0, levelsGained) * highRollerClubRules.levelUpPoints;
}

export function highRollerCashback(bet: number, totalWin: number, active: boolean): number {
  if (!active || totalWin >= bet) return 0;
  return Math.floor((bet * highRollerClubRules.losingSpinCashbackBasisPoints) / 10_000);
}
