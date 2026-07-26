import type { SpinEvent, SpinRoundPhase } from "./contracts";
import { coinNumber } from "./format";
import { resolveSlotBonusPresentation } from "./slot-bonus-presentation";
import { resolveFreeSpinReveal, resolveMultiplierReveal, resolveMysteryReveal } from "./slot-feature-reveal-presentation";

export interface SlotFeatureMetric {
  readonly label: string;
  readonly value: string;
}

export interface SlotFeatureStatusPresentation {
  readonly kicker: string;
  readonly headline: string;
  readonly metrics: readonly SlotFeatureMetric[];
  readonly tags: readonly string[];
  readonly tone: "idle" | "win" | "feature" | "bonus" | "max";
}

function eventsOf(events: readonly SpinEvent[], type: string): readonly SpinEvent[] {
  return events.filter((event) => event.type === type);
}

function eventOf(events: readonly SpinEvent[], type: string): SpinEvent | undefined {
  return events.find((event) => event.type === type);
}

function boundedNumber(value: unknown, maximum = 1_000_000_000): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(0, value));
}

function eventNumber(event: SpinEvent | undefined, key: string, maximum?: number): number | undefined {
  return boundedNumber(event?.data[key], maximum);
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function maxEventNumber(events: readonly SpinEvent[], type: string, key: string, maximum?: number): number | undefined {
  const values = eventsOf(events, type)
    .map((event) => eventNumber(event, key, maximum))
    .filter((value): value is number => value !== undefined);
  return values.length > 0 ? Math.max(...values) : undefined;
}

function walkingDirection(event: SpinEvent | undefined): string {
  const firstMove = (eventText(event, "moves") ?? "").split(",")[0]?.trim();
  const [source, target] = firstMove?.split(">") ?? [];
  const sourceReel = Number(source?.split(":")[0]);
  const targetReel = Number(target?.split(":")[0]);
  if (!Number.isInteger(sourceReel) || !Number.isInteger(targetReel)) return "MOVE";
  return targetReel < sourceReel ? "← LINKS" : "RECHTS →";
}

function bonusHeadline(mode: string): string {
  switch (mode) {
    case "hold-and-win": return "HOLD & WIN";
    case "coin-collect": return "COIN COLLECT";
    case "pick": return "PICK BONUS";
    case "wheel": return "BONUS WHEEL";
    case "jackpot": return "JACKPOT";
    default: return "BONUS BOARD";
  }
}

function phaseMetric(phase: SpinRoundPhase | undefined, index: number): SlotFeatureMetric | undefined {
  const safeIndex = Math.max(1, Math.min(1_000, Math.trunc(boundedNumber(index, 1_000) ?? 1)));
  if (phase === "free_spin") return { label: "Freispiel", value: String(safeIndex) };
  if (phase === "cascade") return { label: "Kaskade", value: String(safeIndex) };
  if (phase === "respin") return { label: "Respin", value: String(safeIndex) };
  return undefined;
}

function pushMetric(metrics: SlotFeatureMetric[], label: string, value: string | undefined): void {
  if (!value || metrics.some((metric) => metric.label === label)) return;
  metrics.push({ label, value });
}

export function resolveSlotFeatureStatus(input: Readonly<{
  active: boolean;
  phase?: SpinRoundPhase;
  index: number;
  totalWin: number;
  events: readonly SpinEvent[];
  mechanicLabel: string;
}>): SlotFeatureStatusPresentation {
  if (!input.active) {
    return {
      kicker: "AURORA FEATURE",
      headline: "FEATURE READY",
      metrics: [
        { label: "Mechanik", value: input.mechanicLabel },
        { label: "Status", value: "Bereit" },
      ],
      tags: [],
      tone: "idle",
    };
  }

  const { phase, index, events } = input;
  const safeTotalWin = boundedNumber(input.totalWin) ?? 0;
  const maxWin = eventOf(events, "max_win.reached");
  const bonus = resolveSlotBonusPresentation(events);
  const mystery = resolveMysteryReveal(events);
  const freeSpins = resolveFreeSpinReveal(phase ?? "base", index, events);
  const multiplier = Math.max(1, boundedNumber(resolveMultiplierReveal(events).multiplier, 1_000_000) ?? 1);
  const walking = eventOf(events, "wild.walked");
  const sticky = eventOf(events, "wild.stuck");
  const expanded = eventOf(events, "wild.expanded");
  const stacked = eventOf(events, "wild.stacked");
  const upgrade = eventOf(events, "symbol.upgraded");
  const ways = maxEventNumber(events, "ways.win", "ways", 10_000_000);
  const cluster = maxEventNumber(events, "cluster.win", "count", 10_000);
  const scatter = maxEventNumber(events, "scatter.hit", "count", 10_000);
  const layout = eventOf(events, "layout.changed");

  let headline = "HAUPTSPIEL";
  let tone: SlotFeatureStatusPresentation["tone"] = safeTotalWin > 0 ? "win" : "feature";
  if (maxWin) { headline = "MAX WIN"; tone = "max"; }
  else if (phase === "bonus" || eventOf(events, "bonus.awarded")) { headline = bonusHeadline(bonus.mode); tone = "bonus"; }
  else if (walking) headline = "WALKING WILD";
  else if (eventOf(events, "mystery.revealed")) headline = "MYSTERY REVEAL";
  else if (phase === "free_spin") headline = `FREISPIEL ${Math.max(1, Math.min(1_000, Math.trunc(boundedNumber(index, 1_000) ?? 1)))}`;
  else if (phase === "cascade") headline = `KASKADE ${Math.max(1, Math.min(1_000, Math.trunc(boundedNumber(index, 1_000) ?? 1)))}`;
  else if (phase === "respin") headline = `RESPIN ${Math.max(1, Math.min(1_000, Math.trunc(boundedNumber(index, 1_000) ?? 1)))}`;
  else if (cluster) headline = "CLUSTER WIN";
  else if (ways) headline = "WAYS WIN";
  else if (scatter) headline = "SCATTER HIT";
  else if (multiplier > 1) headline = "MULTIPLIKATOR";

  const metrics: SlotFeatureMetric[] = [];
  const round = phaseMetric(phase, index);
  if (round) metrics.push(round);
  if (ways) pushMetric(metrics, "Ways", coinNumber(ways));
  else if (cluster) pushMetric(metrics, "Cluster", `${coinNumber(cluster)} Symbole`);
  else if (scatter) pushMetric(metrics, "Scatter", `${coinNumber(scatter)} Treffer`);
  else if (layout) pushMetric(metrics, "Layout", `${coinNumber(eventNumber(layout, "ways", 10_000_000) ?? 0)} Ways`);

  if (multiplier > 1) pushMetric(metrics, "Multiplikator", `${coinNumber(multiplier)}×`);
  else if (walking) pushMetric(metrics, "Wild-Pfad", `${walkingDirection(walking)} · ${coinNumber(eventNumber(walking, "count", 100) ?? 1)}`);
  else if (eventOf(events, "mystery.revealed")) pushMetric(metrics, "Reveal", `${coinNumber(boundedNumber(mystery.count, 100) ?? 0)} → ${mystery.target}`);
  else if (bonus.multiplier > 0) pushMetric(metrics, "Bonus", `${coinNumber(boundedNumber(bonus.multiplier, 1_000_000) ?? 0)}×`);

  const awarded = boundedNumber(freeSpins.awarded, 1_000) ?? 0;
  if (awarded > 0) pushMetric(metrics, "Gewonnen", `+${coinNumber(awarded)} Spins`);

  const payoutMetric: SlotFeatureMetric = {
    label: maxWin ? "Limit" : "Rundengewinn",
    value: safeTotalWin > 0 ? coinNumber(safeTotalWin) : "—",
  };

  const tags: string[] = [];
  if (sticky) tags.push(`${coinNumber(eventNumber(sticky, "count", 100) ?? 0)} WILDS LOCKED`);
  if (expanded) tags.push(`EXPAND R${Math.trunc(eventNumber(expanded, "reel", 99) ?? 0) + 1}`);
  if (stacked) tags.push(`STACK ×${coinNumber(eventNumber(stacked, "size", 100) ?? 0)}`);
  if (upgrade) tags.push(`${coinNumber(eventNumber(upgrade, "count", 100) ?? 0)} UPGRADED`);
  if (freeSpins.extraWilds > 0) tags.push(`+${coinNumber(boundedNumber(freeSpins.extraWilds, 100) ?? 0)} EXTRA WILDS`);
  if (freeSpins.specialReels) tags.push("SPECIAL REELS");
  if (bonus.mode === "hold-and-win") tags.push(`${coinNumber(boundedNumber(bonus.respinSteps, 100) ?? 0)} RESPIN-STUFEN`);
  if (bonus.mode === "coin-collect") tags.push(`${coinNumber(Math.min(100, bonus.spots.length))} COINS`);
  if (maxWin) tags.push(`${coinNumber(eventNumber(maxWin, "multiplier", 1_000_000) ?? 0)}× MAX`);

  return {
    kicker: tone === "max" ? "LIMIT ERREICHT" : tone === "bonus" ? "BONUS LIVE" : "LIVE FEATURE",
    headline,
    metrics: [...metrics.slice(0, 3), payoutMetric],
    tags: [...new Set(tags)].slice(0, 3),
    tone,
  };
}
