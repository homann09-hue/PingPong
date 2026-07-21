"use client";

import { ArrowDown } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { ArrowUp } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { Receipt } from "@phosphor-icons/react/dist/csr/Receipt";
import { useCallback, useEffect, useState } from "react";
import { coinNumber } from "@/lib/format";

/**
 * Wallet-Historie. Die immutable Ledger-Tabelle existiert serverseitig laengst
 * — jede Buchung mit Betrag, Grund, Kontostand davor und danach. Sichtbar war
 * sie nie.
 *
 * Fuer ein Casino mit virtueller Waehrung ist das ein Vertrauenspunkt: der
 * Spieler kann jede Gutschrift und jede Abbuchung nachvollziehen. Der Wert
 * balanceAfter kommt direkt aus dem Ledger — hier wird nichts nachgerechnet,
 * was auseinanderlaufen koennte.
 */

interface WalletTransaction {
  readonly id: string;
  readonly currency: string;
  readonly amount: number;
  readonly direction: "credit" | "debit";
  readonly reason: string;
  readonly balanceAfter: number;
  readonly createdAt: string;
}

// Serverseitige Gruende in lesbare Bezeichnungen uebersetzen. Unbekannte
// Gruende fallen auf eine bereinigte Fassung des Rohwerts zurueck, statt zu
// verschwinden — eine neue Buchungsart soll nicht unsichtbar sein.
const reasonLabels: Readonly<Record<string, string>> = {
  slot_spin: "Spin",
  slot_win: "Gewinn",
  daily_reward: "Taegliche Belohnung",
  hourly_reward: "Stuendlicher Bonus",
  mission_reward: "Mission",
  event_milestone: "Event-Meilenstein",
  wheel_spin: "Gluecksrad",
  shop_purchase: "Shop-Kauf",
  loyalty_redemption: "Loyalitaets-Tausch",
  booster_activation: "Booster",
  check_win_claim: "Check &amp; Win",
  admin_adjustment: "Korrektur",
};

function labelFor(reason: string): string {
  return reasonLabels[reason] ?? reason.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const currencyLabels: Readonly<Record<string, string>> = {
  coin: "Coins", gem: "Gems", stamp: "Stamps", mark: "Marken",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function WalletHistory() {
  const [entries, setEntries] = useState<readonly WalletTransaction[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch("/api/player/wallet/transactions?limit=40", { cache: "no-store" });
      if (!response.ok) { setFailed(true); return; }
      const body = await response.json() as { transactions: readonly WalletTransaction[] };
      setEntries(body.transactions);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="account-card wallet-history-card" aria-labelledby="wallet-history-title">
    <header>
      <div>
        <span className="account-eyebrow"><Receipt weight="fill" /> Nachvollziehbar</span>
        <h2 id="wallet-history-title">Kontobewegungen</h2>
      </div>
    </header>

    {failed && <p className="account-notice bad" role="status">
      Die Historie konnte nicht geladen werden.{" "}
      <button className="link-button" onClick={() => void load()}>Erneut versuchen</button>
    </p>}

    {!failed && entries === null && <p className="section-empty">Wird geladen …</p>}

    {entries?.length === 0 && <p className="section-empty">Noch keine Buchungen. Dreh eine Runde — dann erscheint sie hier.</p>}

    {entries && entries.length > 0 && <ul className="ledger-list">
      {entries.map((entry) => {
        const credit = entry.direction === "credit";
        return <li key={entry.id} className={credit ? "ledger-row credit" : "ledger-row debit"}>
          <span className="ledger-icon" aria-hidden="true">
            {credit ? <ArrowUp weight="bold" /> : <ArrowDown weight="bold" />}
          </span>
          <span className="ledger-main">
            <strong>{labelFor(entry.reason)}</strong>
            <small>{formatTime(entry.createdAt)}</small>
          </span>
          <span className="ledger-amount">
            <strong>{credit ? "+" : "−"}{coinNumber(entry.amount)}</strong>
            <small>{currencyLabels[entry.currency] ?? entry.currency}</small>
          </span>
          <span className="ledger-balance" title="Kontostand danach">{coinNumber(entry.balanceAfter)}</span>
        </li>;
      })}
    </ul>}
  </section>;
}
