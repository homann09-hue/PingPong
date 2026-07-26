"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { SpinEvent, SpinRoundPhase } from "@/lib/contracts";
import type { SlotCabinetMode } from "@/lib/catalog";
import { resolveSlotBonusPresentation, type SlotBonusPresentation } from "@/lib/slot-bonus-presentation";
import {
  resolveFreeSpinReveal,
  resolveMultiplierReveal,
  resolveMysteryReveal,
  type FreeSpinRevealPresentation,
} from "@/lib/slot-feature-reveal-presentation";
import {
  buildSlotMechanicSequence,
  nextSlotMechanicStep,
  slotMechanicEventSignature,
  type SlotMechanicSequenceEffect,
} from "@/lib/slot-mechanic-sequence";
import { resolveSymbolUpgradePresentation } from "@/lib/slot-symbol-upgrade-presentation";

export interface SlotMechanicFxProps {
  readonly phase: SpinRoundPhase;
  readonly index: number;
  readonly totalWin: number;
  readonly events: readonly SpinEvent[];
  readonly cabinet: SlotCabinetMode;
  readonly turbo?: boolean;
}

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

function FreeSpinFx({ presentation }: Readonly<{ presentation: FreeSpinRevealPresentation }>) {
  if (!presentation.mode) return null;

  if (presentation.mode === "active") return <div className="slot-fx-free-spin-active" data-special-reels={presentation.specialReels ? "true" : "false"}>
    <small>FREISPIEL</small>
    <strong>{presentation.spin}</strong>
    <span>
      {presentation.multiplier > 1 && <em>×{presentation.multiplier}</em>}
      {presentation.extraWilds > 0 && <em>+{presentation.extraWilds} WILDS</em>}
      {presentation.specialReels && <em>SPEZIALWALZEN</em>}
    </span>
  </div>;

  return <div className="slot-fx-free-spin" data-mode={presentation.mode} data-award="true">
    <span className="slot-fx-ring ring-one" /><span className="slot-fx-ring ring-two" /><span className="slot-fx-ring ring-three" />
    <strong>{presentation.primary}</strong>
    <div className="slot-fx-free-spin-copy">
      <b>{presentation.label}</b>
      <span>
        {presentation.multiplier > 1 && <em>×{presentation.multiplier}</em>}
        {presentation.extraWilds > 0 && <em>+{presentation.extraWilds} WILDS</em>}
        {presentation.specialReels && <em>SPEZIALWALZEN</em>}
      </span>
    </div>
    {Array.from({ length: presentation.mode === "retrigger" ? 24 : 18 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}
  </div>;
}

export function SlotMechanicFx({ phase, index, totalWin, events, cabinet, turbo = false }: Readonly<SlotMechanicFxProps>) {
  const walking = walkingPath(events);
  const bonus = resolveSlotBonusPresentation(events);
  const mystery = resolveMysteryReveal(events);
  const freeSpins = resolveFreeSpinReveal(phase, index, events);
  const multiplier = resolveMultiplierReveal(events);
  const upgrade = resolveSymbolUpgradePresentation(events);
  const sequence = useMemo(
    () => buildSlotMechanicSequence(phase, totalWin, events, freeSpins.mode, turbo),
    [events, freeSpins.mode, phase, totalWin, turbo],
  );
  const signature = useMemo(
    () => `${slotMechanicEventSignature(phase, index, totalWin, events)}:${turbo ? "turbo" : "normal"}`,
    [events, index, phase, totalWin, turbo],
  );
  const [activeStep, setActiveStep] = useState(0);
  const normalizedStep = Math.min(activeStep, sequence.length);
  const activeSequenceStep = sequence[normalizedStep];
  const activeEffect = activeSequenceStep?.effect;
  const persistentFreeSpin = freeSpins.mode === "active";

  useEffect(() => setActiveStep(0), [signature]);

  useEffect(() => {
    if (!activeSequenceStep) return undefined;
    const timer = window.setTimeout(
      () => setActiveStep((current) => nextSlotMechanicStep(current, sequence.length)),
      activeSequenceStep.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [activeSequenceStep, sequence.length]);

  if (!activeEffect && !persistentFreeSpin) return null;

  const renderEffect = (effect: SlotMechanicSequenceEffect) => <>
    {effect === "cascade" && <div className="slot-fx-cascade">
      <div className="slot-fx-impact" />
      {Array.from({ length: 16 }, (_, particle) => <i key={particle} style={indexedStyle(particle)} />)}
    </div>}

    {effect === "walking-wild" && <div className="slot-fx-walking-wild" data-direction={walking.direction} data-distance={walking.distance}>
      <span className="slot-fx-track" />
      {Array.from({ length: walking.count }, (_, step) => <i key={step} style={indexedStyle(step)}>WILD</i>)}
      <em>{walking.direction === "right" ? "→" : "←"} {walking.distance}</em>
    </div>}

    {effect === "free-spin" && <FreeSpinFx presentation={freeSpins} />}
    {effect === "respin" && <div className="slot-fx-respin"><span /><strong>↻</strong><em>RESPIN</em></div>}
    {effect === "bonus" && <BonusFx bonus={bonus} />}
    {effect === "mystery" && <div className="slot-fx-mystery" data-count={mystery.count}>
      <div className="slot-fx-mystery-cards">
        {Array.from({ length: mystery.visibleCards }, (_, card) => <i key={card} data-position={mystery.positions[card] ?? undefined} style={indexedStyle(card)}><span>?</span><em>{mystery.target}</em></i>)}
      </div>
      <div className="slot-fx-mystery-copy"><strong>{mystery.count} MYSTERY</strong><span>{mystery.source} → {mystery.target}</span></div>
    </div>}
    {effect === "upgrade" && <div className="slot-fx-symbol-upgrade" data-exact={upgrade.exactPositionCount > 0 ? "true" : "false"}>
      <header>
        <small>{upgrade.triggerCount > 0 ? `${upgrade.triggerCount} TRIGGER` : "FEATURE"}</small>
        <strong>SYMBOL UPGRADE</strong>
        <em>{upgrade.totalCount} SYMBOLE</em>
      </header>
      <div className="slot-fx-symbol-upgrade-steps">
        {upgrade.steps.map((step, stepIndex) => <i key={`${step.from}-${step.to}-${stepIndex}`} style={indexedStyle(stepIndex)}>
          <span>{step.from}</span><b>→</b><em>{step.to}</em><small>×{step.count}</small>
        </i>)}
      </div>
      {Array.from({ length: 18 }, (_, particle) => <u key={particle} style={indexedStyle(particle)} />)}
    </div>}
    {effect === "multiplier" && <div className="slot-fx-multiplier"><span>×{multiplier.multiplier}</span><small>{multiplier.label}</small></div>}
    {effect === "jackpot" && <div className="slot-fx-jackpot"><span className="slot-fx-jackpot-core">MAX</span>{Array.from({ length: 20 }, (_, ray) => <i key={ray} style={indexedStyle(ray)} />)}</div>}
    {effect === "hit" && <div className="slot-fx-hit">{Array.from({ length: 14 }, (_, spark) => <i key={spark} style={indexedStyle(spark)} />)}</div>}
  </>;

  return <div
    key={`${signature}-${activeEffect ?? "session"}`}
    className="slot-mechanic-fx"
    data-effect={activeEffect ?? "session"}
    data-cabinet={cabinet}
    data-playback-speed={turbo ? "turbo" : "normal"}
    data-multiplier={hasEvent(events, "multiplier.applied") ? "true" : "false"}
    data-free-spin-mode={persistentFreeSpin ? "active" : activeEffect === "free-spin" ? freeSpins.mode ?? "none" : undefined}
    data-sequence-active={activeEffect ? "true" : "false"}
    data-sequence-step={sequence.length > 0 ? `${Math.min(normalizedStep + 1, sequence.length)}/${sequence.length}` : undefined}
    aria-hidden="true"
  >
    {activeEffect && <div className="slot-fx-vignette" />}
    {persistentFreeSpin && <FreeSpinFx presentation={freeSpins} />}
    {activeEffect && <div key={`${activeEffect}-${normalizedStep}`} className="slot-mechanic-sequence-layer" data-effect={activeEffect}>
      {renderEffect(activeEffect)}
    </div>}
    {activeEffect && sequence.length > 1 && <div className="slot-mechanic-sequence-pager">
      {sequence.map((step, stepIndex) => <i key={`${step.effect}-${stepIndex}`} data-state={stepIndex < normalizedStep ? "done" : stepIndex === normalizedStep ? "active" : "pending"} />)}
    </div>}
  </div>;
}
