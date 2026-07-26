import type { SpinEvent } from "./contracts";

export type SlotBonusMode = "hold-and-win" | "coin-collect" | "pick" | "wheel" | "jackpot" | "generic";

export interface SlotBonusSpot {
  readonly position: number;
  readonly multiplier: number;
  readonly revealOrder: number;
  readonly initial: boolean;
}

export interface SlotBonusPresentation {
  readonly mode: SlotBonusMode;
  readonly boardSize: number;
  readonly columns: number;
  readonly spots: readonly SlotBonusSpot[];
  readonly picks: readonly number[];
  readonly multiplier: number;
  readonly segment?: number;
  readonly tier?: string;
  readonly respinSteps: number;
  readonly collectorCount?: number;
}

function bonusEvent(events: readonly SpinEvent[]): SpinEvent | undefined {
  return events.find((event) => event.type === "bonus.awarded");
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function eventNumber(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numbers(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));
}

function awards(value: string | undefined, revealOrder: number, initial: boolean): SlotBonusSpot[] {
  const result: SlotBonusSpot[] = [];
  for (const token of (value ?? "").split(",")) {
    const [rawPosition, rawMultiplier] = token.trim().split("=");
    const position = Number(rawPosition);
    const multiplier = Number(rawMultiplier);
    if (!Number.isInteger(position) || position < 0 || !Number.isFinite(multiplier) || multiplier <= 0) continue;
    result.push({ position, multiplier, revealOrder, initial });
  }
  return result;
}

function holdSpots(event: SpinEvent | undefined): { spots: SlotBonusSpot[]; respinSteps: number } {
  const collected = new Map<number, SlotBonusSpot>();
  for (const spot of awards(eventText(event, "initialSpots"), 0, true)) collected.set(spot.position, spot);

  const rawSteps = eventText(event, "respinSteps") ?? "";
  const steps = rawSteps ? rawSteps.split(";") : [];
  steps.forEach((step, stepIndex) => {
    const separator = step.indexOf(":");
    const encodedAwards = separator >= 0 ? step.slice(separator + 1) : "";
    for (const spot of awards(encodedAwards, stepIndex + 1, false)) {
      if (!collected.has(spot.position)) collected.set(spot.position, spot);
    }
  });

  return { spots: [...collected.values()], respinSteps: steps.length };
}

function modeFor(event: SpinEvent | undefined): SlotBonusMode {
  switch ((eventText(event, "mode") ?? "").replaceAll("_", "-")) {
    case "hold-and-win": return "hold-and-win";
    case "coin-collect": return "coin-collect";
    case "pick": return "pick";
    case "wheel": return "wheel";
    case "jackpot": return "jackpot";
    default: return "generic";
  }
}

function boardColumns(boardSize: number): number {
  if (boardSize <= 4) return boardSize;
  if (boardSize % 5 === 0) return 5;
  if (boardSize % 4 === 0) return 4;
  return Math.min(5, Math.max(3, Math.ceil(Math.sqrt(boardSize))));
}

export function resolveSlotBonusPresentation(events: readonly SpinEvent[]): SlotBonusPresentation {
  const event = bonusEvent(events);
  const mode = modeFor(event);
  const multiplier = Math.max(0, eventNumber(event, "multiplier") ?? 0);
  const picks = numbers(eventText(event, "picks"));
  const hold = holdSpots(event);
  const coinSpots = awards(eventText(event, "coins"), 0, true);
  const spots = mode === "hold-and-win" ? hold.spots : mode === "coin-collect" ? coinSpots : [];
  const highestPosition = spots.reduce((highest, spot) => Math.max(highest, spot.position), -1);
  const declaredBoardSize = eventNumber(event, "boardSize");
  const boardSize = Math.max(1, Math.min(30, Math.trunc(declaredBoardSize ?? Math.max(15, highestPosition + 1))));

  return {
    mode,
    boardSize,
    columns: boardColumns(boardSize),
    spots: spots.filter((spot) => spot.position < boardSize),
    picks,
    multiplier,
    ...(eventNumber(event, "segment") !== undefined ? { segment: eventNumber(event, "segment") } : {}),
    ...(eventText(event, "tier") ? { tier: eventText(event, "tier") } : {}),
    respinSteps: mode === "hold-and-win" ? hold.respinSteps : 0,
    ...(eventNumber(event, "collectorCount") !== undefined ? { collectorCount: eventNumber(event, "collectorCount") } : {}),
  };
}
