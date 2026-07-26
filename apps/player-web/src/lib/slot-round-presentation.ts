import type { SpinEvent, SpinRound, SpinRoundPhase } from "./contracts";

export type RoundTone = "base" | "feature" | "bonus" | "jackpot";

export interface RoundPresentation {
  readonly phase: SpinRoundPhase;
  readonly label: string;
  readonly detail: string;
  readonly tone: RoundTone;
}

function eventOf(round: SpinRound, type: string): SpinEvent | undefined {
  return round.events.find((event) => event.type === type);
}

function numeric(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" ? value : undefined;
}

function text(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

export function presentSpinRound(round: SpinRound, mechanicLabel: string): RoundPresentation {
  const maxWin = eventOf(round, "max_win.reached");
  if (maxWin) {
    return {
      phase: round.phase,
      label: "MAX WIN",
      detail: `${numeric(maxWin, "multiplier") ?? "—"}× Maximalgewinn erreicht`,
      tone: "jackpot",
    };
  }

  const bonus = eventOf(round, "bonus.awarded");
  if (round.phase === "bonus" || bonus) {
    return {
      phase: round.phase,
      label: "BONUSRUNDE",
      detail: text(bonus, "type")?.replaceAll("_", " ") ?? mechanicLabel,
      tone: "bonus",
    };
  }

  const freeSpins = eventOf(round, "free_spins.awarded");
  if (round.phase === "free_spin") {
    const multiplier = numeric(eventOf(round, "multiplier.applied"), "multiplier");
    return {
      phase: round.phase,
      label: `FREISPIEL ${round.index}`,
      detail: multiplier && multiplier > 1 ? `${multiplier}× Gewinnmultiplikator` : mechanicLabel,
      tone: "feature",
    };
  }
  if (freeSpins) {
    return {
      phase: round.phase,
      label: "FREISPIELE",
      detail: `${numeric(freeSpins, "count") ?? numeric(freeSpins, "awarded") ?? "Mehrere"} Runden gewonnen`,
      tone: "bonus",
    };
  }

  if (round.phase === "cascade" || eventOf(round, "cascade.started")) {
    const multiplier = numeric(eventOf(round, "multiplier.applied"), "multiplier");
    return {
      phase: round.phase,
      label: `KASKADE ${round.index}`,
      detail: multiplier && multiplier > 1 ? `${multiplier}× Kaskaden-Multiplikator` : "Gewinnsymbole explodieren",
      tone: "feature",
    };
  }

  if (round.phase === "respin" || eventOf(round, "respin.started")) {
    return {
      phase: round.phase,
      label: `RESPIN ${round.index}`,
      detail: "Walzen werden erneut ausgewertet",
      tone: "feature",
    };
  }

  const mystery = eventOf(round, "mystery.revealed");
  if (mystery) {
    return {
      phase: round.phase,
      label: "MYSTERY REVEAL",
      detail: `${numeric(mystery, "count") ?? 0} Symbole werden zu ${text(mystery, "target") ?? "Premium-Symbolen"}`,
      tone: "feature",
    };
  }

  const upgraded = eventOf(round, "symbol.upgraded");
  if (upgraded) {
    return {
      phase: round.phase,
      label: "SYMBOL UPGRADE",
      detail: `${text(upgraded, "from") ?? "Symbole"} → ${text(upgraded, "to") ?? "Premium"}`,
      tone: "feature",
    };
  }

  const expandedWild = eventOf(round, "wild.expanded");
  if (expandedWild) {
    return {
      phase: round.phase,
      label: "EXPANDING WILD",
      detail: `${numeric(expandedWild, "count") ?? 1} Wild-Erweiterung aktiviert`,
      tone: "feature",
    };
  }

  const walkingWild = eventOf(round, "wild.walked");
  if (walkingWild) {
    return {
      phase: round.phase,
      label: "WALKING WILD",
      detail: `${text(walkingWild, "direction") ?? "Weiter"} · Schritt ${numeric(walkingWild, "step") ?? round.index}`,
      tone: "feature",
    };
  }

  const multiplier = numeric(eventOf(round, "multiplier.applied"), "multiplier");
  if (multiplier && multiplier > 1) {
    return {
      phase: round.phase,
      label: `${multiplier}× MULTIPLIKATOR`,
      detail: mechanicLabel,
      tone: "feature",
    };
  }

  return {
    phase: round.phase,
    label: round.totalWin > 0 ? "TREFFER" : "HAUPTSPIEL",
    detail: round.totalWin > 0 ? mechanicLabel : "Walzen werden ausgewertet",
    tone: "base",
  };
}
