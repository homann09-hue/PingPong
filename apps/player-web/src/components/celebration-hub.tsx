"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Gift, Sparkle, Trophy, X } from "@phosphor-icons/react";
import { coinNumber } from "@/lib/format";
import type { CelebrationDetail } from "@/lib/celebration-events";
import { usePlayer } from "@/hooks/use-player";

const ICONS = { reward: Gift, "level-up": Crown, "event-complete": Trophy, jackpot: Sparkle } as const;

export function CelebrationHub() {
  const { profile } = usePlayer();
  const previousLevel = useRef<number | null>(null);
  const [queue, setQueue] = useState<CelebrationDetail[]>([]);
  const active = queue[0] ?? null;

  useEffect(() => {
    const onCelebrate = (event: Event) => {
      const detail = (event as CustomEvent<CelebrationDetail>).detail;
      if (detail) setQueue((current) => [...current, detail].slice(-4));
    };
    window.addEventListener("aurora:celebrate", onCelebrate);
    return () => window.removeEventListener("aurora:celebrate", onCelebrate);
  }, []);

  useEffect(() => {
    const level = profile?.progression.level;
    if (!level) return;
    if (previousLevel.current !== null && level > previousLevel.current) {
      setQueue((current) => [...current, { kind: "level-up", title: `LEVEL ${level}`, subtitle: "Neue Inhalte und Belohnungen freigeschaltet", level }].slice(-4));
    }
    previousLevel.current = level;
  }, [profile?.progression.level]);

  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => setQueue((current) => current.slice(1)), reduced ? 1800 : active.kind === "jackpot" ? 5200 : 3600);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active) return null;
  const Icon = ICONS[active.kind];
  return <div className={`celebration-hub celebration-${active.kind}`} role="dialog" aria-modal="true" aria-label={active.title} onClick={() => setQueue((current) => current.slice(1))}>
    <div className="celebration-vignette" aria-hidden="true" />
    <div className="celebration-rays" aria-hidden="true" />
    <div className="celebration-particles" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
    <section className="celebration-card" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => setQueue((current) => current.slice(1))} aria-label="Animation schließen"><X weight="bold" /></button>
      <span className="celebration-icon"><Icon weight="fill" /></span>
      <small>{active.kind === "reward" ? "BELOHNUNG" : active.kind === "level-up" ? "FORTSCHRITT" : active.kind === "event-complete" ? "EVENT ABGESCHLOSSEN" : "JACKPOT"}</small>
      <h2>{active.title}</h2>
      {active.amount ? <strong>{coinNumber(active.amount)} Coins</strong> : null}
      {active.subtitle ? <p>{active.subtitle}</p> : null}
      <span className="celebration-continue">Tippen zum Fortfahren</span>
    </section>
  </div>;
}
