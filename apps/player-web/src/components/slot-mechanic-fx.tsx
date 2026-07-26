import type { CSSProperties } from "react";
import type { SpinEvent, SpinRoundPhase } from "@/lib/contracts";
import type { SlotCabinetMode } from "@/lib/catalog";
import { resolveSlotBonusPresentation, type SlotBonusPresentation } from "@/lib/slot-bonus-presentation";
import {
  resolveFreeSpinReveal,
  resolveMultiplierReveal,
  resolveMysteryReveal,
} from "@/lib/slot-feature-reveal-presentation";

export interface SlotMechanicFxProps {
  readonly phase: SpinRoundPhase;
  readonly index: number;
  readonly totalWin: number;
  readonly events: readonly SpinEvent[];
  readonly cabinet: SlotCabinetMode;
}

type MechanicEffect = "cascade" | "walking-wild" | "free-spin" | "respin" | "bonus" | "mystery" | "multiplier" | "jackpot" | "hit";

interface WalkingPath {
  readonly direction: "left" | "right";
  readonly count: number;
  readonly distance: number;
}

function hasEvent(events: readonly SpinEvent[], type: string): boolean {
  return events.some((event) => event.type === type);
}

function eventNumber(events: readonly SpinEvent[], type: string, key: string): number | undefined {
  const value = events.find((event) => event.type === type)?.data[key];
  return typeof value === "number" ? value : undefined;
}

function eventText(events: readonly SpinEvent[], type: string, key: string): string | undefined {
  const value = events.find((event) => event.type === type)?.data[key];
  return typeof value === "string" ? value : undefined;
}

function walkingPath(events: readonly SpinEvent[]): WalkingPath {
  const rawMoves = eventText(events, "wild.walked", "moves") ?? "";
  const moves = rawMoves.split(",").map((entry) => entry.trim()).filter(Boolean);
  const first = moves[0]?.split(">");
  const sourceReel = Number(first?.[0]?.split(":")[0]);
  const targetReel = Number(first?.[1]?.split(":")[0]);
  const valid = Number.isInteger(sourceReel) && Number.isInteger(targetReel);
  const count = Math.max(1, Math.min(5, moves.length || eventNumber(events, "wild.walked", "count") || 1));
  const distance = valid ? Math.max(1, Math.min(4, Math.abs(targetReel - sourceReel))) : 1;
  const direction = valid && targetReel < sourceReel ? "left" : "right";
  return { direction, count, distance };
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
const bonusSpotStyle = (order: number, index: number) => ({ "--bonus-order": order, "--fx-index": index } as CSSProperties);

function bonusLabel(bonus: SlotBonusPresentation): string {
  if (bonus.mode === "hold-and-win") return "HOLD & WIN";
  if (bonus.mode === "coin-collect") return bonus.collectorCount ? `${bonus.collectorCount} COLLECTOR` : "COIN COLLECT";
  if (bonus.mode === "pick") return "PICK BONUS";
  if (bonus.mode === "wheel") return "BONUS WHEEL";
  if (bonus.mode === "jackpot") return `${bonus.tier ?? "JACKPOT"}`;
  return "BONUS";
}

function BonusFx({ bonus }: Readonly<{ bonus: SlotBonusPresentation }>) {
  if (bonus.mode === "pick") return <div className="slot-fx-bonus-picks">
    <strong>PICK BONUS</strong>
    <div>{bonus.picks.map((pick, pickIndex) => <i key={`${pick}-${pickIndex}`} style={bonusSpotStyle(pickIndex, pickIndex)}><span>×{pick}</span></i>)}</div>
    <em>TOTAL ×{bonus.multiplier}</em>
  </div>;

  if (bonus.mode === "wheel") return <div className="slot-fx-bonus-wheel" style={{ "--wheel-segment": bonus.segment ?? 0 } as CSSProperties}>
    <i /><span>×{bonus.multiplier}</span><strong>SEGMENT {(bonus.segment ?? 0) + 1}</strong>
  </div>;

  if (bonus.mode === "jackpot") return <div className="slot-fx-bonus-jackpot">
    <small>JACKPOT</small><strong>{bonus.tier ?? "WIN"}</strong><em>×{bonus.multiplier}</em>
  </div>;

  const spotByPosition = new Map(bonus.spots.map((spot) => [spot.position, spot]));
  return <div className="slot-fx-bonus-stage" data-mode={bonus.mode}>
    <header><strong>{bonusLabel(bonus)}</strong><span>×{bonus.multiplier}</span></header>
    <div className="slot-fx-bonus-board" style={{ "--bonus-columns": bonus.columns } as CSSProperties}>
      {Array.from({ length: bonus.boardSize }, (_, position) => {
        const spot = spotByPosition.get(position);
        return <i
          key={position}
          className={spot ? `is-held ${spot.initial ? "is-initial" : "is-revealed"}` : "is-empty"}
          style={bonusSpotStyle(spot?.revealOrder ?? 0, position)}
        >{spot && <span>×{spot.multiplier}</span>}</i>;
      })}
    </div>
    <footer>{bonus.mode === "hold-and-win" ? `${bonus.respinSteps} RESPIN-STUFEN` : `${bonus.spots.length} COINS`}</footer>
  </div>;
}

export function SlotMechanicFx({ phase, index, totalWin, events, cabinet }: Readonly<SlotMechanicFxProps>) {
  const effect = effectFor(phase, totalWin, events);
  if (!effect) return null;

  const walking = walkingPath(events);
  const bonus = resolveSlotBonusPresentation(events);
  const mystery = resolveMysteryReveal(events);
  const freeSpins = resolveFreeSpinReveal(phase, index, events);
  const multiplier = resolveMultiplierReveal(events);

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

    {effect === "walking-wild" && <div className="slot-fx-walking-wild" data-direction={walking.direction} data-distance={walking.distance}>
      <span className="slot-fx-track" />
      {Array.from({ length: walking.count }, (_, step) => <i key={step} style={indexedStyle(step)}>WILD</i>)}
      <em>{walking.direction === "right" ? "→" : "←"} {walking.distance}</em>
    </div>}

    {effect === "free-spin" && <div className="slot-fx-free-spin" data-award={freeSpins.awarded > 0 ? "true" : "false"}>
      <span className="slot-fx-ring ring-one" /><span className="slot-fx-ring ring-two" /><span className="slot-fx-ring ring-three" />
      <strong>{freeSpins.primary}</strong>
      <div className="slot-fx-free-spin-copy">
        <b>{freeSpins.label}</b>
        <span>
          {freeSpins.multiplier > 1 && <em>×{freeSpins.multiplier}</em>}
          {freeSpins.extraWilds > 0 && <em>+{freeSpins.extraWilds} WILDS</em>}
          {freeSpins.specialReels && <em>SPEZIALWALZEN</em>}
        </span>
      </div>
      {Array.from({ length: 18 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}
    </div>}

    {effect === "respin" && <div className="slot-fx-respin"><span /><strong>↻</strong><em>RESPIN</em></div>}
    {effect === "bonus" && <BonusFx bonus={bonus} />}
    {effect === "mystery" && <div className="slot-fx-mystery" data-count={mystery.count}>
      <div className="slot-fx-mystery-cards">
        {Array.from({ length: mystery.visibleCards }, (_, card) => <i key={card} data-position={mystery.positions[card] ?? undefined} style={indexedStyle(card)}><span>?</span><em>{mystery.target}</em></i>)}
      </div>
      <div className="slot-fx-mystery-copy"><strong>{mystery.count} MYSTERY</strong><span>{mystery.source} → {mystery.target}</span></div>
    </div>}
    {effect === "multiplier" && <div className="slot-fx-multiplier"><span>×{multiplier.multiplier}</span><small>{multiplier.label}</small></div>}
    {effect === "jackpot" && <div className="slot-fx-jackpot"><span className="slot-fx-jackpot-core">MAX</span>{Array.from({ length: 20 }, (_, ray) => <i key={ray} style={indexedStyle(ray)} />)}</div>}
    {effect === "hit" && <div className="slot-fx-hit">{Array.from({ length: 14 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}</div>}
  </div>;
}
