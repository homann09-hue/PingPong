"use client";


import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { useCallback, useEffect, useState } from "react";
import { coinNumber, timeLeft } from "@/lib/format";


/**
 * Shop. Bis hierher zeigte die Lobby nur Platzhalter mit der Aufschrift
 * "Bald verfuegbar" — dabei war der Katalog serverseitig fertig.
 *
 * Wichtig fuer die Social-Casino-Einordnung: hier wird ausschliesslich die
 * virtuelle Waehrung Gems gegen virtuelle Coins getauscht. Kein Echtgeld,
 * keine Auszahlung, kein realer Gegenwert.
 */


interface ShopOffer {
  readonly id: string;
  readonly title: string;
  readonly coins: number;
  readonly costGems: number;
  readonly badge: string;
  readonly featured: boolean;
  readonly expiresAt: string | null;
}


interface ShopPurchase {
  readonly coins: number;
  readonly gemsSpent: number;
  readonly coinBalance: number;
  readonly gemBalance: number;
}


const purchaseErrors: Readonly<Record<string, string>> = {
  INSUFFICIENT_GEMS: "Dafuer reichen deine Gems nicht.",
  SHOP_OFFER_LIMIT_REACHED: "Dieses Angebot hast du heute schon genutzt.",
  SHOP_OFFER_NOT_FOUND: "Das Angebot ist gerade abgelaufen.",
  RATE_LIMITED: "Kurz durchatmen und noch einmal versuchen.",
};


export function ShopSection({ gems, onWalletChanged }: Readonly<{ gems: number; onWalletChanged: () => void }>) {
  const [offers, setOffers] = useState<readonly ShopOffer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());


  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/player/shop/offers", { cache: "no-store" });
      if (response.ok) setOffers((await response.json() as { offers: readonly ShopOffer[] }).offers);
      else setOffers([]);
    } catch {
      setOffers([]);
    }
  }, []);


  useEffect(() => { void load(); }, [load]);


  // Nur ein Timer fuer alle Karten — nicht einer je Angebot.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);


  async function purchase(offer: ShopOffer) {
    if (busy) return;
    setBusy(offer.id); setNotice(null);
    try {
      const response = await fetch(`/api/player/shop/offers/${offer.id}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        setNotice({ tone: "bad", text: purchaseErrors[body?.code ?? ""] ?? "Der Kauf hat gerade nicht geklappt." });
        return;
      }
      const result = await response.json() as ShopPurchase;
      setNotice({ tone: "good", text: `${coinNumber(result.coins)} Coins gutgeschrieben.` });
      await load();
      onWalletChanged();
    } catch {
      setNotice({ tone: "bad", text: "Verbindung unterbrochen." });
    } finally {
      setBusy(null);
    }
  }


  return <section className="lobby-section" id="shop" aria-labelledby="shop-title">
    <div className="section-heading">
      <div>
        <span className="eyebrow"><Gift weight="fill" /> Gems gegen Coins tauschen</span>
        <h2 id="shop-title">Shop</h2>
      </div>
      <span className="gem-balance"><Diamond weight="fill" /> {coinNumber(gems)}</span>
    </div>


    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}


    <div className="shop-grid">
      {offers === null && <p className="section-empty">Angebote werden geladen …</p>}
      {offers?.length === 0 && <p className="section-empty">Gerade sind keine Angebote aktiv.</p>}
      {offers?.map((offer) => {
        const affordable = gems >= offer.costGems;
        const remaining = offer.expiresAt ? new Date(offer.expiresAt).getTime() - now : null;
        const expired = remaining !== null && remaining <= 0;
        return <article className={offer.featured ? "shop-card featured arc-shine" : "shop-card"} key={offer.id}>
          <span className="shop-badge">{offer.badge}</span>
          <h3>{offer.title}</h3>
          <p className="shop-coins"><Coins weight="fill" /> {coinNumber(offer.coins)}</p>
          {remaining !== null && <small className="shop-timer">{expired ? "Abgelaufen" : `Noch ${timeLeft(offer.expiresAt ?? undefined)}`}</small>}
          <button
            className="claim-button"
            disabled={busy !== null || !affordable || expired}
            onClick={() => void purchase(offer)}
          >
            {busy === offer.id
              ? "…"
              : affordable
                ? <><Diamond weight="fill" /> {offer.costGems}</>
                : "Zu wenig Gems"}
          </button>
        </article>;
      })}
    </div>


    <p className="shop-disclaimer">
      Coins und Gems sind virtuelles Spielgeld ohne realen Gegenwert. Sie koennen
      nicht ausgezahlt und nicht in Echtgeld umgetauscht werden.
    </p>
  </section>;
}

