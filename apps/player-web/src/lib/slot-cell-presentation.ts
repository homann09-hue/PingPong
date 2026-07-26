import type { SpinEvent } from "./contracts";

export interface SlotCellPresentation {
  readonly className: string;
  readonly badge?: string;
  readonly description?: string;
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function eventNumber(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" ? value : undefined;
}

function positions(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean));
}

function positionEntries(value: string | undefined): ReadonlyMap<string, number> {
  const entries = new Map<string, number>();
  for (const token of (value ?? "").split(",")) {
    const [position, rawValue] = token.trim().split("=");
    if (!position || rawValue === undefined) continue;
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) entries.set(position, parsed);
  }
  return entries;
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
    descriptions.push(`Walking Wild Schritt ${eventNumber(walking, "step") ?? ""}`.trim());
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

  const expanded = events.find((event) => event.type === "wild.expanded" && eventNumber(event, "reel") === reel);
  if (expanded) {
    states.push("is-expanded-wild");
    descriptions.push("expandiertes Wild");
    badge ??= "FULL";
  }

  const stacked = events.find((event) => {
    if (event.type !== "wild.stacked" || eventNumber(event, "reel") !== reel) return false;
    const start = eventNumber(event, "startRow") ?? -1;
    const size = eventNumber(event, "size") ?? 0;
    return row >= start && row < start + size;
  });
  if (stacked) {
    states.push("is-stacked-wild");
    descriptions.push("gestapeltes Wild");
    badge ??= "STACK";
  }

  const scatter = events.find((event) => event.type === "scatter.hit" && eventText(event, "symbol") === symbol);
  if (scatter) {
    states.push("is-scatter-hit");
    descriptions.push(`${eventNumber(scatter, "count") ?? ""} Scatter sichtbar`.trim());
    badge ??= "SCATTER";
  }

  const upgraded = events.find((event) => event.type === "symbol.upgraded" && eventText(event, "to") === symbol);
  if (upgraded) {
    states.push("is-upgraded-symbol");
    descriptions.push(`Upgrade von ${eventText(upgraded, "from") ?? "Symbol"}`);
    badge ??= "UP";
  }

  if (states.length === 0) return { className: "" };

  return {
    className: `slot-cell-feature ${states.join(" ")}`,
    badge,
    description: descriptions.join(", "),
  };
}
