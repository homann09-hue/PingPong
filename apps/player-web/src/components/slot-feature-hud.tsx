import type { SpinEvent, SpinRoundPhase } from "@/lib/contracts";
import type { SlotCabinetMode } from "@/lib/catalog";
import { resolveSlotFeatureStatus } from "@/lib/slot-feature-status-presentation";

export interface SlotFeatureHudProps {
  readonly active: boolean;
  readonly phase?: SpinRoundPhase;
  readonly index?: number;
  readonly totalWin?: number;
  readonly events?: readonly SpinEvent[];
  readonly mechanicLabel: string;
  readonly cabinet: SlotCabinetMode;
}

export function SlotFeatureHud({
  active,
  phase,
  index = 0,
  totalWin = 0,
  events = [],
  mechanicLabel,
  cabinet,
}: Readonly<SlotFeatureHudProps>) {
  const presentation = resolveSlotFeatureStatus({ active, phase, index, totalWin, events, mechanicLabel });

  return <aside
    className={`slot-feature-hud ${active ? "is-active" : ""}`}
    data-cabinet={cabinet}
    data-tone={presentation.tone}
    aria-live="polite"
    aria-label="Aktueller Slot-Featurestatus"
  >
    <header>
      <span aria-hidden="true"><i /><i /><i /></span>
      <div><small>{presentation.kicker}</small><strong>{presentation.headline}</strong></div>
    </header>
    <div className="slot-feature-metrics">
      {presentation.metrics.map((metric, metricIndex) => <span key={`${metric.label}-${metric.value}-${metricIndex}`}>
        <small>{metric.label}</small><strong>{metric.value}</strong>
      </span>)}
    </div>
    {presentation.tags.length > 0 && <div className="slot-feature-tags" aria-label="Aktive Mechaniken">
      {presentation.tags.map((tag) => <span key={tag}>{tag}</span>)}
    </div>}
    <div className="slot-feature-charge" aria-hidden="true"><i /></div>
  </aside>;
}
