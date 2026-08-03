"use client";

import { ChartLineUp } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { Gauge } from "@phosphor-icons/react/dist/csr/Gauge";
import { Path } from "@phosphor-icons/react/dist/csr/Path";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Paytable } from "@/lib/paytable";
import { coinNumber } from "@/lib/format";

function volatilityLabel(value: Paytable["volatility"]) {
  if (!value) return "—";
  return String(value).replaceAll("_", " ");
}

export function SlotPerformanceHud() {
  const pathname = usePathname();
  const gameId = useMemo(() => {
    const match = pathname.match(/^\/slots\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const [paytable, setPaytable] = useState<Paytable | null>(null);

  useEffect(() => {
    if (!gameId) {
      setPaytable(null);
      return undefined;
    }

    let cancelled = false;
    void fetch(`/api/player/slots/${gameId}/paytable`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Paytable : null)
      .then((body) => { if (!cancelled) setPaytable(body); })
      .catch(() => { if (!cancelled) setPaytable(null); });

    return () => { cancelled = true; };
  }, [gameId]);

  if (!gameId) return null;

  const metrics = [
    { label: "RTP", value: paytable ? `${(paytable.targetRtp * 100).toFixed(2)} %` : "—", icon: ChartLineUp },
    { label: "Volatilität", value: volatilityLabel(paytable?.volatility), icon: Gauge },
    { label: "Gewinnlinien", value: paytable?.paylines ? coinNumber(paytable.paylines) : "—", icon: Path },
    { label: "Max Win", value: paytable?.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}×` : "—", icon: Trophy },
  ] as const;

  return <aside className={`slot-performance-hud ${paytable ? "is-ready" : "is-loading"}`} aria-label="Slot Kennzahlen" aria-live="polite">
    <span className="slot-performance-kicker">Game Intelligence</span>
    <div className="slot-performance-grid">
      {metrics.map(({ label, value, icon: Icon }) => <div className="slot-performance-metric" key={label}>
        <Icon weight="fill" aria-hidden="true" />
        <span><small>{label}</small><strong>{value}</strong></span>
      </div>)}
    </div>
    <button type="button" className="slot-performance-info" onClick={() => document.querySelector<HTMLButtonElement>('.slot-actions .icon-button')?.click()}>Regeln & Auszahlungen</button>
  </aside>;
}
