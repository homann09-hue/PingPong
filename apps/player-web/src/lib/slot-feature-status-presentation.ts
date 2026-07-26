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

function eventNumber(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function maxEventNumber(events: readonly SpinEvent[], type: string, key: string): number | undefined {
  const values = eventsOf(events, type)
    .map((event) => eventNumber(event, key))
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
  if (phase === "free_spin") return { label: "Freispiel", value: String(Math.max(1, index)) };
  if (phase === "cascade") return { label: "Kaskade", value: String(Math.max(1, index)) };
  if (phase === "respin") return { label: "Respin", value: String(Math.max(1, index)) };
  return undefined;
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

  const { phase, index, totalWin, events } = input;
  const maxWin = eventOf(events, "max_win.reached");
  const bonus = resolveSlotBonusPresentation(events);
  const mystery = resolveMysteryReveal(events);
  const freeSpins = resolveFreeSpinReveal(phase ?? "base", index, events);
  const multiplier = resolveMultiplierReveal(events);
  const walking = eventOf(events, "wild.walked");
  const sticky = eventOf(events, "wild.stuck");
  const expanded = eventOf(events, "wild.expanded");
  const stacked = eventOf(events, "wild.stacked");
  const upgrade = eventOf(events, "symbol.upgraded");
  const ways = maxEventNumber(events, "ways.win", "ways");
  const cluster = maxEventNumber(events, "cluster.win", "count");
  const scatter = maxEventNumber(events, "scatter.hit", "count");
  const layout = eventOf(events, "layout.changed");

  let headline = "HAUPTSPIEL";
  let tone: SlotFeatureStatusPresentation["tone"] = totalWin > 0 ? "win" : "feature";
  if (maxWin) { headline = "MAX WIN"; tone = "max"; }
  else if (phase === "bonus" || eventOf(events, "bonus.awarded")) { headline = bonusHeadline(bonus.mode); tone = "bonus"; }
  else if (walking) headline = "WALKING WILD";
  else if (eventOf(events, "mystery.revealed")) headline = "MYSTERY REVEAL";
  else if (phase === "free_spin") headline = `FREISPIEL ${Math.max(1, index)}`;
  else if (phase === "cascade") headline = `KASKADE ${Math.max(1, index)}`;
  else if (phase === "respin") headline = `RESPIN ${Math.max(1, index)}`;
  else if (cluster) headline = "CLUSTER WIN";
  else if (ways) headline = "WAYS WIN";
  else if (scatter) headline = "SCATTER HIT";
  else if (multiplier.multiplier > 1) headline = "MULTIPLIKATOR";

  const metrics: SlotFeatureMetric[] = [];
  const round = phaseMetric(phase, index);
  if (round) metrics.push(round);
  if (ways) metrics.push({ label: "Ways", value: coinNumber(ways) });
  else if (cluster) metrics.push({ label: "Cluster", value: `${cluster} Symbole` });
  else if (scatter) metrics.push({ label: "Scatter", value: `${scatter} Treffer` });
  else if (layout) metrics.push({ label: "Layout", value: `${coinNumber(eventNumber(layout, "ways") ?? 0)} Ways` });

  if (multiplier.multiplier > 1) metrics.push({ label: "Multiplikator", value: `${multiplier.multiplier}×` });
  else if (walking) metrics.push({ label: "Wild-Pfad", value: `${walkingDirection(walking)} · ${eventNumber(walking, "count") ?? 1}` });
  else if (eventOf(events, "mystery.revealed")) metrics.push({ label: "Reveal", value: `${mystery.count} → ${mystery.target}` });
  else if (bonus.multiplier > 0) metrics.push({ label: "Bonus", value: `${bonus.multiplier}×` });

  if (freeSpins.awarded > 0) metrics.push({ label: "Gewonnen", value: `+${freeSpins.awarded} Spins` });
  metrics.push({ label: "Rundengewinn", value: totalWin > 0 ? coinNumber(totalWin) : "—" });

  const tags: string[] = [];
  if (sticky) tags.push(`${eventNumber(sticky, "count") ?? 0} WILDS LOCKED`);
  if (expanded) tags.push(`EXPAND R${(eventNumber(expanded, "reel") ?? 0) + 1}`);
  if (stacked) tags.push(`STACK ×${eventNumber(stacked, "size") ?? 0}`);
  if (upgrade) tags.push(`${eventNumber(upgrade, "count") ?? 0} UPGRADED`);
  if (freeSpins.extraWilds > 0) tags.push(`+${freeSpins.extraWilds} EXTRA WILDS`);
  if (freeSpins.specialReels) tags.push("SPECIAL REELS");
  if (bonus.mode === "hold-and-win") tags.push(`${bonus.respinSteps} RESPIN-STUFEN`);
  if (bonus.mode === "coin-collect") tags.push(`${bonus.spots.length} COINS`);
  if (maxWin) tags.push(`${eventNumber(maxWin, "multiplier") ?? 0}× MAX`);

  return {
    kicker: tone === "max" ? "LIMIT ERREICHT" : tone === "bonus" ? "BONUS LIVE" : "LIVE FEATURE",
    headline,
    metrics: metrics.slice(0, 4),
    tags: tags.slice(0, 3),
    tone,
  };
}
