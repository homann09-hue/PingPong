"use client";

import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Stamp } from "@phosphor-icons/react/dist/csr/Stamp";
import { CheckSquare } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { useCallback, useEffect, useState } from "react";
import { coinNumber } from "@/lib/format";

interface CheckWinStatus { marks: number; requiredMarks: number; claimable: boolean; rewardCoins: number; rewardStamps: number }
interface BoosterStatus { stamps: number; stampsPerBooster: number; boosters: number; activeSpins: number; xpMultiplier: number; canCraft: boolean; canActivate: boolean }
interface LoyaltyOffer { id: string; title: string; rewardCurrency: string; rewardAmount: number; costLoyaltyPoints: number; canRedeem: boolean }
interface LoyaltyStatus { loyaltyPoints: number; offers: readonly LoyaltyOffer[] }
interface HighRollerStatus { points: number; entryPoints: number; eligible: boolean; active: boolean; activeUntil: string | null }

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() as T : null;
  } catch {
    return null;
  }
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
  } catch {
    return { ok: false, code: "NETWORK" };
  }
}

const messages: Readonly<Record<string, string>> = {
  CHECK_WIN_NOT_CLAIMABLE: "Du brauchst noch mehr Marken.",
  BOOSTER_NOT_AVAILABLE: "Dafür fehlen dir noch Stamps.",
  BOOSTER_ACTION_CONFLICT: "Diese Aktion läuft bereits.",
  HIGH_ROLLER_NOT_ELIGIBLE: "Du brauchst mehr High-Roller-Punkte.",
  HIGH_ROLLER_ALREADY_ACTIVE: "Deine Mitgliedschaft läuft bereits.",
  INSUFFICIENT_LOYALTY_POINTS: "Dafür reichen deine Loyalitätspunkte nicht.",
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
    setBusy(key);
    setNotice(null);
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

  const marksNeeded = checkWin?.requiredMarks ?? 0;
  const marksProgress = checkWin ? Math.min(100, Math.round((checkWin.marks / Math.max(1, marksNeeded)) * 100)) : 0;
  const stampsNeeded = booster?.stampsPerBooster ?? 0;
  const stampProgress = booster ? Math.min(100, Math.round((booster.stamps / Math.max(1, stampsNeeded)) * 100)) : 0;
  const clubProgress = club && club.entryPoints > 0 ? Math.min(100, Math.round((club.points / club.entryPoints) * 100)) : 0;

  return <section className="fl-system-section fl-boost-system" id="boost" aria-labelledby="boost-title">
    <header className="fl-system-heading">
      <div><span><Lightning weight="fill" /> Bonus Features</span><h2 id="boost-title">Reward Center</h2></div>
      <strong>COLLECT · CRAFT · ACTIVATE</strong>
    </header>

    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}

    <div className="boost-grid fl-boost-grid">
      <article className="boost-card fl-reward-card arc-shine">
        <header><span className="boost-icon check"><CheckSquare weight="fill" /></span><div><small>DAILY COLLECTION</small><strong>Check &amp; Win</strong><p>Jeder Gewinnspin bringt eine Marke.</p></div></header>
        <div className="fl-reward-value"><strong>{checkWin ? `${checkWin.marks} / ${marksNeeded}` : "—"}</strong><small>MARKS</small></div>
        <span className="progress-track"><i style={{ width: `${marksProgress}%` }} /></span>
        <button className="claim-button fl-gold-action" disabled={busy !== null || !checkWin?.claimable} onClick={() => void run("check-win", "/api/player/economy/check-win/claim", "Marken eingelöst — Coins und ein Stamp gutgeschrieben.")}>
          {busy === "check-win" ? "…" : checkWin?.claimable ? "COLLECT" : "KEEP PLAYING"}
        </button>
      </article>

      <article className="boost-card fl-reward-card arc-shine">
        <header><span className="boost-icon stamp"><Stamp weight="fill" /></span><div><small>POWER-UP SYSTEM</small><strong>Stamps &amp; Booster</strong><p>Drei Stamps ergeben einen Booster.</p></div></header>
        <div className="fl-reward-value"><strong>{booster ? `${booster.stamps} / ${stampsNeeded}` : "—"}</strong><small>STAMPS</small></div>
        <span className="progress-track"><i style={{ width: `${stampProgress}%` }} /></span>
        {booster && booster.activeSpins > 0 && <p className="boost-active">Aktiv: {booster.activeSpins} Spins mit {booster.xpMultiplier}× XP</p>}
        <div className="boost-actions">
          <button className="claim-button fl-gold-action" disabled={busy !== null || !booster?.canCraft} onClick={() => void run("craft", "/api/player/economy/boosters/craft", "Booster hergestellt.")}>{busy === "craft" ? "…" : "CRAFT"}</button>
          <button className="claim-button ghost fl-purple-action" disabled={busy !== null || !booster?.canActivate} onClick={() => void run("activate", "/api/player/economy/boosters/activate", "Booster aktiviert — 20 Spins mit doppelter Erfahrung.")}>{busy === "activate" ? "…" : "ACTIVATE"}</button>
        </div>
      </article>

      <article className="boost-card fl-reward-card fl-high-roller-card arc-shine">
        <header><span className="boost-icon crown"><Crown weight="fill" /></span><div><small>EXCLUSIVE ACCESS</small><strong>High Roller Club</strong><p>Sieben Tage Cashback und doppelte Liga-Punkte.</p></div></header>
        <div className="fl-reward-value"><strong>{club ? coinNumber(club.points) : "—"}</strong><small>{club && club.entryPoints > 0 ? `/ ${coinNumber(club.entryPoints)} POINTS` : "POINTS"}</small></div>
        <span className="progress-track"><i style={{ width: `${clubProgress}%` }} /></span>
        {club?.active && <p className="boost-active">Mitgliedschaft aktiv{club.activeUntil ? ` bis ${new Date(club.activeUntil).toLocaleDateString("de-DE")}` : ""}</p>}
        <button className="claim-button fl-gold-action" disabled={busy !== null || club?.active || !club?.eligible} onClick={() => void run("club", "/api/player/economy/high-roller-club/activate", "Willkommen im High Roller Club.")}>
          {busy === "club" ? "…" : club?.active ? "ACTIVE" : "JOIN CLUB"}
        </button>
      </article>
    </div>

    <div className="fl-loyalty-heading"><span><Crown weight="fill" /> Loyalty Exchange</span><strong>{loyalty ? `${coinNumber(loyalty.loyaltyPoints)} POINTS` : "LOADING"}</strong></div>
    <div className="loyalty-grid fl-loyalty-grid">
      {!loyalty && <p className="section-empty">Angebote werden geladen …</p>}
      {loyalty?.offers.map((offer) => <article className="loyalty-card fl-loyalty-card" key={offer.id}>
        <Crown weight="fill" />
        <small>{offer.title}</small>
        <strong>{coinNumber(offer.rewardAmount)} {offer.rewardCurrency === "gem" ? "GEMS" : "COINS"}</strong>
        <span>{coinNumber(offer.costLoyaltyPoints)} POINTS</span>
        <button className="claim-button fl-gold-action" disabled={busy !== null || !offer.canRedeem} onClick={() => void run(offer.id, `/api/player/economy/loyalty-rewards/${offer.id}/redeem`, "Belohnung eingetauscht.")}>
          {busy === offer.id ? "…" : "REDEEM"}
        </button>
      </article>)}
    </div>
  </section>;
}
