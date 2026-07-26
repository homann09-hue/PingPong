import type { SlotWinTrace } from "./slot-win-overlay-presentation";

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

export function buildSlotWinSequence(traces: readonly SlotWinTrace[]): readonly SlotWinSequenceStep[] {
  return traces.map((trace, traceIndex) => ({
    traceIndex,
    durationMs: Math.min(2_000, baseDurationByKind[trace.kind] + Math.min(420, trace.points.length * 45)),
  }));
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
