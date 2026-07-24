"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Fire, Gift, Lightning, Play, Sparkle, Trophy, SquaresFour, Crown, Star, ClockCounterClockwise, UsersThree, Heart, CheckCircle } from "@phosphor-icons/react";

const liveWins = [
  { player: "Luna77", game: "Neon Nights", amount: "8.4 M" },
  { player: "MikaX", game: "Pharaoh Oasis", amount: "12.7 M" },
  { player: "LuckyLeo", game: "Candy Carnival", amount: "4.2 M" },
];

const categories = [
  { href: "/#all-games", label: "Alle Spiele", icon: SquaresFour, badge: "128" },
  { href: "/#featured", label: "Top Slots", icon: Crown, badge: "HOT" },
  { href: "/#new", label: "Neu", icon: Star, badge: "12" },
  { href: "/#jackpots", label: "Jackpots", icon: Trophy, badge: "LIVE" },
  { href: "/#recent", label: "Zuletzt gespielt", icon: ClockCounterClockwise },
  { href: "/#social", label: "Mit Freunden", icon: UsersThree },
];

const featuredGames = [
  { href: "/slots/candy-carnival", title: "Candy Carnival", image: "/assets/slots/candy_carnival.png", players: "12.450", badge: "HOT", tone: "pink" },
  { href: "/slots/pharaoh-oasis", title: "Pharaoh Oasis", image: "/assets/slots/pharaoh_oasis.png", players: "8.932", badge: "TOP", tone: "gold" },
  { href: "/slots/neon-nights", title: "Neon Nights", image: "/assets/slots/neon_nights.png", players: "6.521", badge: "NEU", tone: "violet" },
  { href: "/slots/verdant-afterfall", title: "Verdant Afterfall", image: "/assets/slots/verdant_afterfall.png", players: "5.362", badge: "LIVE", tone: "green" },
  { href: "/slots/vegas-gold", title: "Vegas Gold", image: "/assets/slots/vegas_gold.png", players: "9.817", badge: "JACKPOT", tone: "orange" },
];

const worlds = [
  { href: "/slots/pharaoh-oasis", eyebrow: "MEGAWAYS", title: "Pharaoh Oasis", copy: "Goldene Kammern, Mystery Wilds und bis zu 117.649 Gewinnwege.", className: "pharaoh" },
  { href: "/slots/neon-nights", eyebrow: "HOLD & WIN", title: "Neon Nights", copy: "Jackpot-Orbs, pulsierende Reels und ein wachsender Bonus-Tresor.", className: "neon" },
  { href: "/slots/candy-carnival", eyebrow: "CLUSTER PAYS", title: "Candy Carnival", copy: "Kettenreaktionen, Multiplikatoren und riesige Symbol-Explosionen.", className: "candy" },
];

export function PremiumLiveRail() {
  const [activeWin, setActiveWin] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Alle Spiele");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveWin((current) => (current + 1) % liveWins.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  const win = liveWins[activeWin];
  const toggleFavorite = (title: string) => setFavorites((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);

  return (
    <section className="premium-live-layer" aria-label="Live-Casino-Highlights">
      <div className="premium-ambient" aria-hidden="true"><i /><i /><i /></div>

      <section className="premium-welcome-grid" aria-label="Willkommen und Tagesbonus">
        <article className="premium-welcome-card">
          <div className="premium-welcome-copy">
            <span><Sparkle weight="fill" /> Willkommen zurück</span>
            <h2>Dein Casino wartet.</h2>
            <p>Neue Jackpots, frische Missionen und deine Lieblingswelten sind bereit.</p>
            <div><Link href="/slots/candy-carnival"><Play weight="fill" /> Weiterspielen</Link><small>Letzter Slot: Candy Carnival</small></div>
          </div>
          <div className="premium-welcome-coins" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </article>

        <article className={bonusClaimed ? "premium-daily-chest claimed" : "premium-daily-chest"}>
          <div className="premium-chest-scene" aria-hidden="true">
            <span className="premium-chest-rays" />
            <div className="premium-chest"><i /><b /><em /></div>
            <span className="premium-chest-coin one">●</span><span className="premium-chest-coin two">●</span><span className="premium-chest-coin three">●</span>
          </div>
          <div className="premium-daily-copy">
            <small>Tagesbonus · Tag 6</small>
            <strong>{bonusClaimed ? "Bonus abgeholt" : "250.000 Coins warten"}</strong>
            <p>{bonusClaimed ? "Morgen wartet die Mystery Chest auf dich." : "Halte deine Serie aktiv und öffne morgen die große Mystery Chest."}</p>
            <button type="button" disabled={bonusClaimed} onClick={() => setBonusClaimed(true)}>{bonusClaimed ? <><CheckCircle weight="fill" /> Abgeholt</> : <><Gift weight="fill" /> Bonus abholen</>}</button>
          </div>
          <div className="premium-streak" aria-label="Tagesbonus-Serie">
            {[1,2,3,4,5,6,7].map((day) => <span className={day <= 6 ? "done" : ""} key={day}>{day < 6 ? "✓" : day === 6 ? "HEUTE" : "?"}</span>)}
          </div>
        </article>
      </section>

      <nav className="premium-category-nav" aria-label="Spielkategorien">
        {categories.map((category) => {
          const Icon = category.icon;
          const active = activeCategory === category.label;
          return <Link href={category.href} key={category.label} className={active ? "active" : ""} onClick={() => setActiveCategory(category.label)}>
            <span><Icon weight={active ? "fill" : "bold"} /></span><strong>{category.label}</strong>{category.badge ? <small>{category.badge}</small> : null}
          </Link>;
        })}
      </nav>

      <div className="premium-live-strip">
        <span className="premium-live-label"><i /> LIVE</span>
        <div className="premium-win-feed" key={`${win.player}-${activeWin}`}><Sparkle weight="fill" /><strong>{win.player}</strong><span>gewann {win.amount} in {win.game}</span></div>
        <Link href="/#events"><Trophy weight="fill" /> Rangliste</Link>
      </div>

      <div className="premium-hero-grid">
        <article className="premium-season-hero">
          <div className="premium-event-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <div className="premium-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="premium-season-copy">
            <span className="premium-kicker"><Fire weight="fill" /> Saison-Event</span>
            <h1><small>Empire of</small> Neon</h1>
            <p>Spiele dich durch animierte Casino-Welten, sammle Kronen und öffne den exklusiven Grand Vault.</p>
            <div className="premium-actions"><Link href="/slots/neon-nights"><Play weight="fill" /> Jetzt spielen</Link><button type="button" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Event ansehen</button></div>
          </div>
          <div className="premium-jackpot-core" aria-label="Event-Jackpot 24,8 Millionen Coins"><span>Event Jackpot</span><strong>24.8 M</strong><small>steigt live</small><i aria-hidden="true" /></div>
        </article>

        <aside className="premium-reward-stack">
          <button type="button" className="premium-reward-card daily" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}><span><Gift weight="fill" /></span><div><small>Tägliche Serie</small><strong>Tag 6 von 7</strong><p>Morgen: Mystery Chest</p></div><b>+250K</b></button>
          <button type="button" className="premium-reward-card boost" onClick={() => document.getElementById("missions")?.scrollIntoView({ behavior: "smooth" })}><span><Lightning weight="fill" /></span><div><small>Aktiver Boost</small><strong>2× XP Rush</strong><p>Noch 18 Minuten</p></div><b>2×</b></button>
        </aside>
      </div>

      <section className="premium-featured" id="featured" aria-labelledby="premium-featured-title">
        <div className="premium-world-header"><div><span>Für dich ausgewählt</span><h2 id="premium-featured-title">Empfohlene Slots</h2></div><Link href="/#all-games">Alle anzeigen</Link></div>
        <div className="premium-featured-rail">
          {featuredGames.map((game) => {
            const favorite = favorites.includes(game.title);
            return <article className={`premium-game-tile ${game.tone}`} key={game.title}>
              <Link href={game.href} className="premium-game-cover"><Image src={game.image} alt={`${game.title} Slot Cover`} fill sizes="(max-width: 680px) 44vw, 220px" quality={84} /><span className="premium-game-vignette" /><b className="premium-game-badge">{game.badge}</b><span className="premium-game-play"><Play weight="fill" /></span></Link>
              <button type="button" className={favorite ? "premium-favorite active" : "premium-favorite"} onClick={() => toggleFavorite(game.title)} aria-label={`${game.title} ${favorite ? "aus Favoriten entfernen" : "favorisieren"}`}><Heart weight={favorite ? "fill" : "bold"} /></button>
              <div className="premium-game-meta"><strong>{game.title}</strong><small><i /> {game.players} spielen</small></div>
            </article>;
          })}
        </div>
      </section>

      <div className="premium-world-header"><div><span>Ausgewählte Welten</span><h2>Jeder Slot fühlt sich anders an</h2></div><Link href="/#all-games">Alle Slots</Link></div>
      <div className="premium-world-rail">
        {worlds.map((world, index) => <Link href={world.href} className={`premium-world-card ${world.className}`} key={world.title}><span className="premium-card-index">0{index + 1}</span><div className="premium-card-energy" aria-hidden="true" /><div className="premium-card-copy"><small>{world.eyebrow}</small><h3>{world.title}</h3><p>{world.copy}</p><b><Play weight="fill" /> Spielen</b></div></Link>)}
      </div>
    </section>
  );
}
