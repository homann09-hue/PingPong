import type { SpinEvent, SpinRoundPhase } from "./contracts";

export interface MysteryRevealPresentation {
  readonly source: string;
  readonly target: string;
  readonly count: number;
  readonly positions: readonly string[];
  readonly visibleCards: number;
}

export type FreeSpinPresentationMode = "entry" | "retrigger" | "active" | null;

export interface FreeSpinRevealPresentation {
  readonly mode: FreeSpinPresentationMode;
  readonly primary: string;
  readonly label: string;
  readonly awarded: number;
  readonly spin: number;
  readonly multiplier: number;
  readonly extraWilds: number;
  readonly specialReels: boolean;
  readonly positions: readonly string[];
}

export interface MultiplierRevealPresentation {
  readonly multiplier: number;
  readonly label: string;
  readonly sources: readonly string[];
  readonly paylineEvents: number;
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function eventNumber(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positionList(value: string | undefined): string[] {
  return [...new Set((value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^\d+:\d+$/.test(entry)))];
}

export function resolveMysteryReveal(events: readonly SpinEvent[]): MysteryRevealPresentation {
  const event = events.find((entry) => entry.type === "mystery.revealed");
  const positions = positionList(eventText(event, "positions"));
  const declaredCount = Math.trunc(eventNumber(event, "count") ?? positions.length);
  const count = Math.max(0, Math.min(100, declaredCount));
  const visibleCards = Math.max(1, Math.min(12, positions.length || count || 1));

  return {
    source: eventText(event, "symbol") ?? "?",
    target: eventText(event, "target") ?? "?",
    count,
    positions,
    visibleCards,
  };
}

export function resolveFreeSpinReveal(
  phase: SpinRoundPhase,
  index: number,
  events: readonly SpinEvent[],
): FreeSpinRevealPresentation {
  const award = events.find((entry) => entry.type === "free_spins.awarded");
  const modifiers = events.filter((entry) => entry.type === "free_spins.modified");
  const ladder = modifiers.find((entry) => eventText(entry, "mode") === "multiplier_ladder");
  const extraWilds = modifiers.find((entry) => eventText(entry, "mode") === "extra_wilds");
  const specialReels = modifiers.some((entry) => eventText(entry, "mode") === "special_reels");
  const awarded = Math.max(0, Math.min(1_000, Math.trunc(eventNumber(award, "count") ?? 0)));
  const spin = phase === "free_spin" ? Math.max(1, Math.min(10_000, Math.trunc(index))) : 0;
  const multiplier = Math.max(1, Math.min(9_999, Math.trunc(eventNumber(ladder, "multiplier") ?? 1)));
  const extraWildCount = Math.max(0, Math.min(100, Math.trunc(eventNumber(extraWilds, "count") ?? 0)));
  const positions = positionList(eventText(extraWilds, "positions"));
  const mode: FreeSpinPresentationMode = awarded > 0
    ? phase === "free_spin" ? "retrigger" : "entry"
    : phase === "free_spin" ? "active" : null;

  return {
    mode,
    primary: mode === "entry" || mode === "retrigger" ? `+${awarded}` : mode === "active" ? `${spin}` : "",
    label: mode === "entry" ? "FREISPIELE"
      : mode === "retrigger" ? "RETRIGGER"
      : mode === "active" ? `FREISPIEL ${spin}`
      : "",
    awarded,
    spin,
    multiplier,
    extraWilds: extraWildCount,
    specialReels,
    positions,
  };
}

const roundWideMultiplierSources = new Set(["free_spin", "cascade", "multiplier_symbols"]);

export function resolveMultiplierReveal(events: readonly SpinEvent[]): MultiplierRevealPresentation {
  const entries = events
    .filter((entry) => entry.type === "multiplier.applied")
    .map((entry) => ({
      source: eventText(entry, "source"),
      multiplier: eventNumber(entry, "multiplier") ?? 1,
      payline: eventNumber(entry, "payline"),
    }))
    .filter((entry) => entry.multiplier > 1);

  const globalEntries = entries.filter((entry) => entry.source && roundWideMultiplierSources.has(entry.source));
  const paylineEntries = entries.filter((entry) => entry.payline !== undefined || !entry.source);
  const globalMultiplier = globalEntries.reduce((product, entry) => Math.min(9_999, product * entry.multiplier), 1);
  const paylineMultiplier = paylineEntries.reduce((highest, entry) => Math.max(highest, entry.multiplier), 1);
  const multiplier = globalMultiplier > 1 ? globalMultiplier : paylineMultiplier;
  const sources = [...new Set(globalEntries.map((entry) => entry.source!).filter(Boolean))];

  return {
    multiplier: Math.max(1, multiplier),
    label: sources.length > 0
      ? sources.map((source) => source.replaceAll("_", " ").toUpperCase()).join(" + ")
      : paylineEntries.length > 0 ? "WILD MULTIPLIKATOR" : "MULTIPLIKATOR",
    sources,
    paylineEvents: paylineEntries.length,
  };
}
