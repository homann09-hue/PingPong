"use client";

import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Paytable } from "@/lib/paytable";
import { coinNumber } from "@/lib/format";

type FeatureCard = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Star;
}>;

export function SlotFeatureCards() {
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

  const symbols = Object.entries(paytable?.symbols ?? {});
  const wild = symbols.find(([, definition]) => definition.kind === "wild");
  const scatter = symbols.find(([, definition]) => definition.kind === "scatter");
  const cards: FeatureCard[] = [];

  if (wild) {
    cards.push({
      id: "wild",
      eyebrow: "Spezialsymbol",
      title: "Wild",
      description: "Ersetzt reguläre Symbole und verbessert mögliche Gewinnkombinationen.",
      icon: Sparkle,
    });
  }

  if (scatter) {
    cards.push({
      id: "scatter",
      eyebrow: "Bonus-Trigger",
      title: "Scatter",
      description: "Zählt unabhängig von Gewinnlinien und kann Bonusfunktionen auslösen.",
      icon: Star,
    });
  }

  cards.push({
    id: "volatility",
    eyebrow: "Spielprofil",
    title: paytable?.volatility ? String(paytable.volatility).replaceAll("_", " ") : "Volatilität",
    description: "Zeigt das Verhältnis zwischen Trefferhäufigkeit und möglicher Gewinnhöhe.",
    icon: Fire,
  });

  cards.push({
    id: "max-win",
    eyebrow: "Gewinnpotenzial",
    title: paytable?.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}× Max Win` : "Max Win",
    description: "Der maximale veröffentlichte Gewinnmultiplikator dieses Spiels.",
    icon: Trophy,
  });

  return <section className={`slot-feature-cards ${paytable ? "is-ready" : "is-loading"}`} aria-label="Spielmechaniken">
    <header className="slot-feature-cards-heading">
      <span>Features</span>
      <strong>Spielmechaniken</strong>
    </header>
    <div className="slot-feature-cards-track">
      {cards.map(({ id, eyebrow, title, description, icon: Icon }) => <article className="slot-feature-card" key={id}>
        <span className="slot-feature-card-icon"><Icon weight="fill" aria-hidden="true" /></span>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </article>)}
    </div>
  </section>;
}
