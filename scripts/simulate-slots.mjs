import { SlotEngine, themedConfigs } from "../packages/slot-engine/dist/index.js";

const integerArgument = (name, fallback) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
};

const samples = integerArgument("spins", 100_000);
const requestedBet = integerArgument("bet", 100);
const requestedSlot = process.argv.find((value) => value.startsWith("--slot="))?.slice(7);
const configs = requestedSlot
  ? themedConfigs.filter((config) => config.id === requestedSlot)
  : themedConfigs;
if (configs.length === 0) throw new RangeError(`unknown slot: ${requestedSlot}`);

const reports = configs.map((config) => {
  if (config.bet && !config.bet.steps.includes(requestedBet)) {
    throw new RangeError(`${requestedBet} is not a configured bet for ${config.id}`);
  }
  const engine = new SlotEngine(config);
  let returned = 0;
  let squaredReturnMultipliers = 0;
  let winningSpins = 0;
  let belowBet = 0;
  let equalBet = 0;
  let aboveBet = 0;
  let freeSpinTriggers = 0;
  let bonusTriggers = 0;
  let respinTriggers = 0;
  let jackpotTriggers = 0;
  let maxWins = 0;
  let maximumWin = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maximumWinStreak = 0;
  let maximumLossStreak = 0;
  const rtp = { base: 0, freeSpins: 0, respins: 0, cascades: 0, bonus: 0, jackpot: 0 };
  const distribution = { zero: 0, under1x: 0, from1xTo5x: 0, from5xTo15x: 0, from15xTo50x: 0, from50xTo100x: 0, atLeast100x: 0 };

  for (let index = 0; index < samples; index++) {
    const result = engine.spin({ bet: requestedBet, seed: BigInt(index) });
    const multiplier = result.totalWin / requestedBet;
    returned += result.totalWin;
    squaredReturnMultipliers += multiplier * multiplier;
    maximumWin = Math.max(maximumWin, result.totalWin);
    if (result.maxWinReached) maxWins++;

    if (result.totalWin > 0) {
      winningSpins++;
      currentWinStreak++;
      currentLossStreak = 0;
      maximumWinStreak = Math.max(maximumWinStreak, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      maximumLossStreak = Math.max(maximumLossStreak, currentLossStreak);
    }
    if (result.totalWin < requestedBet) belowBet++;
    else if (result.totalWin === requestedBet) equalBet++;
    else aboveBet++;

    if (multiplier === 0) distribution.zero++;
    else if (multiplier < 1) distribution.under1x++;
    else if (multiplier < 5) distribution.from1xTo5x++;
    else if (multiplier < 15) distribution.from5xTo15x++;
    else if (multiplier < 50) distribution.from15xTo50x++;
    else if (multiplier < 100) distribution.from50xTo100x++;
    else distribution.atLeast100x++;

    const hasFreeSpins = result.rounds.some((round) => round.phase === "free_spin");
    const hasBonus = result.rounds.some((round) => round.phase === "bonus");
    const hasRespins = result.rounds.some((round) => round.phase === "respin");
    const hasJackpot = result.rounds.some((round) => round.events.some(
      (event) => event.type === "bonus.awarded" && event.data.mode === "jackpot",
    ));
    if (hasFreeSpins) freeSpinTriggers++;
    if (hasBonus) bonusTriggers++;
    if (hasRespins) respinTriggers++;
    if (hasJackpot) jackpotTriggers++;

    for (const round of result.rounds) {
      if (round.phase === "base") rtp.base += round.totalWin;
      else if (round.phase === "free_spin") rtp.freeSpins += round.totalWin;
      else if (round.phase === "respin") rtp.respins += round.totalWin;
      else if (round.phase === "cascade") rtp.cascades += round.totalWin;
      else if (round.events.some((event) => event.data.mode === "jackpot")) rtp.jackpot += round.totalWin;
      else rtp.bonus += round.totalWin;
    }
  }

  const meanMultiplier = returned / (samples * requestedBet);
  const variance = Math.max(0, squaredReturnMultipliers / samples - meanMultiplier ** 2);
  const standardDeviation = Math.sqrt(variance);
  const confidenceHalfWidth = 1.96 * standardDeviation / Math.sqrt(samples);
  const divisor = samples * requestedBet;
  return {
    slotId: config.id,
    slotVersion: config.version,
    mathModelVersion: config.math.mathModelVersion,
    samples,
    bet: requestedBet,
    totalWagered: samples * requestedBet,
    totalReturned: returned,
    configuredTargetRtp: config.math.targetRtp,
    simulatedRtp: meanMultiplier,
    rtpDeviation: meanMultiplier - config.math.targetRtp,
    rtp95ConfidenceInterval: [meanMultiplier - confidenceHalfWidth, meanMultiplier + confidenceHalfWidth],
    rtpBreakdown: Object.fromEntries(Object.entries(rtp).map(([key, value]) => [key, value / divisor])),
    variance,
    standardDeviation,
    hitFrequency: winningSpins / samples,
    lossOrSubBetFrequency: belowBet / samples,
    equalBetFrequency: equalBet / samples,
    profitableSpinFrequency: aboveBet / samples,
    freeSpinTriggerFrequency: freeSpinTriggers / samples,
    bonusTriggerFrequency: bonusTriggers / samples,
    respinTriggerFrequency: respinTriggers / samples,
    jackpotHitFrequency: jackpotTriggers / samples,
    maxWinFrequency: maxWins / samples,
    maximumObservedWin: maximumWin,
    maximumObservedWinMultiplier: maximumWin / requestedBet,
    maximumWinStreak,
    maximumLossStreak,
    distribution: Object.fromEntries(Object.entries(distribution).map(([key, value]) => [key, value / samples])),
  };
});

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
