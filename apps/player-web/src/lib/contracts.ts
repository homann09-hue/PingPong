export interface Balance { readonly currency: string; readonly balance: number }

export interface Achievement {
  readonly id: string;
  readonly category: string;
  readonly tier: string;
  readonly name: string;
  readonly metric: string;
  readonly target: number;
  readonly coins: number;
  readonly description: string;
  readonly rewardId: string;
  readonly progress: number;
  readonly completed: boolean;
  readonly claimed: boolean;
  readonly unlocked: boolean;
  readonly prerequisiteId?: string;
}

export interface Tournament {
  readonly id: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly prizePool: number;
  readonly endsAt: string;
  readonly score: number;
  readonly rank: number;
  readonly entrants: number;
  readonly leaders: readonly { readonly name: string; readonly score: number }[];
}

export interface Profile {
  readonly playerId: string;
  readonly coinBalance: number;
  readonly gemBalance?: number;
  readonly balances?: readonly Balance[];
  readonly progression: {
    readonly level: number;
    readonly xp: number;
    readonly vipPoints: number;
    readonly spins?: number;
    readonly totalWon?: number;
    readonly freeSpins?: number;
  };
  readonly vip?: { readonly tier: string; readonly points: number; readonly nextTierPoints: number };
  readonly achievements?: readonly Achievement[];
  readonly tournament?: Tournament;
}

export interface Mission {
  readonly id: string;
  readonly cadence: string;
  readonly tier: string;
  readonly translationKey: string;
  readonly metric: string;
  readonly target: number;
  readonly rewardCoins: number;
  readonly progress: number;
  readonly completed: boolean;
  readonly claimed: boolean;
  readonly unlocked: boolean;
  readonly endsAt: string;
  readonly unlockTarget?: number;
  readonly unlockProgress?: number;
}

export interface JackpotTier { readonly tier: string; readonly amount: number; readonly seedAmount?: number }

export interface LiveEvent {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly cadence: string;
  readonly metric: string;
  readonly accent?: string;
  readonly endsAt: string;
  readonly progress: number;
  readonly milestones: readonly {
    readonly id: string;
    readonly target: number;
    readonly rewardCoins: number;
    readonly completed: boolean;
    readonly claimed: boolean;
  }[];
}

export interface PaytableSymbol {
  readonly kind?: string;
  readonly payouts?: Readonly<Record<string, number>>;
}

/** Vom Server veroeffentlichte Gewinntabelle eines Slots. */
export interface Paytable {
  readonly slotId?: string;
  readonly version?: number;
  readonly targetRtp: number;
  readonly volatility?: string;
  readonly paylines?: number;
  readonly maxWinMultiplier?: number;
  readonly betSteps?: readonly number[];
  readonly bonusBuyMultiplier?: number | null;
  readonly symbols?: Readonly<Record<string, PaytableSymbol>>;
}

export interface SpinWin {
  readonly amount: number;
  readonly cells: readonly [number, number][];
}

export interface SpinResult {
  readonly coinBalance: number;
  readonly spin: {
    readonly grid: readonly (readonly string[])[];
    readonly wins: readonly SpinWin[];
    readonly totalWin: number;
    readonly freeSpinsPlayed: number;
    readonly winClass?: string;
    readonly rounds: readonly { readonly phase: string; readonly totalWin: number }[];
  };
  readonly jackpots?: readonly { readonly tier: string; readonly amount: number }[];
}

export const initialGrid: readonly (readonly string[])[] = [
  ["A", "K", "Q"], ["J", "W", "K"], ["Q", "A", "J"], ["K", "S", "A"], ["J", "Q", "K"],
];
