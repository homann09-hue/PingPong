import type { SpinResult } from "@aurora/slot-engine";

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

/** Replaces the configured placeholder award while preserving the audited engine result. */
export function applyProgressiveAward(spin: SpinResult, tier: JackpotTier, amount: number): SpinResult {
  let replaced = false;
  let placeholder = 0;
  const rounds = spin.rounds.map((round) => {
    const jackpotEvent = round.events.find((event) => event.type === "bonus.awarded" && event.data.mode === "jackpot");
    if (replaced || !jackpotEvent || jackpotEvent.data.tier !== tier) return round;
    replaced = true;
    placeholder = round.totalWin;
    return {
      ...round,
      totalWin: amount,
      events: round.events.map((event) => event === jackpotEvent
        ? { ...event, data: { ...event.data, progressiveAmount: amount } }
        : event),
    };
  });
  return replaced ? { ...spin, rounds, totalWin: spin.totalWin - placeholder + amount } : spin;
}
