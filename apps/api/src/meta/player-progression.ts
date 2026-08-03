export interface PlayerProgressionState {
  readonly level: number;
  readonly xpIntoLevel: number;
}

export interface PlayerProgressionConfig {
  readonly maxLevel: number;
  readonly baseXp: number;
  readonly linearGrowth: number;
  readonly quadraticGrowth: number;
}

export interface PlayerProgressionResult extends PlayerProgressionState {
  readonly previousLevel: number;
  readonly levelsGained: number;
  readonly xpToNextLevel: number;
  readonly overflowXp: number;
}

export const defaultPlayerProgressionConfig: PlayerProgressionConfig = {
  maxLevel: 1_000,
  baseXp: 100,
  linearGrowth: 25,
  quadraticGrowth: 0.35,
};

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function validateConfig(config: PlayerProgressionConfig): void {
  if (!Number.isSafeInteger(config.maxLevel) || config.maxLevel < 1) {
    throw new RangeError("maxLevel must be a positive safe integer");
  }

  assertSafeNonNegativeInteger(config.baseXp, "baseXp");
  assertSafeNonNegativeInteger(config.linearGrowth, "linearGrowth");

  if (!Number.isFinite(config.quadraticGrowth) || config.quadraticGrowth < 0) {
    throw new RangeError("quadraticGrowth must be a finite non-negative number");
  }
}

export function xpRequiredForNextLevel(
  level: number,
  config: PlayerProgressionConfig = defaultPlayerProgressionConfig,
): number {
  validateConfig(config);

  if (!Number.isSafeInteger(level) || level < 1 || level > config.maxLevel) {
    throw new RangeError(`level must be between 1 and ${config.maxLevel}`);
  }

  if (level === config.maxLevel) return 0;

  const completedLevels = level - 1;
  const required = Math.floor(
    config.baseXp
      + completedLevels * config.linearGrowth
      + completedLevels * completedLevels * config.quadraticGrowth,
  );

  if (!Number.isSafeInteger(required) || required < 1) {
    throw new RangeError("progression curve produced an invalid XP requirement");
  }

  return required;
}

export function totalXpRequiredForLevel(
  targetLevel: number,
  config: PlayerProgressionConfig = defaultPlayerProgressionConfig,
): number {
  validateConfig(config);

  if (!Number.isSafeInteger(targetLevel) || targetLevel < 1 || targetLevel > config.maxLevel) {
    throw new RangeError(`targetLevel must be between 1 and ${config.maxLevel}`);
  }

  let total = 0;

  for (let level = 1; level < targetLevel; level += 1) {
    total += xpRequiredForNextLevel(level, config);

    if (!Number.isSafeInteger(total)) {
      throw new RangeError("cumulative progression XP exceeds the safe integer range");
    }
  }

  return total;
}

export function applyPlayerXp(
  state: PlayerProgressionState,
  awardedXp: number,
  config: PlayerProgressionConfig = defaultPlayerProgressionConfig,
): PlayerProgressionResult {
  validateConfig(config);
  assertSafeNonNegativeInteger(awardedXp, "awardedXp");

  if (!Number.isSafeInteger(state.level) || state.level < 1 || state.level > config.maxLevel) {
    throw new RangeError(`state.level must be between 1 and ${config.maxLevel}`);
  }

  assertSafeNonNegativeInteger(state.xpIntoLevel, "state.xpIntoLevel");

  const previousLevel = state.level;

  if (state.level === config.maxLevel) {
    if (state.xpIntoLevel !== 0) {
      throw new RangeError("max-level players must have zero xpIntoLevel");
    }

    return {
      level: state.level,
      xpIntoLevel: 0,
      previousLevel,
      levelsGained: 0,
      xpToNextLevel: 0,
      overflowXp: awardedXp,
    };
  }

  const currentRequirement = xpRequiredForNextLevel(state.level, config);

  if (state.xpIntoLevel >= currentRequirement) {
    throw new RangeError("xpIntoLevel must be lower than the current level requirement");
  }

  let level = state.level;
  let xpIntoLevel = state.xpIntoLevel + awardedXp;

  if (!Number.isSafeInteger(xpIntoLevel)) {
    throw new RangeError("awarded XP exceeds the safe integer range");
  }

  while (level < config.maxLevel) {
    const required = xpRequiredForNextLevel(level, config);

    if (xpIntoLevel < required) break;

    xpIntoLevel -= required;
    level += 1;
  }

  const overflowXp = level === config.maxLevel ? xpIntoLevel : 0;

  if (level === config.maxLevel) {
    xpIntoLevel = 0;
  }

  return {
    level,
    xpIntoLevel,
    previousLevel,
    levelsGained: level - previousLevel,
    xpToNextLevel: level === config.maxLevel
      ? 0
      : xpRequiredForNextLevel(level, config) - xpIntoLevel,
    overflowXp,
  };
}
