import type { SpinEvent } from "./contracts";

export interface SlotCellPresentation {
  readonly className: string;
  readonly badge?: string;
  readonly description?: string;
}

interface WalkingMove {
  readonly sourceReel: number;
  readonly sourceRow: number;
  readonly targetReel: number;
  readonly targetRow: number;
}

const MAX_EVENT_CELLS = 256;
const MAX_BADGE_MULTIPLIER = 1_000;

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function eventNumber(event: SpinEvent | undefined, key: string, maximum = 1_000_000): number | undefined {
  const value = event?.data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(0, value));
}

function parseCell(value: string): readonly [number, number] | null {
  const [rawReel, rawRow, extra] = value.split(":");
  if (extra !== undefined) return null;
  const reel = Number(rawReel);
  const row = Number(rawRow);
  if (!Number.isInteger(reel) || !Number.isInteger(row) || reel < 0 || row < 0) return null;
  return [reel, row];
}

function positions(value: string | undefined): ReadonlySet<string> {
  const entries = new Set<string>();
  for (const token of (value ?? "").split(",")) {
    if (entries.size >= MAX_EVENT_CELLS) break;
    const cell = parseCell(token.trim());
    if (cell) entries.add(`${cell[0]}:${cell[1]}`);
  }
  return entries;
}

function positionEntries(value: string | undefined): ReadonlyMap<string, number> {
  const entries = new Map<string, number>();
  for (const token of (value ?? "").split(",")) {
    if (entries.size >= MAX_EVENT_CELLS) break;
    const [rawPosition, rawValue, extra] = token.trim().split("=");
    if (!rawPosition || rawValue === undefined || extra !== undefined) continue;
    const cell = parseCell(rawPosition);
    const parsed = Number(rawValue);
    if (!cell || !Number.isFinite(parsed) || parsed <= 0) continue;
    entries.set(`${cell[0]}:${cell[1]}`, Math.min(MAX_BADGE_MULTIPLIER, parsed));
  }
  return entries;
}

function walkingMoves(value: string | undefined): ReadonlyMap<string, WalkingMove> {
  const moves = new Map<string, WalkingMove>();
  for (const token of (value ?? "").split(",")) {
    if (moves.size >= MAX_EVENT_CELLS) break;
    const [rawSource, rawTarget, extra] = token.trim().split(">");
    if (!rawSource || !rawTarget || extra !== undefined) continue;
    const source = parseCell(rawSource);
    const target = parseCell(rawTarget);
    if (!source || !target) continue;
    moves.set(`${target[0]}:${target[1]}`, {
      sourceReel: source[0],
      sourceRow: source[1],
      targetReel: target[0],
      targetRow: target[1],
    });
  }
  return moves;
}

export function presentSlotCell(
  events: readonly SpinEvent[],
  reel: number,
  row: number,
  symbol: string,
): SlotCellPresentation {
  const key = `${reel}:${row}`;
  const states: string[] = [];
  const descriptions: string[] = [];
  let badge: string | undefined;

  const stuck = events.find((event) => event.type === "wild.stuck");
  const stuckPositions = positions(eventText(stuck, "positions"));
  const newStickyPositions = positions(eventText(stuck, "newPositions"));
  if (stuckPositions.has(key)) {
    states.push("is-sticky");
    descriptions.push("Sticky Wild");
    badge = "LOCK";
  }
  if (newStickyPositions.has(key)) {
    states.push("is-new-sticky");
    descriptions.push("neu fixiert");
    badge = "+LOCK";
  }

  const walking = events.find((event) => event.type === "wild.walked");
  if (positions(eventText(walking, "positions")).has(key)) {
    states.push("is-walking-wild");
    const movement = walkingMoves(eventText(walking, "moves")).get(key);
    if (movement) {
      const fromSide = movement.sourceReel < movement.targetReel ? "left" : "right";
      const distance = Math.max(1, Math.min(4, Math.abs(movement.targetReel - movement.sourceReel)));
      states.push(`walk-from-${fromSide}`, `walk-distance-${distance}`);
      if (movement.sourceRow < movement.targetRow) states.push("walk-from-above");
      if (movement.sourceRow > movement.targetRow) states.push("walk-from-below");
      descriptions.push(`Walking Wild von Walze ${movement.sourceReel + 1} nach Walze ${movement.targetReel + 1}`);
    } else {
      states.push("walk-from-left", "walk-distance-1");
      descriptions.push(`Walking Wild Schritt ${eventNumber(walking, "step", 1_000) ?? ""}`.trim());
    }
    badge = "WILD";
  }

  const mystery = events.find((event) => event.type === "mystery.revealed");
  if (positions(eventText(mystery, "positions")).has(key)) {
    states.push("is-mystery-reveal");
    descriptions.push(`Mystery wurde zu ${eventText(mystery, "target") ?? symbol}`);
    badge = "?";
  }

  for (const event of events.filter((entry) => entry.type === "free_spins.modified")) {
    if (eventText(event, "mode") !== "extra_wilds") continue;
    if (!positions(eventText(event, "positions")).has(key)) continue;
    states.push("is-extra-wild");
    descriptions.push("zusätzliches Freispiel-Wild");
    badge = "+W";
  }

  for (const event of events.filter((entry) => entry.type === "multiplier.applied")) {
    if (eventText(event, "source") !== "multiplier_symbols") continue;
    const multiplier = positionEntries(eventText(event, "positions")).get(key);
    if (!multiplier) continue;
    states.push("is-multiplier-symbol");
    descriptions.push(`${multiplier}× Multiplikator-Symbol`);
    badge = `×${multiplier}`;
  }

  const expanded = events.find((event) => event.type === "wild.expanded" && eventNumber(event, "reel", 100) === reel);
  if (expanded) {
    states.push("is-expanded-wild");
    descriptions.push("expandiertes Wild");
    badge ??= "FULL";
  }

  const stacked = events.find((event) => {
    if (event.type !== "wild.stacked" || eventNumber(event, "reel", 100) !== reel) return false;
    const start = eventNumber(event, "startRow", 100) ?? -1;
    const size = eventNumber(event, "size", 100) ?? 0;
    return row >= start && row < start + size;
  });
  if (stacked) {
    states.push("is-stacked-wild");
    descriptions.push("gestapeltes Wild");
    badge ??= "STACK";
  }

  const scatter = events.find((event) => event.type === "scatter.hit" && eventText(event, "symbol") === symbol);
  if (scatter && positions(eventText(scatter, "positions")).has(key)) {
    states.push("is-scatter-hit");
    descriptions.push(`${eventNumber(scatter, "count", MAX_EVENT_CELLS) ?? ""} Scatter sichtbar`.trim());
    badge ??= "SCATTER";
  }

  for (const upgraded of events.filter((event) => event.type === "symbol.upgraded" && eventText(event, "to") === symbol)) {
    if (!positions(eventText(upgraded, "positions")).has(key)) continue;
    states.push("is-upgraded-symbol");
    descriptions.push(`Upgrade von ${eventText(upgraded, "from") ?? "Symbol"}`);
    badge ??= "UP";
  }

  if (states.length === 0) return { className: "" };

  return {
    className: `slot-cell-feature ${[...new Set(states)].join(" ")}`,
    badge,
    description: [...new Set(descriptions)].join(", "),
  };
}
