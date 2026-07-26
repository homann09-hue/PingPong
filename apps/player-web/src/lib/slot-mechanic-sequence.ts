import type { SpinEvent, SpinRoundPhase } from "./contracts";
import type { FreeSpinPresentationMode } from "./slot-feature-reveal-presentation";

export type SlotMechanicSequenceEffect =
  | "cascade"
  | "walking-wild"
  | "free-spin"
  | "respin"
  | "bonus"
  | "mystery"
  | "upgrade"
  | "multiplier"
  | "jackpot"
  | "hit";

export interface SlotMechanicSequenceStep {
  readonly effect: SlotMechanicSequenceEffect;
  readonly durationMs: number;
}

const durationByEffect: Readonly<Record<SlotMechanicSequenceEffect, number>> = {
  "free-spin": 1_500,
  respin: 1_050,
  cascade: 900,
  upgrade: 1_450,
  mystery: 1_450,
  "walking-wild": 1_250,
  multiplier: 1_100,
  bonus: 1_850,
  jackpot: 1_900,
  hit: 820,
};

function hasEvent(events: readonly SpinEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function eventText(event: SpinEvent, key: string): string | undefined {
  const value = event.data[key];
  return typeof value === "string" ? value : undefined;
}

function durationFor(effect: SlotMechanicSequenceEffect, turbo: boolean): number {
  const normalDuration = durationByEffect[effect];
  return turbo ? Math.max(180, Math.round(normalDuration * 0.28)) : normalDuration;
}

function shouldPresentMultiplier(
  phase: SpinRoundPhase,
  freeSpinMode: FreeSpinPresentationMode,
  events: readonly SpinEvent[],
): boolean {
  const multipliers = events.filter((event) => event.type === "multiplier.applied");
  if (multipliers.length === 0) return false;

  const structuralSources = new Set(["free_spin", "cascade"]);
  if (multipliers.some((event) => !structuralSources.has(eventText(event, "source") ?? ""))) return true;

  return phase !== "free_spin" && phase !== "cascade" && freeSpinMode !== "active";
}

export function buildSlotMechanicSequence(
  phase: SpinRoundPhase,
  totalWin: number,
  events: readonly SpinEvent[],
  freeSpinMode: FreeSpinPresentationMode,
  turbo = false,
): readonly SlotMechanicSequenceStep[] {
  if (hasEvent(events, "max_win.reached")) {
    return [{ effect: "jackpot", durationMs: durationFor("jackpot", turbo) }];
  }

  const effects: SlotMechanicSequenceEffect[] = [];
  if (freeSpinMode === "entry" || freeSpinMode === "retrigger") effects.push("free-spin");
  if (phase === "respin" || hasEvent(events, "respin.started")) effects.push("respin");
  if (phase === "cascade" || hasEvent(events, "cascade.started")) effects.push("cascade");
  if (hasEvent(events, "symbol.upgraded")) effects.push("upgrade");
  if (hasEvent(events, "mystery.revealed")) effects.push("mystery");
  if (hasEvent(events, "wild.walked")) effects.push("walking-wild");
  if (shouldPresentMultiplier(phase, freeSpinMode, events)) effects.push("multiplier");
  if (phase === "bonus" || hasEvent(events, "bonus.awarded")) effects.push("bonus");

  const uniqueEffects = [...new Set(effects)].slice(0, 8);
  if (uniqueEffects.length === 0 && Number.isFinite(totalWin) && totalWin > 0) uniqueEffects.push("hit");
  return uniqueEffects.map((effect) => ({ effect, durationMs: durationFor(effect, turbo) }));
}

export function slotMechanicSequenceHoldMs(
  sequence: readonly SlotMechanicSequenceStep[],
  phase: SpinRoundPhase,
  turbo = false,
): number {
  const sequenceDuration = sequence.reduce((total, step) => total + Math.max(0, step.durationMs), 0);
  if (turbo) return Math.max(120, Math.min(2_600, sequenceDuration + (sequenceDuration > 0 ? 60 : 0)));

  const phaseMinimum = phase === "base" ? 320 : 650;
  return Math.max(phaseMinimum, Math.min(10_000, sequenceDuration + (sequenceDuration > 0 ? 160 : 0)));
}

export function nextSlotMechanicStep(currentStep: number, sequenceLength: number): number {
  if (!Number.isInteger(sequenceLength) || sequenceLength <= 0) return 0;
  const normalized = Number.isInteger(currentStep) && currentStep >= 0 ? currentStep : 0;
  return Math.min(sequenceLength, normalized + 1);
}

export function slotMechanicEventSignature(
  phase: SpinRoundPhase,
  index: number,
  totalWin: number,
  events: readonly SpinEvent[],
): string {
  const eventSignature = events.slice(0, 64).map((event) => {
    const data = Object.entries(event.data)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(";");
    return `${event.type}{${data}}`;
  }).join("|");
  return `${phase}:${Math.trunc(index)}:${Number.isFinite(totalWin) ? totalWin : 0}:${eventSignature}`;
}
