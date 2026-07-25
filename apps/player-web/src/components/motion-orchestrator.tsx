"use client";

import { useEffect, useState } from "react";

type Burst = { id: number; x: number; y: number; kind: "gold" | "pink" | "cyan" };

function burstKind(target: HTMLElement): Burst["kind"] {
  if (target.closest(".claim-button,.milestone-claim,.lsd__quest button")) return "gold";
  if (target.closest(".wallet-pill,.gem-wallet,.search-trigger")) return "cyan";
  return "pink";
}

export function MotionOrchestrator() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    let nextId = 1;
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest("button,a,.claim-button,.milestone-claim,.wallet-pill,.game-card,.lsd__tile")) return;
      const burst = { id: nextId++, x: event.clientX, y: event.clientY, kind: burstKind(target) };
      setBursts((current) => [...current.slice(-5), burst]);
      window.setTimeout(() => setBursts((current) => current.filter((item) => item.id !== burst.id)), 760);
    };
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  return <div className="aurora-motion-layer" aria-hidden="true">
    {bursts.map((burst) => <span key={burst.id} className={`aurora-tap-burst aurora-tap-burst--${burst.kind}`} style={{ left: burst.x, top: burst.y }}>
      {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--burst-index": index } as React.CSSProperties} />)}
    </span>)}
  </div>;
}
