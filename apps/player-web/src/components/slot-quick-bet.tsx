"use client";

import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Gauge } from "@phosphor-icons/react/dist/csr/Gauge";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Paytable } from "@/lib/paytable";
import { coinNumber } from "@/lib/format";

const presetPercentages = [0, 0.25, 0.5, 0.75, 1] as const;

function closestIndex(length: number, percentage: number) {
  if (length <= 1) return 0;
  return Math.round((length - 1) * percentage);
}

function readCurrentBet() {
  const value = document.querySelector<HTMLElement>(".bet-control strong")?.textContent ?? "";
  const normalized = value.replace(/[^0-9]/g, "");
  return normalized ? Number(normalized) : null;
}

export function SlotQuickBet() {
  const pathname = usePathname();
  const gameId = useMemo(() => {
    const match = pathname.match(/^\/slots\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const [bets, setBets] = useState<readonly number[]>([]);
  const [currentBet, setCurrentBet] = useState<number | null>(null);

  useEffect(() => {
    if (!gameId) {
      setBets([]);
      setCurrentBet(null);
      return undefined;
    }

    let cancelled = false;
    void fetch(`/api/player/slots/${gameId}/paytable`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Paytable : null)
      .then((body) => {
        if (!cancelled) setBets(body?.betSteps?.length ? body.betSteps : []);
      })
      .catch(() => { if (!cancelled) setBets([]); });

    const sync = () => setCurrentBet(readCurrentBet());
    sync();
    const control = document.querySelector(".bet-control");
    const observer = control ? new MutationObserver(sync) : null;
    observer?.observe(control!, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(sync, 750);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [gameId]);

  if (!gameId || bets.length === 0) return null;

  function selectBet(targetIndex: number) {
    const current = readCurrentBet();
    if (current === null) return;
    const currentIndex = bets.findIndex((value) => value === current);
    if (currentIndex < 0 || targetIndex === currentIndex) return;

    const buttons = document.querySelectorAll<HTMLButtonElement>(".bet-control button");
    const directionButton = targetIndex > currentIndex ? buttons[1] : buttons[0];
    if (!directionButton || directionButton.disabled) return;

    const steps = Math.abs(targetIndex - currentIndex);
    for (let step = 0; step < steps; step += 1) {
      window.setTimeout(() => directionButton.click(), step * 55);
    }
  }

  return <aside className="slot-quick-bet" aria-label="Schnelle Einsatzwahl">
    <header>
      <span><Coins weight="fill" aria-hidden="true" /></span>
      <div><small>Quick Bet</small><strong>Einsatz-Presets</strong></div>
      <em>{currentBet !== null ? coinNumber(currentBet) : "—"}</em>
    </header>
    <div className="slot-quick-bet-options">
      {presetPercentages.map((percentage) => {
        const index = closestIndex(bets.length, percentage);
        const value = bets[index]!;
        const active = value === currentBet;
        const label = percentage === 0 ? "Min" : percentage === 1 ? "Max" : `${percentage * 100}%`;
        return <button type="button" key={percentage} className={active ? "is-active" : ""} onClick={() => selectBet(index)} aria-pressed={active}>
          {percentage === 1 && <Gauge weight="fill" aria-hidden="true" />}
          <span>{label}</span>
          <small>{coinNumber(value)}</small>
        </button>;
      })}
    </div>
  </aside>;
}
