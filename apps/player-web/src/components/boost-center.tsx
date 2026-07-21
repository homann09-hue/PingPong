"use client";

import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Stamp } from "@phosphor-icons/react/dist/csr/Stamp";
import { CheckSquare } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { useCallback, useEffect, useState } from "react";
import { coinNumber } from "@/lib/format";

/**
 * Boost-Center: buendelt die Sammel- und Tauschsysteme, die serverseitig
 * laengst existieren — Check-&-Win-Marken, Stamps und Booster, Loyalitaetspunkte
 * und den High Roller Club.
 *
 * Alle Aktionen sind idempotent: der Server verrechnet jede Anfrage genau einmal,
 * ein Doppelklick kann nichts doppelt einloesen.
 */

interface CheckWinStatus { marks: number; required?: number; claimable: boolean }
interface BoosterStatus { stamps: number; canCraft: boolean; activeSpins: number; xpMultiplier?: number; boosters?: number }
interface LoyaltyOffer { id: string; rewardCurrency: string; rewardAmount: number; costLoyaltyPoints: number; canRedeem: boolean }
interface LoyaltyStatus { loyaltyPoints: number; offers: readonly LoyaltyOffer[] }
interface HighRollerStatus { points: number; entryPoints?: number; active: boolean; activeUntil?: string | null }

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

async function action(url: string): Promise<{ ok: boolean; code?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({}),
    });
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => null) as { code?: string } | null;
    return { ok: false, code: body?.code };
  } catch { return { ok: false, code: "NETWORK" }; }
}

const messages: Readonly<Record<string, string>> = {
  CHECK_WIN_NOT_CLAIMABLE: "Du brauchst noch mehr Marken.",
  BOOSTER_NOT_AVAILABLE: "Dafuer fehlen dir noch Stamps.",
  BOOSTER_ACTION_CONFLICT: "Diese Aktion laeuft bereits.",
  HIGH_ROLLER_NOT_ELIGIBLE: "Du brauchst mehr High-Roller-Punkte.",
  HIGH_ROLLER_ALREADY_ACTIVE: "Deine Mitgliedschaft laeuft bereits.",
  INSUFFICIENT_LOYALTY_POINTS: "Dafuer reichen deine Loyalitaetspunkte nicht.",
  RATE_LIMITED: "Kurz durchatmen und noch einmal versuchen.",
};

export function BoostCenter({ onWalletChanged }: Readonly<{ onWalletChanged: () => void }>) {
  const [checkWin, setCheckWin] = useState<CheckWinStatus | null>(null);
  const [booster, setBooster] = useState<BoosterStatus | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);
  const [club, setClub] = useState<HighRollerStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const [win, boost, loyal, hrc] = await Promise.all([
      readJson<CheckWinStatus>("/api/player/economy/check-win"),
      readJson<BoosterStatus>("/api/player/economy/boosters"),
      readJson<LoyaltyStatus>("/api/player/economy/loyalty-rewards"),
      readJson<HighRollerStatus>("/api/player/economy/high-roller-club"),
    ]);
    if (win) setCheckWin(win);
    if (boost) setBooster(boost);
    if (loyal) setLoyalty(loyal);
    if (hrc) setClub(hrc);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function run(key: string, url: string, success: string) {
    if (busy) return;
    setBusy(key); setNotice(null);
    const result = await action(url);
    if (result.ok) {
      setNotice({ tone: "good", text: success });
      await refresh();
      onWalletChanged();
    } else {
      setNotice({ tone: "bad", text: messages[result.code ?? ""] ?? "Das hat gerade nicht geklappt." });
    }
    setBusy(null);
  }

  const marksNeeded = checkWin?.required ?? 5;
  const marksProgress = checkWin ? Math.min(100, Math.round((checkWin.marks / Math.max(1, marksNeeded)) * 100)) : 0;
  const stampsNeeded = 3;
  const stampProgress = booster ? Math.min(100, Math.round((booster.stamps / stampsNeeded) * 100)) : 0;
  const clubProgress = club?.entryPoints ? Math.min(100, Math.round((club.points / club.entryPoints) * 100)) : 0;

  return <section className="lobby-section" id="boost" aria-labelledby="boost-title">
    <div className="section-heading">
      <div><span className="eyebrow"><Lightning weight="fill" /> Sammeln, tauschen, verstaerken</span><h2 id="boost-title">Boost-Center</h2></div>
    </div>
    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}
    <div className="boost-grid">

      <article className="boost-card arc-shine">
        <header><span className="boost-icon check"><CheckSquare weight="fill" /></span><div><strong>Check &amp; Win</strong><small>Jeder Gewinnspin bringt eine Marke.</small></div></header>
        <p className="boost-value">{checkWin ? `${checkWin.marks} / ${marksNeeded}` : "—"}</p>
        <span className="progress-track"><i style={{ width: `${marksProgress}%` }} /></span>
        <button className="claim-button" disabled={busy !== null || !checkWin?.claimable}
          onClick={() => void run("check-win", "/api/player/economy/check-win/claim", "Marken eingeloest — Coins und ein Stamp gutgeschrieben.")}>
          {busy === "check-win" ? "…" : checkWin?.claimable ? "Einloesen" : "Noch sammeln"}
        </button>
      </article>

      <article className="boost-card arc-shine">
        <header><span className="boost-icon stamp"><Stamp weight="fill" /></span><div><strong>Stamps &amp; Booster</strong><small>Drei Stamps ergeben einen Booster.</small></div></header>
        <p className="boost-value">{booster ? `${booster.stamps} / ${stampsNeeded}` : "—"}</p>
        <span className="progress-track"><i style={{ width: `${stampProgress}%` }} /></span>
        {booster && booster.activeSpins > 0 && <p className="boost-active">Aktiv: {booster.activeSpins} Spins mit {booster.xpMultiplier ?? 2}× XP</p>}
        <div className="boost-actions">
          <button className="claim-button" disabled={busy !== null || !booster?.canCraft}
            onClick={() => void run("craft", "/api/player/economy/boosters/craft", "Booster hergestellt.")}>
            {busy === "craft" ? "…" : "Herstellen"}
          </button>
          <button className="claim-button ghost" disabled={busy !== null || !(booster?.boosters ?? 0)}
            onClick={() => void run("activate", "/api/player/economy/boosters/activate", "Booster aktiviert — 20 Spins mit doppelter Erfahrung.")}>
            {busy === "activate" ? "…" : "Aktivieren"}
          </button>
        </div>
      </article>

      <article className="boost-card arc-shine">
        <header><span className="boost-icon crown"><Crown weight="fill" /></span><div><strong>High Roller Club</strong><small>Sieben Tage Cashback und doppelte Liga-Punkte.</small></div></header>
        <p className="boost-value">{club ? coinNumber(club.points) : "—"}{club?.entryPoints ? ` / ${coinNumber(club.entryPoints)}` : ""}</p>
        <span className="progress-track"><i style={{ width: `${clubProgress}%` }} /></span>
        {club?.active && <p className="boost-active">Mitgliedschaft aktiv{club.activeUntil ? ` bis ${new Date(club.activeUntil).toLocaleDateString("de-DE")}` : ""}</p>}
        <button className="claim-button" disabled={busy !== null || club?.active || clubProgress < 100}
          onClick={() => void run("club", "/api/player/economy/high-roller-club/activate", "Willkommen im High Roller Club.")}>
          {busy === "club" ? "…" : club?.active ? "Aktiv" : "Beitreten"}
        </button>
      </article>

    </div>

    <h3 className="subheading">Loyalitaets-Tausch{loyalty ? ` · ${coinNumber(loyalty.loyaltyPoints)} Punkte` : ""}</h3>
    <div className="loyalty-grid">
      {!loyalty && <p className="section-empty">Angebote werden geladen …</p>}
      {loyalty?.offers.map((offer) => <article className="loyalty-card" key={offer.id}>
        <strong>{coinNumber(offer.rewardAmount)} {offer.rewardCurrency === "gem" ? "Gems" : "Coins"}</strong>
        <small>{coinNumber(offer.costLoyaltyPoints)} Punkte</small>
        <button className="claim-button" disabled={busy !== null || !offer.canRedeem}
          onClick={() => void run(offer.id, `/api/player/economy/loyalty-rewards/${offer.id}/redeem`, "Belohnung eingetauscht.")}>
          {busy === offer.id ? "…" : "Tauschen"}
        </button>
      </article>)}
    </div>
  </section>;
}
