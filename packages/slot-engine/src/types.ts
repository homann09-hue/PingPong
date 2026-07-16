/** A stable integer seed represented as a decimal string at API boundaries. */
export type RngSeed = bigint;

/** Immutable slot definition. Published versions must never be edited in place. */
export interface SlotConfig {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly rows: number;
  readonly reels: readonly (readonly string[])[];
  readonly paylines: readonly (readonly number[])[];
  readonly symbols: Readonly<Record<string, SymbolDefinition>>;
  readonly bet?: BetConfig;
  readonly math: MathProfile;
  readonly winClasses?: readonly WinClassDefinition[];
  readonly features?: FeatureConfig;
  readonly hooks?: PresentationHooks;
}

export interface BetConfig {
  readonly min: number;
  readonly max: number;
  readonly steps: readonly number[];
}

export interface WinClassDefinition {
  readonly name: "SMALL" | "NICE" | "BIG" | "MEGA" | "EPIC";
  readonly minimumMultiplier: number;
}

export interface FeatureConfig {
  readonly variableRows?: {
    readonly optionsByReel: readonly (readonly number[])[];
  };
  readonly ways?: {
    readonly minimumReels: number;
    readonly betDivisor: number;
  };
  readonly expandingWild?: { readonly symbols: readonly string[] };
  readonly stackedWild?: { readonly symbol: string; readonly minimumSize: number };
  readonly stickyWild?: { readonly symbol: string; readonly maxSticky: number };
  readonly walkingWild?: {
    readonly symbol: string;
    readonly direction: "left" | "right";
    readonly maxSteps: number;
  };
  readonly wildMultiplier?: {
    readonly symbol: string;
    readonly multiplier: number;
    readonly maxTotalMultiplier: number;
  };
  readonly multiplierSymbols?: {
    readonly symbols: readonly {
      readonly symbol: string;
      readonly multiplier: number;
    }[];
    readonly combination: "add" | "multiply";
    readonly maxTotalMultiplier: number;
  };
  readonly respins?: {
    readonly triggerSymbol: string;
    readonly minimumCount: number;
    readonly count: number;
  };
  readonly freeSpins?: {
    readonly scatterSymbol: string;
    readonly awards: Readonly<Record<number, number>>;
    readonly maxTotal: number;
    readonly winMultiplier?: number;
    readonly multiplierLadder?: readonly {
      readonly fromSpin: number;
      readonly multiplier: number;
    }[];
    readonly reelStrips?: readonly (readonly string[])[];
    readonly extraWilds?: {
      readonly symbol: string;
      readonly count: number;
    };
  };
  readonly mysteryReveal?: {
    readonly symbol: string;
    readonly targets: readonly string[];
  };
  readonly symbolUpgrade?: {
    readonly triggerSymbol: string;
    readonly minimumCount: number;
    readonly upgrades: readonly {
      readonly from: string;
      readonly to: string;
    }[];
  };
  readonly coinCollect?: {
    readonly coinSymbol: string;
    readonly collectorSymbol: string;
    readonly minimumCoins: number;
    readonly multipliers: readonly number[];
  };
  readonly cascades?: {
    readonly maxSteps: number;
    readonly multiplierStep?: number;
    readonly maxMultiplier?: number;
  };
  readonly bothWays?: boolean;
  readonly pickBonus?: {
    readonly scatterSymbol: string;
    readonly minimumCount: number;
    readonly multipliers: readonly number[];
  };
  readonly wheelBonus?: {
    readonly scatterSymbol: string;
    readonly minimumCount: number;
    readonly multipliers: readonly number[];
  };
  readonly holdAndWinBonus?: {
    readonly scatterSymbol: string;
    readonly minimumCount: number;
    readonly spotRange: readonly [number, number];
    readonly multipliers: readonly number[];
  };
  readonly bonusBuy?: { readonly costMultiplier: number };
  readonly jackpots?: {
    readonly scatterSymbol: string;
    readonly tiers: readonly {
      readonly name: "MINI" | "MINOR" | "MAJOR" | "GRAND";
      readonly minimumCount: number;
      readonly multiplier: number;
    }[];
  };
}

export interface SymbolDefinition {
  readonly kind: "regular" | "wild" | "scatter" | "mystery" | "coin" | "multiplier";
  readonly payouts: Readonly<Record<number, number>>;
}

export interface MathProfile {
  readonly targetRtp: number;
  readonly volatility: "low" | "medium" | "high" | "very_high";
  readonly expectedHitFrequency: number;
  readonly maxWinMultiplier: number;
  readonly mathModelVersion: string;
}

export interface PresentationHooks {
  readonly spin?: string;
  readonly win?: string;
  readonly bigWin?: string;
}

export interface SpinRequest {
  readonly bet: number;
  readonly seed: RngSeed;
  readonly bonusBuy?: boolean;
}

export interface LineWin {
  readonly kind: "line";
  readonly payline: number;
  readonly direction?: "left" | "right";
  readonly symbol: string;
  readonly count: number;
  readonly amount: number;
  readonly cells: readonly [number, number][];
}

export interface ScatterWin {
  readonly kind: "scatter";
  readonly symbol: string;
  readonly count: number;
  readonly amount: number;
  readonly cells: readonly [number, number][];
}

export interface WaysWin {
  readonly kind: "ways";
  readonly symbol: string;
  readonly count: number;
  readonly ways: number;
  readonly amount: number;
  readonly cells: readonly [number, number][];
}

export type Win = LineWin | ScatterWin | WaysWin;

export interface EngineEvent {
  readonly type: "layout.changed" | "wild.expanded" | "wild.stacked" | "wild.stuck" | "wild.walked" | "multiplier.applied" | "scatter.hit" | "free_spins.awarded" | "free_spins.modified" | "mystery.revealed" | "symbol.upgraded" | "ways.win" | "respin.started" | "cascade.started" | "bonus.awarded" | "max_win.reached";
  readonly data: Readonly<Record<string, number | string>>;
}

export interface SpinRound {
  readonly phase: "base" | "free_spin" | "respin" | "cascade" | "bonus";
  readonly index: number;
  readonly grid: readonly (readonly string[])[];
  readonly wins: readonly Win[];
  readonly totalWin: number;
  readonly events: readonly EngineEvent[];
}

export interface SpinResult {
  readonly configId: string;
  readonly configVersion: number;
  readonly mathModelVersion: string;
  readonly seed: string;
  readonly baseBet: number;
  readonly wager: number;
  readonly bonusBuy: boolean;
  readonly stops: readonly number[];
  readonly grid: readonly (readonly string[])[];
  readonly wins: readonly Win[];
  readonly rounds: readonly SpinRound[];
  readonly freeSpinsPlayed: number;
  readonly totalWin: number;
  readonly maxWinReached: boolean;
  readonly maxWinMultiplier: number;
  readonly winClass?: "SMALL" | "NICE" | "BIG" | "MEGA" | "EPIC" | "MAX";
}
