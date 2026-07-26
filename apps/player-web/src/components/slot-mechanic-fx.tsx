import type { CSSProperties } from "react";
import type { SpinEvent, SpinRoundPhase } from "@/lib/contracts";
import type { SlotCabinetMode } from "@/lib/catalog";

export interface SlotMechanicFxProps {
  readonly phase: SpinRoundPhase;
  readonly index: number;
  readonly totalWin: number;
  readonly events: readonly SpinEvent[];
  readonly cabinet: SlotCabinetMode;
}

type MechanicEffect = "cascade" | "walking-wild" | "free-spin" | "respin" | "bonus" | "mystery" | "multiplier" | "jackpot" | "hit";

function hasEvent(events: readonly SpinEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function eventNumber(events: readonly SpinEvent[], type: string, key: string): number | undefined {
  const value = events.find((event) => event.type === type)?.data[key];
  return typeof value === "number" ? value : undefined;
}

function effectFor(phase: SpinRoundPhase, totalWin: number, events: readonly SpinEvent[]): MechanicEffect | null {
  if (hasEvent(events, "max_win.reached")) return "jackpot";
  if (phase === "bonus" || hasEvent(events, "bonus.awarded")) return "bonus";
  if (hasEvent(events, "wild.walked")) return "walking-wild";
  if (hasEvent(events, "mystery.revealed")) return "mystery";
  if (phase === "free_spin" || hasEvent(events, "free_spins.awarded") || hasEvent(events, "free_spins.modified")) return "free-spin";
  if (phase === "cascade" || hasEvent(events, "cascade.started")) return "cascade";
  if (phase === "respin" || hasEvent(events, "respin.started")) return "respin";
  if (hasEvent(events, "multiplier.applied")) return "multiplier";
  return totalWin > 0 ? "hit" : null;
}

const indexedStyle = (index: number) => ({ "--fx-index": index } as CSSProperties);

export function SlotMechanicFx({ phase, index, totalWin, events, cabinet }: Readonly<SlotMechanicFxProps>) {
  const effect = effectFor(phase, totalWin, events);
  if (!effect) return null;

  const multiplier = eventNumber(events, "multiplier.applied", "multiplier")
    ?? eventNumber(events, "max_win.reached", "multiplier")
    ?? 2;

  return <div
    key={`${effect}-${phase}-${index}`}
    className="slot-mechanic-fx"
    data-effect={effect}
    data-cabinet={cabinet}
    data-multiplier={hasEvent(events, "multiplier.applied") ? "true" : "false"}
    aria-hidden="true"
  >
    <div className="slot-fx-vignette" />

    {effect === "cascade" && <div className="slot-fx-cascade">
      <div className="slot-fx-impact" />
      {Array.from({ length: 16 }, (_, particle) => <i key={particle} style={indexedStyle(particle)} />)}
    </div>}

    {effect === "walking-wild" && <div className="slot-fx-walking-wild">
      <span className="slot-fx-track" />
      {Array.from({ length: 5 }, (_, step) => <i key={step} style={indexedStyle(step)}>WILD</i>)}
    </div>}

    {effect === "free-spin" && <div className="slot-fx-free-spin">
      <span className="slot-fx-ring ring-one" />
      <span className="slot-fx-ring ring-two" />
      <span className="slot-fx-ring ring-three" />
      <strong>{phase === "free_spin" ? index : "+"}</strong>
      {Array.from({ length: 18 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}
    </div>}

    {effect === "respin" && <div className="slot-fx-respin">
      <span />
      <strong>↻</strong>
      <em>RESPIN</em>
    </div>}

    {effect === "bonus" && <div className="slot-fx-bonus-grid">
      {Array.from({ length: 15 }, (_, cell) => <i key={cell} style={indexedStyle(cell)}><span>●</span></i>)}
    </div>}

    {effect === "mystery" && <div className="slot-fx-mystery">
      {Array.from({ length: 7 }, (_, card) => <i key={card} style={indexedStyle(card)}>?</i>)}
    </div>}

    {effect === "multiplier" && <div className="slot-fx-multiplier"><span>×{multiplier}</span></div>}

    {effect === "jackpot" && <div className="slot-fx-jackpot">
      <span className="slot-fx-jackpot-core">MAX</span>
      {Array.from({ length: 20 }, (_, ray) => <i key={ray} style={indexedStyle(ray)} />)}
    </div>}

    {effect === "hit" && <div className="slot-fx-hit">
      {Array.from({ length: 14 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}
    </div>}
  </div>;
}
