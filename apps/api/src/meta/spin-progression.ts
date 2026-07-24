import { applyPlayerXp } from "./player-progression.js";

export interface SpinProgressionSnapshot {
  readonly level: number;
  readonly xp: number;
  readonly spins: number;
  readonly totalWon: number;
  readonly freeSpins: number;
  readonly vipPoints: number;
}

export interface SpinProgressionInput {
  readonly previous: SpinProgressionSnapshot;
  readonly bet: number;
  readonly xpMultiplier: number;
  readonly totalWin: number;
  readonly freeSpinsPlayed: number;
}

export interface SpinProgressionResult {
  readonly progression: SpinProgressionSnapshot;
  readonly earnedXp: number;
  readonly levelsGained: number;
  readonly overflowXp: number;
}

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function checkedAdd(left: number, right: number, name: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError(`${name} exceeds the non-negative safe integer range`);
  }
  return result;
}

/**
 * Applies one settled spin to the server-authoritative player progression state.
 * Wallet rewards deliberately remain outside this pure calculation.
 */
export function advanceSpinProgression(input: SpinProgressionInput): SpinProgressionResult {
  assertSafeNonNegativeInteger(input.previous.spins, "previous.spins");
  assertSafeNonNegativeInteger(input.previous.totalWon, "previous.totalWon");
  assertSafeNonNegativeInteger(input.previous.freeSpins, "previous.freeSpins");
  assertSafeNonNegativeInteger(input.previous.vipPoints, "previous.vipPoints");
  assertSafeNonNegativeInteger(input.bet, "bet");
  assertSafeNonNegativeInteger(input.totalWin, "totalWin");
  assertSafeNonNegativeInteger(input.freeSpinsPlayed, "freeSpinsPlayed");

  if (input.bet < 1) throw new RangeError("bet must be positive");
  if (!Number.isSafeInteger(input.xpMultiplier) || input.xpMultiplier < 1) {
    throw new RangeError("xpMultiplier must be a positive safe integer");
  }

  const baseXp = Math.max(10, Math.floor(input.bet / 10));
  const earnedXp = baseXp * input.xpMultiplier;
  if (!Number.isSafeInteger(earnedXp)) {
    throw new RangeError("earned XP exceeds the safe integer range");
  }

  const levelResult = applyPlayerXp({
    level: input.previous.level,
    xpIntoLevel: input.previous.xp,
  }, earnedXp);

  const progression: SpinProgressionSnapshot = {
    level: levelResult.level,
    xp: levelResult.xpIntoLevel,
    spins: checkedAdd(input.previous.spins, 1, "spin count"),
    totalWon: checkedAdd(input.previous.totalWon, input.totalWin, "total won"),
    freeSpins: checkedAdd(input.previous.freeSpins, input.freeSpinsPlayed, "free spins"),
    vipPoints: checkedAdd(input.previous.vipPoints, Math.max(1, Math.floor(input.bet / 100)), "VIP points"),
  };

  return {
    progression,
    earnedXp,
    levelsGained: levelResult.levelsGained,
    overflowXp: levelResult.overflowXp,
  };
}
