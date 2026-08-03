import type { SpinResult, Win } from "@aurora/slot-engine";

export type JackpotTier = "MINI" | "MINOR" | "MAJOR" | "GRAND";
export interface JackpotPoolView { readonly tier: JackpotTier; readonly amount: number; readonly seedAmount: number }

export const jackpotDefinitions: readonly JackpotPoolView[] = [
  { tier: "MINI", amount: 500_000, seedAmount: 500_000 },
  { tier: "MINOR", amount: 5_000_000, seedAmount: 5_000_000 },
  { tier: "MAJOR", amount: 15_000_000, seedAmount: 15_000_000 },
  { tier: "GRAND", amount: 50_000_000, seedAmount: 50_000_000 },
];

const contributionBasisPoints: Readonly<Record<JackpotTier, number>> = {
  MINI: 100,
  MINOR: 50,
  MAJOR: 35,
  GRAND: 25,
};

export function jackpotContribution(tier: JackpotTier, wager: number): number {
  return Math.max(1, Math.floor((wager * contributionBasisPoints[tier]) / 10_000));
}

export function triggeredJackpotTier(spin: SpinResult): JackpotTier | null {
  for (const round of spin.rounds) {
    for (const event of round.events) {
      if (event.type !== "bonus.awarded" || event.data.mode !== "jackpot") continue;
      const tier = event.data.tier;
      if (tier === "MINI" || tier === "MINOR" || tier === "MAJOR" || tier === "GRAND") return tier;
    }
  }
  return null;
}

function progressiveWin(tier: JackpotTier, amount: number): Win {
  return {
    kind: "scatter",
    symbol: `JACKPOT_${tier}`,
    count: 1,
    amount,
    cells: [],
  };
}

function replaceProgressivePlaceholder(
  wins: readonly Win[],
  tier: JackpotTier,
  amount: number,
): readonly Win[] {
  const placeholderSymbol = `JACKPOT_${tier}`;
  let replaced = false;
  const updated = wins.map((win) => {
    if (replaced || win.kind !== "scatter" || win.symbol !== placeholderSymbol) return win;
    replaced = true;
    return progressiveWin(tier, amount);
  });

  return replaced ? updated : [...updated, progressiveWin(tier, amount)];
}

/**
 * Replaces the matching jackpot placeholder with the authoritative pool award.
 *
 * The slot engine currently represents jackpot bonus rounds through an event and
 * a placeholder total. Settlement requires an explicit win entry, so this
 * function rebuilds the affected round and all spin-level derived values while
 * preserving unrelated wins and rounds.
 */
export function applyProgressiveAward(spin: SpinResult, tier: JackpotTier, amount: number): SpinResult {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("progressive jackpot amount must be a non-negative safe integer");
  }

  let awarded = false;
  const rounds = spin.rounds.map((round) => {
    const jackpotEventIndex = round.events.findIndex(
      (event) => event.type === "bonus.awarded"
        && event.data.mode === "jackpot"
        && event.data.tier === tier,
    );

    if (awarded || jackpotEventIndex < 0) return round;
    awarded = true;

    const wins = replaceProgressivePlaceholder(round.wins, tier, amount);
    const totalWin = wins.reduce((sum, win) => sum + win.amount, 0);
    const events = round.events.map((event, index) => index === jackpotEventIndex
      ? { ...event, data: { ...event.data, progressiveAmount: amount } }
      : event);

    return {
      ...round,
      wins,
      totalWin,
      events,
    };
  });

  if (!awarded) return spin;

  const wins = rounds.flatMap((round) => round.wins);
  const totalWin = rounds.reduce((sum, round) => sum + round.totalWin, 0);

  return {
    ...spin,
    rounds,
    wins,
    totalWin,
  };
}
