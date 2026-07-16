import { z } from "zod";
import type { SlotConfig } from "./types.js";

const symbolSchema = z.object({
  kind: z.enum(["regular", "wild", "scatter", "mystery", "coin", "multiplier"]),
  payouts: z.record(z.coerce.number().int().positive(), z.number().int().nonnegative()),
});

const schema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  name: z.string().min(1).max(100),
  rows: z.number().int().min(1).max(12),
  reels: z.array(z.array(z.string()).min(1)).min(3).max(12),
  paylines: z.array(z.array(z.number().int().nonnegative())).min(1),
  symbols: z.record(z.string(), symbolSchema),
  bet: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    steps: z.array(z.number().int().positive()).min(1).max(100),
  }).optional(),
  math: z.object({
    targetRtp: z.number().min(0).max(1),
    volatility: z.enum(["low", "medium", "high", "very_high"]),
    expectedHitFrequency: z.number().min(0).max(1),
    maxWinMultiplier: z.number().int().min(1).max(1_000_000).default(10_000),
    mathModelVersion: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
  }),
  winClasses: z.array(z.object({
    name: z.enum(["SMALL", "NICE", "BIG", "MEGA", "EPIC"]),
    minimumMultiplier: z.number().min(0),
  })).min(1).max(5).optional(),
  features: z.object({
    variableRows: z.object({
      optionsByReel: z.array(
        z.array(z.number().int().min(1).max(12)).min(1).max(12),
      ).min(3).max(12),
    }).optional(),
    ways: z.object({
      minimumReels: z.number().int().min(2).max(12),
      betDivisor: z.number().int().positive().max(1_000_000),
    }).optional(),
    expandingWild: z.object({ symbols: z.array(z.string()).min(1) }).optional(),
    stackedWild: z.object({
      symbol: z.string(),
      minimumSize: z.number().int().min(2).max(12),
    }).optional(),
    stickyWild: z.object({
      symbol: z.string(),
      maxSticky: z.number().int().min(1).max(60),
    }).optional(),
    walkingWild: z.object({
      symbol: z.string(),
      direction: z.enum(["left", "right"]),
      maxSteps: z.number().int().min(1).max(12),
    }).optional(),
    wildMultiplier: z.object({
      symbol: z.string(),
      multiplier: z.number().int().min(2).max(10),
      maxTotalMultiplier: z.number().int().min(2).max(1_000),
    }).optional(),
    multiplierSymbols: z.object({
      symbols: z.array(z.object({
        symbol: z.string(),
        multiplier: z.number().int().min(2).max(100),
      })).min(1).max(20),
      combination: z.enum(["add", "multiply"]),
      maxTotalMultiplier: z.number().int().min(2).max(10_000),
    }).optional(),
    respins: z.object({
      triggerSymbol: z.string(),
      minimumCount: z.number().int().min(1).max(60),
      count: z.number().int().min(1).max(20),
    }).optional(),
    freeSpins: z.object({
      scatterSymbol: z.string(),
      awards: z.record(z.coerce.number().int().positive(), z.number().int().positive()),
      maxTotal: z.number().int().min(1).max(1_000),
      winMultiplier: z.number().int().min(1).max(100).optional(),
      multiplierLadder: z.array(z.object({
        fromSpin: z.number().int().min(1).max(1_000),
        multiplier: z.number().int().min(1).max(1_000),
      })).min(1).max(100).optional(),
      reelStrips: z.array(z.array(z.string()).min(1)).min(3).max(12).optional(),
      extraWilds: z.object({
        symbol: z.string(),
        count: z.number().int().min(1).max(60),
      }).optional(),
    }).optional(),
    mysteryReveal: z.object({
      symbol: z.string(),
      targets: z.array(z.string()).min(1).max(20),
    }).optional(),
    symbolUpgrade: z.object({
      triggerSymbol: z.string(),
      minimumCount: z.number().int().min(1).max(60),
      upgrades: z.array(z.object({
        from: z.string(),
        to: z.string(),
      })).min(1).max(20),
    }).optional(),
    coinCollect: z.object({
      coinSymbol: z.string(),
      collectorSymbol: z.string(),
      minimumCoins: z.number().int().min(1).max(60),
      multipliers: z.array(z.number().int().positive()).min(1).max(100),
    }).optional(),
    cascades: z.object({
      maxSteps: z.number().int().min(1).max(100),
      multiplierStep: z.number().int().min(0).max(100).optional(),
      maxMultiplier: z.number().int().min(1).max(10_000).optional(),
    }).optional(),
    bothWays: z.boolean().optional(),
    pickBonus: z.object({
      scatterSymbol: z.string(),
      minimumCount: z.number().int().min(1).max(12),
      picks: z.number().int().min(1).max(12),
      boardSize: z.number().int().min(1).max(24),
      multipliers: z.array(z.number().int().positive()).min(1).max(100),
    }).optional(),
    wheelBonus: z.object({
      scatterSymbol: z.string(),
      minimumCount: z.number().int().min(1).max(12),
      multipliers: z.array(z.number().int().positive()).min(2).max(24),
    }).optional(),
    holdAndWinBonus: z.object({
      scatterSymbol: z.string(),
      minimumCount: z.number().int().min(1).max(12),
      spotRange: z.tuple([z.number().int().min(1).max(15), z.number().int().min(1).max(15)]),
      multipliers: z.array(z.number().int().positive()).min(2).max(24),
    }).optional(),
    bonusBuy: z.object({
      costMultiplier: z.number().int().min(10).max(1_000),
    }).optional(),
    jackpots: z.object({
      scatterSymbol: z.string(),
      tiers: z.array(z.object({
        name: z.enum(["MINI", "MINOR", "MAJOR", "GRAND"]),
        minimumCount: z.number().int().min(1).max(60),
        multiplier: z.number().int().min(1).max(1_000_000),
      })).min(1).max(4),
    }).optional(),
  }).optional(),
  hooks: z.object({ spin: z.string().optional(), win: z.string().optional(), bigWin: z.string().optional() }).optional(),
});

/** Validates structural and cross-field invariants at publish time. */
export function parseSlotConfig(input: unknown): SlotConfig {
  const config = schema.parse(input) as SlotConfig;
  const symbols = new Set(Object.keys(config.symbols));
  if (config.bet) {
    if (config.bet.min > config.bet.max) throw new Error("Minimum bet must not exceed maximum bet");
    if (config.bet.steps[0] !== config.bet.min || config.bet.steps.at(-1) !== config.bet.max) {
      throw new Error("Bet steps must include configured minimum and maximum");
    }
    if (config.bet.steps.some((step, index) => step < config.bet!.min || step > config.bet!.max || (index > 0 && step <= config.bet!.steps[index - 1]!))) {
      throw new Error("Bet steps must be unique, ascending, and inside configured bounds");
    }
  }
  if (config.winClasses) {
    const names = config.winClasses.map((value) => value.name);
    const thresholds = config.winClasses.map((value) => value.minimumMultiplier);
    if (new Set(names).size !== names.length || thresholds.some((value, index) => index > 0 && value <= thresholds[index - 1]!)) {
      throw new Error("Win classes require unique names and ascending thresholds");
    }
  }
  for (const strip of config.reels) {
    if (strip.some((symbol) => !symbols.has(symbol))) throw new Error("Reel references an unknown symbol");
  }
  for (const line of config.paylines) {
    if (line.length !== config.reels.length) throw new Error("Each payline must address every reel");
    if (line.some((row) => row >= config.rows)) throw new Error("Payline row is outside the grid");
  }
  if (config.features?.ways && config.features.ways.minimumReels > config.reels.length) {
    throw new Error("Ways minimum reels must fit the configured reel count");
  }
  const variableRows = config.features?.variableRows;
  if (variableRows) {
    if (!config.features?.ways) throw new Error("Variable rows require ways evaluation");
    if (variableRows.optionsByReel.length !== config.reels.length) {
      throw new Error("Variable-row options must match the configured reel count");
    }
    if (variableRows.optionsByReel.some((options) => options.some((value, index) => (
      value > config.rows || (index > 0 && value <= options[index - 1]!)
    )))) {
      throw new Error("Variable-row options must be unique, ascending, and fit the configured rows");
    }
    const maxWays = variableRows.optionsByReel.reduce((ways, options) => ways * options.at(-1)!, 1);
    if (!Number.isSafeInteger(maxWays)) throw new Error("Variable-row maximum ways must be a safe integer");
  }
  const expanding = config.features?.expandingWild?.symbols ?? [];
  if (expanding.some((symbol) => config.symbols[symbol]?.kind !== "wild")) {
    throw new Error("Expanding wild feature must reference wild symbols");
  }
  const stacked = config.features?.stackedWild;
  if (stacked) {
    if (config.symbols[stacked.symbol]?.kind !== "wild") {
      throw new Error("Stacked wild feature must reference a wild symbol");
    }
    if (stacked.minimumSize > config.rows) {
      throw new Error("Stacked wild minimum must fit the configured rows");
    }
    const hasStack = config.reels.some((strip) => {
      const circular = [...strip, ...strip.slice(0, stacked.minimumSize - 1)];
      let run = 0;
      return circular.some((symbol) => {
        run = symbol === stacked.symbol ? run + 1 : 0;
        return run >= stacked.minimumSize;
      });
    });
    if (!hasStack) throw new Error("Stacked wild feature requires a matching reel-strip stack");
  }
  const sticky = config.features?.stickyWild?.symbol;
  if (sticky && config.symbols[sticky]?.kind !== "wild") {
    throw new Error("Sticky wild feature must reference a wild symbol");
  }
  const walking = config.features?.walkingWild?.symbol;
  if (walking && config.symbols[walking]?.kind !== "wild") {
    throw new Error("Walking wild feature must reference a wild symbol");
  }
  const multiplierWild = config.features?.wildMultiplier?.symbol;
  if (multiplierWild && config.symbols[multiplierWild]?.kind !== "wild") {
    throw new Error("Wild multiplier feature must reference a wild symbol");
  }
  const multiplierSymbols = config.features?.multiplierSymbols;
  if (multiplierSymbols) {
    const configured = multiplierSymbols.symbols.map((entry) => entry.symbol);
    if (new Set(configured).size !== configured.length) {
      throw new Error("Multiplier symbols must be unique");
    }
    if (multiplierSymbols.symbols.some((entry) => config.symbols[entry.symbol]?.kind !== "multiplier")) {
      throw new Error("Multiplier feature must reference multiplier symbols");
    }
    if (multiplierSymbols.maxTotalMultiplier < Math.max(...multiplierSymbols.symbols.map((entry) => entry.multiplier))) {
      throw new Error("Multiplier symbol cap must include every configured value");
    }
  }
  const respinTrigger = config.features?.respins?.triggerSymbol;
  if (respinTrigger && !config.symbols[respinTrigger]) {
    throw new Error("Respin feature must reference a configured symbol");
  }
  const scatter = config.features?.freeSpins?.scatterSymbol;
  if (scatter && config.symbols[scatter]?.kind !== "scatter") {
    throw new Error("Free spins must reference a scatter symbol");
  }
  const freeSpins = config.features?.freeSpins;
  if (freeSpins?.winMultiplier !== undefined && freeSpins.multiplierLadder) {
    throw new Error("Free spins cannot combine a fixed multiplier with a multiplier ladder");
  }
  if (freeSpins?.multiplierLadder) {
    const ladder = freeSpins.multiplierLadder;
    if (ladder[0]!.fromSpin !== 1) {
      throw new Error("Free-spin multiplier ladder must start at spin one");
    }
    if (ladder.some((step, index) => (
      step.fromSpin > freeSpins.maxTotal
      || (index > 0 && (
        step.fromSpin <= ladder[index - 1]!.fromSpin
        || step.multiplier <= ladder[index - 1]!.multiplier
      ))
    ))) {
      throw new Error("Free-spin multiplier ladder must increase within the configured limit");
    }
  }
  if (freeSpins?.reelStrips) {
    if (freeSpins.reelStrips.length !== config.reels.length) {
      throw new Error("Free-spin reel strips must match the base reel count");
    }
    if (freeSpins.reelStrips.some((strip) => strip.some((symbol) => !symbols.has(symbol)))) {
      throw new Error("Free-spin reel strips reference an unknown symbol");
    }
  }
  if (freeSpins?.extraWilds && config.symbols[freeSpins.extraWilds.symbol]?.kind !== "wild") {
    throw new Error("Free-spin extra wilds must reference a wild symbol");
  }
  const minimumVisibleCells = variableRows
    ? variableRows.optionsByReel.reduce((sum, options) => sum + options[0]!, 0)
    : config.reels.length * config.rows;
  if (freeSpins?.extraWilds && freeSpins.extraWilds.count > minimumVisibleCells) {
    throw new Error("Free-spin extra wild count must fit the configured grid");
  }
  const mystery = config.features?.mysteryReveal;
  if (mystery) {
    if (config.symbols[mystery.symbol]?.kind !== "mystery") {
      throw new Error("Mystery reveal must reference a mystery symbol");
    }
    if (mystery.targets.some((symbol) => !symbols.has(symbol) || symbol === mystery.symbol)) {
      throw new Error("Mystery reveal targets must reference other configured symbols");
    }
  }
  const symbolUpgrade = config.features?.symbolUpgrade;
  if (symbolUpgrade) {
    if (!symbols.has(symbolUpgrade.triggerSymbol)) {
      throw new Error("Symbol upgrade must reference a configured trigger symbol");
    }
    if (symbolUpgrade.minimumCount > config.reels.length * config.rows) {
      throw new Error("Symbol upgrade minimum must fit the configured grid");
    }
    const sources = symbolUpgrade.upgrades.map((upgrade) => upgrade.from);
    if (new Set(sources).size !== sources.length) {
      throw new Error("Symbol upgrade sources must be unique");
    }
    if (symbolUpgrade.upgrades.some((upgrade) => (
      upgrade.from === upgrade.to
      || config.symbols[upgrade.from]?.kind !== "regular"
      || config.symbols[upgrade.to]?.kind !== "regular"
    ))) {
      throw new Error("Symbol upgrades must map distinct regular symbols");
    }
  }
  const coinCollect = config.features?.coinCollect;
  if (coinCollect) {
    if (config.symbols[coinCollect.coinSymbol]?.kind !== "coin") {
      throw new Error("Coin collect must reference a coin symbol");
    }
    if (!symbols.has(coinCollect.collectorSymbol) || coinCollect.collectorSymbol === coinCollect.coinSymbol) {
      throw new Error("Coin collect must reference a distinct configured collector symbol");
    }
    if (coinCollect.minimumCoins > config.reels.length * config.rows) {
      throw new Error("Coin collect minimum must fit the configured grid");
    }
  }
  const bonusScatter = config.features?.pickBonus?.scatterSymbol;
  if (bonusScatter && config.symbols[bonusScatter]?.kind !== "scatter") {
    throw new Error("Pick bonus must reference a scatter symbol");
  }
  const pickBonus = config.features?.pickBonus;
  if (pickBonus && pickBonus.picks > pickBonus.boardSize) {
    throw new Error("Pick count must fit the configured bonus board");
  }
  const wheelScatter = config.features?.wheelBonus?.scatterSymbol;
  if (wheelScatter && config.symbols[wheelScatter]?.kind !== "scatter") {
    throw new Error("Wheel bonus must reference a scatter symbol");
  }
  const holdFeature = config.features?.holdAndWinBonus;
  if (holdFeature && config.symbols[holdFeature.scatterSymbol]?.kind !== "scatter") {
    throw new Error("Hold and win bonus must reference a scatter symbol");
  }
  if (holdFeature && holdFeature.spotRange[0] > holdFeature.spotRange[1]) {
    throw new Error("Hold and win spot range must be ascending");
  }
  if (holdFeature && holdFeature.spotRange[0] < holdFeature.minimumCount) {
    throw new Error("Hold and win spot range must include every trigger spot");
  }
  if (holdFeature && holdFeature.spotRange[1] > config.reels.length * config.rows) {
    throw new Error("Hold and win spot range must fit the configured grid");
  }
  if (config.features?.bonusBuy && !(
    config.features.pickBonus || config.features.wheelBonus || config.features.holdAndWinBonus
  )) {
    throw new Error("Bonus buy requires a configured bonus game");
  }
  const jackpot = config.features?.jackpots;
  if (jackpot && config.symbols[jackpot.scatterSymbol]?.kind !== "scatter") {
    throw new Error("Jackpots must reference a scatter symbol");
  }
  if (jackpot) {
    const counts = jackpot.tiers.map((tier) => tier.minimumCount);
    const names = jackpot.tiers.map((tier) => tier.name);
    if (new Set(counts).size !== counts.length || new Set(names).size !== names.length) {
      throw new Error("Jackpot tiers require unique names and trigger counts");
    }
    if (counts.some((count) => count > config.reels.length * config.rows)) {
      throw new Error("Jackpot trigger counts must fit the configured grid");
    }
    if (jackpot.tiers.some((tier, index) => index > 0 && (
      tier.minimumCount <= jackpot.tiers[index - 1]!.minimumCount ||
      tier.multiplier <= jackpot.tiers[index - 1]!.multiplier
    ))) {
      throw new Error("Jackpot tiers must increase by trigger count and multiplier");
    }
  }
  const cascades = config.features?.cascades;
  if (cascades?.multiplierStep && cascades.maxMultiplier !== undefined && cascades.maxMultiplier < 1 + cascades.multiplierStep) {
    throw new Error("Cascade multiplier cap must allow the first cascade multiplier");
  }
  return config;
}
