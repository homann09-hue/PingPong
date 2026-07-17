/** Versioned Stamp-to-Booster and activation terms. */
export const xpBoosterRules = Object.freeze({
  version: 1,
  stampsPerBooster: 3,
  boostedSpinsPerToken: 20,
  xpMultiplier: 2,
  maxActiveSpins: 200,
});

export interface BoosterStatus {
  readonly stamps: number;
  readonly stampsPerBooster: number;
  readonly boosters: number;
  readonly activeSpins: number;
  readonly boostedSpinsPerToken: number;
  readonly xpMultiplier: number;
  readonly maxActiveSpins: number;
  readonly canCraft: boolean;
  readonly canActivate: boolean;
}

export interface BoosterCraft {
  readonly actionId: string;
  readonly stampsSpent: number;
  readonly boostersGranted: number;
  readonly stampBalance: number;
  readonly boosterBalance: number;
  readonly replayed: boolean;
}

export interface BoosterActivation {
  readonly actionId: string;
  readonly boostersSpent: number;
  readonly boosterBalance: number;
  readonly activeSpins: number;
  readonly replayed: boolean;
}

export function boosterStatus(stamps: number, boosters: number, activeSpins: number): BoosterStatus {
  return {
    stamps,
    stampsPerBooster: xpBoosterRules.stampsPerBooster,
    boosters,
    activeSpins,
    boostedSpinsPerToken: xpBoosterRules.boostedSpinsPerToken,
    xpMultiplier: xpBoosterRules.xpMultiplier,
    maxActiveSpins: xpBoosterRules.maxActiveSpins,
    canCraft: stamps >= xpBoosterRules.stampsPerBooster,
    canActivate: boosters > 0 && activeSpins + xpBoosterRules.boostedSpinsPerToken <= xpBoosterRules.maxActiveSpins,
  };
}
