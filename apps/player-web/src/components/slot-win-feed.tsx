"use client";

import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type WinFeedEntry = Readonly<{
  id: string;
  amount: string;
  tier: string;
  createdAt: number;
}>;

const MAX_ENTRIES = 12;

function storageKey(gameId: string) {
  return `aurora:slot-win-feed:${gameId}`;
}

function readEntries(gameId: string): WinFeedEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey(gameId));
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is WinFeedEntry => Boolean(
      entry && typeof entry === "object" &&
      "id" in entry && typeof entry.id === "string" &&
      "amount" in entry && typeof entry.amount === "string" &&
      "tier" in entry && typeof entry.tier === "string" &&
      "createdAt" in entry && typeof entry.createdAt === "number",
    )).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "gerade eben";
  if (seconds < 60) return `vor ${seconds} Sek.`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  return `vor ${hours} Std.`;
}

export function SlotWinFeed() {
  const pathname = usePathname();
  const gameId = useMemo(() => {
    const match = pathname.match(/^\/slots\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const [entries, setEntries] = useState<WinFeedEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const lastSignature = useRef("");

  useEffect(() => {
    if (!gameId) {
      setEntries([]);
      return undefined;
    }

    setEntries(readEntries(gameId));

    const panel = document.querySelector<HTMLElement>(".win-panel");
    if (!panel) return undefined;

    const capture = () => {
      if (!panel.classList.contains("has-win")) return;
      const amountNode = panel.querySelector<HTMLElement>("strong");
      const messageNode = panel.querySelector<HTMLElement>("span");
      const amountText = amountNode?.textContent?.replace(/^GEWINN\s*/i, "").trim();
      if (!amountText) return;

      const message = messageNode?.textContent?.trim() ?? "GEWINN";
      const tier = message.split("·")[0]?.trim() || "GEWINN";
      const signature = `${tier}:${amountText}`;
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;

      const nextEntry: WinFeedEntry = {
        id: `${Date.now()}-${signature}`,
        amount: amountText,
        tier,
        createdAt: Date.now(),
      };

      setEntries((current) => {
        const next = [nextEntry, ...current].slice(0, MAX_ENTRIES);
        try { window.localStorage.setItem(storageKey(gameId), JSON.stringify(next)); } catch { /* Storage ist optional. */ }
        return next;
      });
    };

    const observer = new MutationObserver(capture);
    observer.observe(panel, { attributes: true, childList: true, subtree: true, characterData: true });
    capture();
    return () => observer.disconnect();
  }, [gameId]);

  if (!gameId) return null;

  const visibleEntries = expanded ? entries : entries.slice(0, 3);

  return <aside className="slot-win-feed" aria-label="Letzte Gewinne in diesem Slot">
    <header>
      <span className="slot-win-feed-icon"><Lightning weight="fill" aria-hidden="true" /></span>
      <div><small>Live Wins</small><strong>Deine letzten Treffer</strong></div>
      {entries.length > 3 && <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Weniger" : "Alle"}</button>}
    </header>
    {visibleEntries.length > 0 ? <ol>
      {visibleEntries.map((entry, index) => <li key={entry.id} className={index === 0 ? "is-latest" : ""}>
        <Crown weight="fill" aria-hidden="true" />
        <span><small>{entry.tier}</small><strong>{entry.amount} Coins</strong></span>
        <time dateTime={new Date(entry.createdAt).toISOString()}>{relativeTime(entry.createdAt)}</time>
      </li>)}
    </ol> : <p className="slot-win-feed-empty">Dein nächster Gewinn erscheint hier automatisch.</p>}
  </aside>;
}
