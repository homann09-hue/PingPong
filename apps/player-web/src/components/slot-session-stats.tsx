"use client";

import { ChartBar } from "@phosphor-icons/react/dist/csr/ChartBar";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Crosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { TrendUp } from "@phosphor-icons/react/dist/csr/TrendUp";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { coinNumber } from "@/lib/format";

type SessionStats = Readonly<{
  spins: number;
  hits: number;
  totalBet: number;
  totalWin: number;
}>;

const emptyStats: SessionStats = { spins: 0, hits: 0, totalBet: 0, totalWin: 0 };

function storageKey(gameId: string) {
  return `aurora:slot-session:${gameId}`;
}

function parseCoins(value: string | null | undefined) {
  const normalized = value?.replace(/[^0-9-]/g, "") ?? "";
  return normalized ? Number(normalized) : 0;
}

function readStats(gameId: string): SessionStats {
  try {
    const raw = window.sessionStorage.getItem(storageKey(gameId));
    if (!raw) return emptyStats;
    const value = JSON.parse(raw) as Partial<SessionStats>;
    return {
      spins: Number.isFinite(value.spins) ? Math.max(0, Number(value.spins)) : 0,
      hits: Number.isFinite(value.hits) ? Math.max(0, Number(value.hits)) : 0,
      totalBet: Number.isFinite(value.totalBet) ? Math.max(0, Number(value.totalBet)) : 0,
      totalWin: Number.isFinite(value.totalWin) ? Math.max(0, Number(value.totalWin)) : 0,
    };
  } catch {
    return emptyStats;
  }
}

export function SlotSessionStats() {
  const pathname = usePathname();
  const gameId = useMemo(() => {
    const match = pathname.match(/^\/slots\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const wasSpinning = useRef(false);
  const pendingBet = useRef(0);

  useEffect(() => {
    if (!gameId) {
      setStats(emptyStats);
      return undefined;
    }

    setStats(readStats(gameId));
    const stage = document.querySelector<HTMLElement>(".slot-stage");
    const frame = document.querySelector<HTMLElement>(".reel-frame");
    if (!stage || !frame) return undefined;

    const sync = () => {
      const spinning = frame.classList.contains("is-spinning");
      if (spinning && !wasSpinning.current) {
        pendingBet.current = parseCoins(document.querySelector<HTMLElement>(".bet-control strong")?.textContent);
      }

      if (!spinning && wasSpinning.current) {
        window.setTimeout(() => {
          const winPanel = document.querySelector<HTMLElement>(".win-panel");
          const win = winPanel?.classList.contains("has-win")
            ? parseCoins(winPanel.querySelector<HTMLElement>("strong")?.textContent)
            : 0;

          setStats((current) => {
            const next: SessionStats = {
              spins: current.spins + 1,
              hits: current.hits + (win > 0 ? 1 : 0),
              totalBet: current.totalBet + pendingBet.current,
              totalWin: current.totalWin + win,
            };
            try { window.sessionStorage.setItem(storageKey(gameId), JSON.stringify(next)); } catch { /* Session storage is optional. */ }
            return next;
          });
        }, 40);
      }

      wasSpinning.current = spinning;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [gameId]);

  if (!gameId) return null;

  const hitRate = stats.spins > 0 ? (stats.hits / stats.spins) * 100 : 0;
  const net = stats.totalWin - stats.totalBet;
  const metrics = [
    { label: "Spins", value: coinNumber(stats.spins), icon: ChartBar },
    { label: "Treffer", value: coinNumber(stats.hits), icon: Crosshair },
    { label: "Trefferquote", value: `${hitRate.toFixed(1)} %`, icon: TrendUp },
    { label: "Session", value: `${net >= 0 ? "+" : "−"}${coinNumber(Math.abs(net))}`, icon: Coins, positive: net >= 0 },
  ] as const;

  return <aside className="slot-session-stats" aria-label="Statistik dieser Spielsitzung" aria-live="polite">
    <header><span>Session Analytics</span><strong>Deine Runde</strong></header>
    <div>
      {metrics.map(({ label, value, icon: Icon, ...metric }) => <section key={label} className={"positive" in metric ? (metric.positive ? "is-positive" : "is-negative") : ""}>
        <Icon weight="fill" aria-hidden="true" />
        <span><small>{label}</small><strong>{value}</strong></span>
      </section>)}
    </div>
  </aside>;
}
