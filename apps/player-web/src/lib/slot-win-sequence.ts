import type { SpinWin } from "./contracts";
import { presentSlotWinOverlay, type SlotWinTrace } from "./slot-win-overlay-presentation";

export interface SlotWinSequenceStep {
  readonly traceIndex: number;
  readonly durationMs: number;
}

const baseDurationByKind: Readonly<Record<SlotWinTrace["kind"], number>> = {
  path: 1_250,
  ways: 1_400,
  cluster: 1_550,
  scatter: 1_350,
  cells: 1_200,
};

function traceDuration(trace: SlotWinTrace, turbo: boolean): number {
  const normalDuration = Math.min(2_000, baseDurationByKind[trace.kind] + Math.min(420, trace.points.length * 45));
  return turbo ? Math.max(180, Math.round(normalDuration * 0.28)) : normalDuration;
}

export function buildSlotWinSequence(
  traces: readonly SlotWinTrace[],
  turbo = false,
): readonly SlotWinSequenceStep[] {
  return traces.map((trace, traceIndex) => ({
    traceIndex,
    durationMs: traceDuration(trace, turbo),
  }));
}

export function buildSlotWinSequenceForRound(
  wins: readonly SpinWin[],
  grid: readonly (readonly string[])[],
  turbo = false,
): readonly SlotWinSequenceStep[] {
  return buildSlotWinSequence(presentSlotWinOverlay(wins, grid), turbo);
}

export function slotWinSequenceHoldMs(
  sequence: readonly SlotWinSequenceStep[],
  turbo = false,
): number {
  if (sequence.length === 0) return 0;
  const sequenceDuration = sequence.reduce((total, step) => total + Math.max(0, step.durationMs), 0);
  return turbo
    ? Math.min(2_000, sequenceDuration + 50)
    : Math.min(8_000, sequenceDuration + 140);
}

export function nextSlotWinStep(currentStep: number, sequenceLength: number): number {
  if (!Number.isInteger(sequenceLength) || sequenceLength <= 1) return 0;
  const normalized = Number.isInteger(currentStep) && currentStep >= 0 ? currentStep : 0;
  return (normalized + 1) % sequenceLength;
}

export function slotWinTraceCellKeys(trace: SlotWinTrace | undefined): readonly string[] {
  if (!trace) return [];
  return [...new Set(trace.points.map((point) => `${point.reel}:${point.row}`))];
}
