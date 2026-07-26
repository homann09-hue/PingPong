import type { SpinEvent } from "./contracts";

export interface SymbolUpgradeStep {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly triggerCount: number;
  readonly positions: readonly string[];
}

export interface SymbolUpgradePresentation {
  readonly steps: readonly SymbolUpgradeStep[];
  readonly totalCount: number;
  readonly triggerCount: number;
  readonly exactPositionCount: number;
}

function eventText(event: SpinEvent, key: string): string | undefined {
  const value = event.data[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function eventCount(event: SpinEvent, key: string): number {
  const value = event.data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function positionList(value: string | undefined): readonly string[] {
  return [...new Set((value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^\d+:\d+$/.test(entry)))];
}

export function resolveSymbolUpgradePresentation(events: readonly SpinEvent[]): SymbolUpgradePresentation {
  const steps = events
    .filter((event) => event.type === "symbol.upgraded")
    .flatMap((event): SymbolUpgradeStep[] => {
      const from = eventText(event, "from");
      const to = eventText(event, "to");
      if (!from || !to || from === to) return [];
      return [{
        from,
        to,
        count: eventCount(event, "count"),
        triggerCount: eventCount(event, "triggerCount"),
        positions: positionList(eventText(event, "positions")),
      }];
    })
    .slice(0, 4);

  return {
    steps,
    totalCount: Math.min(400, steps.reduce((sum, step) => sum + step.count, 0)),
    triggerCount: steps.reduce((highest, step) => Math.max(highest, step.triggerCount), 0),
    exactPositionCount: new Set(steps.flatMap((step) => step.positions)).size,
  };
}
