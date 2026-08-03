"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Paytable } from "@/lib/paytable";

type SlotStatus = Readonly<{
  spinning: boolean;
  turbo: boolean;
  autoRemaining: number;
}>;

const initialStatus: SlotStatus = { spinning: false, turbo: false, autoRemaining: 0 };

function readStatus(): SlotStatus {
  const frame = document.querySelector<HTMLElement>(".reel-frame");
  const turboButton = document.querySelector<HTMLButtonElement>(".turbo-button");
  const autoButton = document.querySelector<HTMLButtonElement>(".auto-button");
  const autoText = autoButton?.querySelector("em")?.textContent?.trim() ?? "";
  const autoRemaining = /^\d+$/.test(autoText) ? Number(autoText) : 0;

  return {
    spinning: frame?.classList.contains("is-spinning") ?? false,
    turbo: turboButton?.classList.contains("selected") ?? false,
    autoRemaining,
  };
}

export function SlotFeatureStatus() {
  const pathname = usePathname();
  const gameId = useMemo(() => {
    const match = pathname.match(/^\/slots\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const [paytable, setPaytable] = useState<Paytable | null>(null);
  const [status, setStatus] = useState<SlotStatus>(initialStatus);

  useEffect(() => {
    if (!gameId) {
      setPaytable(null);
      setStatus(initialStatus);
      return undefined;
    }

    let cancelled = false;
    void fetch(`/api/player/slots/${gameId}/paytable`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Paytable : null)
      .then((body) => { if (!cancelled) setPaytable(body); })
      .catch(() => { if (!cancelled) setPaytable(null); });

    const sync = () => setStatus(readStatus());
    sync();
    const stage = document.querySelector(".slot-stage");
    const observer = stage ? new MutationObserver(sync) : null;
    observer?.observe(stage!, { attributes: true, childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(sync, 600);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [gameId]);

  if (!gameId) return null;

  const symbols = Object.values(paytable?.symbols ?? {});
  const hasWild = symbols.some((definition) => definition.kind === "wild");
  const hasScatter = symbols.some((definition) => definition.kind === "scatter");
  const modeLabel = status.autoRemaining > 0
    ? `Auto ${status.autoRemaining}`
    : status.spinning
      ? "Spin läuft"
      : "Bereit";

  return <aside className={`slot-feature-status ${status.spinning ? "is-spinning" : ""}`} aria-label="Aktiver Spielstatus" aria-live="polite">
    <div className="slot-feature-status-main">
      <span className="slot-feature-status-pulse" aria-hidden="true" />
      <span><small>Status</small><strong>{modeLabel}</strong></span>
    </div>
    <div className="slot-feature-status-items">
      <span className={status.turbo ? "is-active" : ""}><Lightning weight="fill" aria-hidden="true" /><em>Turbo</em></span>
      <span className={status.autoRemaining > 0 ? "is-active" : ""}><ArrowsClockwise weight="bold" aria-hidden="true" /><em>Auto</em></span>
      {hasWild && <span className="has-feature"><Sparkle weight="fill" aria-hidden="true" /><em>Wild</em></span>}
      {hasScatter && <span className="has-feature"><Star weight="fill" aria-hidden="true" /><em>Scatter</em></span>}
    </div>
  </aside>;
}
