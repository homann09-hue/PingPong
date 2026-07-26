import type { SpinEvent, SpinRoundPhase } from "@/lib/contracts";
import type { SlotCabinetMode } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";

export interface SlotFeatureHudProps {
  readonly active: boolean;
  readonly phase?: SpinRoundPhase;
  readonly index?: number;
  readonly totalWin?: number;
  readonly events?: readonly SpinEvent[];
  readonly mechanicLabel: string;
  readonly cabinet: SlotCabinetMode;
}

interface FeatureMetric {
  readonly label: string;
  readonly value: string;
}

function eventOf(events: readonly SpinEvent[], type: string): SpinEvent | undefined {
  return events.find((event) => event.type === type);
}

function eventNumber(event: SpinEvent | undefined, key: string): number | undefined {
  const value = event?.data[key];
  return typeof value === "number" ? value : undefined;
}

function eventText(event: SpinEvent | undefined, key: string): string | undefined {
  const value = event?.data[key];
  return typeof value === "string" ? value : undefined;
}

function headline(phase: SpinRoundPhase | undefined, index: number, events: readonly SpinEvent[]): string {
  if (eventOf(events, "max_win.reached")) return "MAX WIN";
  if (phase === "bonus" || eventOf(events, "bonus.awarded")) return "BONUS BOARD";
  if (phase === "free_spin") return `FREISPIEL ${index}`;
  if (phase === "cascade") return `KASKADE ${index}`;
  if (phase === "respin") return `RESPIN ${index}`;
  if (eventOf(events, "wild.walked")) return "WALKING WILD";
  if (eventOf(events, "mystery.revealed")) return "MYSTERY REVEAL";
  if (eventOf(events, "multiplier.applied")) return "MULTIPLIKATOR";
  return "HAUPTSPIEL";
}

function metrics(phase: SpinRoundPhase | undefined, index: number, totalWin: number, events: readonly SpinEvent[], mechanicLabel: string): readonly FeatureMetric[] {
  const multiplierEvent = eventOf(events, "multiplier.applied") ?? eventOf(events, "max_win.reached");
  const multiplier = eventNumber(multiplierEvent, "multiplier");
  const mystery = eventOf(events, "mystery.revealed");
  const walking = eventOf(events, "wild.walked");
  const bonus = eventOf(events, "bonus.awarded");
  const freeSpins = eventOf(events, "free_spins.awarded");
  const layout = eventOf(events, "layout.changed");

  const values: FeatureMetric[] = [];
  if (phase === "free_spin") values.push({ label: "Runde", value: String(index) });
  if (phase === "cascade") values.push({ label: "Stufe", value: String(index) });
  if (phase === "respin") values.push({ label: "Runde", value: String(index) });
  if (multiplier && multiplier > 1) values.push({ label: "Multi", value: `${multiplier}×` });
  if (walking) values.push({ label: "Wild", value: `${eventText(walking, "direction") ?? "move"} ${eventNumber(walking, "step") ?? index}` });
  if (mystery) values.push({ label: "Reveal", value: `${eventNumber(mystery, "count") ?? 0} → ${eventText(mystery, "target") ?? "Premium"}` });
  if (bonus) values.push({ label: "Bonus", value: (eventText(bonus, "type") ?? mechanicLabel).replaceAll("_", " ") });
  if (freeSpins) values.push({ label: "Gewonnen", value: `${eventNumber(freeSpins, "count") ?? eventNumber(freeSpins, "awarded") ?? 0} Spins` });
  if (layout) values.push({ label: "Ways", value: String(eventNumber(layout, "ways") ?? eventText(layout, "rows") ?? "variabel") });
  values.push({ label: "Rundengewinn", value: totalWin > 0 ? coinNumber(totalWin) : "—" });

  return values.slice(0, 3);
}

export function SlotFeatureHud({ active, phase, index = 0, totalWin = 0, events = [], mechanicLabel, cabinet }: Readonly<SlotFeatureHudProps>) {
  const title = active ? headline(phase, index, events) : "FEATURE READY";
  const values = active
    ? metrics(phase, index, totalWin, events, mechanicLabel)
    : [{ label: "Mechanik", value: mechanicLabel }, { label: "Status", value: "Bereit" }];

  return <aside className={`slot-feature-hud ${active ? "is-active" : ""}`} data-cabinet={cabinet} aria-live="polite" aria-label="Aktueller Slot-Featurestatus">
    <header>
      <span aria-hidden="true"><i /><i /><i /></span>
      <div><small>{active ? "LIVE FEATURE" : "AURORA FEATURE"}</small><strong>{title}</strong></div>
    </header>
    <div className="slot-feature-metrics">
      {values.map((metric) => <span key={`${metric.label}-${metric.value}`}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}
    </div>
    <div className="slot-feature-charge" aria-hidden="true"><i /></div>
  </aside>;
}
