export interface Profile {
  readonly playerId: string;
  readonly coinBalance: number;
  readonly gemBalance?: number;
  readonly progression: { readonly level: number; readonly xp: number; readonly vipPoints: number };
  readonly vip?: { readonly tier: string; readonly points: number; readonly nextTierPoints: number };
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
