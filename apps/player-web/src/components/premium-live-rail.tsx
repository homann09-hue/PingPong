"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Fire, Gift, Lightning, Play, Sparkle, Trophy, SquaresFour, Crown, Star, ClockCounterClockwise, UsersThree, Heart, CheckCircle, Target, Medal, Timer, ArrowRight, EnvelopeSimple, LockKey, Coins } from "@phosphor-icons/react";

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

const passRewards = [
  { level: 21, reward: "150K", icon: Coins, unlocked: true },
  { level: 22, reward: "2× XP", icon: Lightning, unlocked: true },
  { level: 23, reward: "Chest", icon: Gift, unlocked: false },
  { level: 24, reward: "500K", icon: Coins, unlocked: false },
  { level: 25, reward: "VIP Box", icon: Crown, unlocked: false },
];

export function PremiumLiveRail() {
  const [activeWin, setActiveWin] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Alle Spiele");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [inboxClaimed, setInboxClaimed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5 * 3600 + 42 * 60 + 18);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveWin((current) => (current + 1) % liveWins.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const win = liveWins[activeWin];
  const toggleFavorite = (title: string) => setFavorites((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <section className="premium-live-layer" aria-label="Live-Casino-Highlights">
      <div className="premium-ambient" aria-hidden="true"><i /><i /><i /></div>

      <section className="premium-welcome-grid" aria-label="Willkommen und Tagesbonus">
        <article className="premium-welcome-card">
          <div className="premium-welcome-copy"><span><Sparkle weight="fill" /> Willkommen zurück</span><h2>Dein Casino wartet.</h2><p>Neue Jackpots, frische Missionen und deine Lieblingswelten sind bereit.</p><div><Link href="/slots/candy-carnival"><Play weight="fill" /> Weiterspielen</Link><small>Letzter Slot: Candy Carnival</small></div></div>
          <div className="premium-welcome-coins" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </article>
        <article className={bonusClaimed ? "premium-daily-chest claimed" : "premium-daily-chest"}>
          <div className="premium-chest-scene" aria-hidden="true"><span className="premium-chest-rays" /><div className="premium-chest"><i /><b /><em /></div><span className="premium-chest-coin one">●</span><span className="premium-chest-coin two">●</span><span className="premium-chest-coin three">●</span></div>
          <div className="premium-daily-copy"><small>Tagesbonus · Tag 6</small><strong>{bonusClaimed ? "Bonus abgeholt" : "250.000 Coins warten"}</strong><p>{bonusClaimed ? "Morgen wartet die Mystery Chest auf dich." : "Halte deine Serie aktiv und öffne morgen die große Mystery Chest."}</p><button type="button" disabled={bonusClaimed} onClick={() => setBonusClaimed(true)}>{bonusClaimed ? <><CheckCircle weight="fill" /> Abgeholt</> : <><Gift weight="fill" /> Bonus abholen</>}</button></div>
          <div className="premium-streak" aria-label="Tagesbonus-Serie">{[1,2,3,4,5,6,7].map((day) => <span className={day <= 6 ? "done" : ""} key={day}>{day < 6 ? "✓" : day === 6 ? "HEUTE" : "?"}</span>)}</div>
        </article>
      </section>

      <nav className="premium-category-nav" aria-label="Spielkategorien">{categories.map((category) => { const Icon = category.icon; const active = activeCategory === category.label; return <Link href={category.href} key={category.label} className={active ? "active" : ""} onClick={() => setActiveCategory(category.label)}><span><Icon weight={active ? "fill" : "bold"} /></span><strong>{category.label}</strong>{category.badge ? <small>{category.badge}</small> : null}</Link>; })}</nav>

      <div className="premium-live-strip"><span className="premium-live-label"><i /> LIVE</span><div className="premium-win-feed" key={`${win.player}-${activeWin}`}><Sparkle weight="fill" /><strong>{win.player}</strong><span>gewann {win.amount} in {win.game}</span></div><Link href="/#events"><Trophy weight="fill" /> Rangliste</Link></div>

      <div className="premium-hero-grid">
        <article className="premium-season-hero"><div className="premium-event-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><div className="premium-orbit" aria-hidden="true"><span /><span /><span /></div><div className="premium-season-copy"><span className="premium-kicker"><Fire weight="fill" /> Saison-Event</span><h1><small>Empire of</small> Neon</h1><p>Spiele dich durch animierte Casino-Welten, sammle Kronen und öffne den exklusiven Grand Vault.</p><div className="premium-actions"><Link href="/slots/neon-nights"><Play weight="fill" /> Jetzt spielen</Link><button type="button" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Event ansehen</button></div></div><div className="premium-jackpot-core" aria-label="Event-Jackpot 24,8 Millionen Coins"><span>Event Jackpot</span><strong>24.8 M</strong><small>steigt live</small><i aria-hidden="true" /></div></article>
        <aside className="premium-reward-stack"><button type="button" className="premium-reward-card daily" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}><span><Gift weight="fill" /></span><div><small>Tägliche Serie</small><strong>Tag 6 von 7</strong><p>Morgen: Mystery Chest</p></div><b>+250K</b></button><button type="button" className="premium-reward-card boost" onClick={() => document.getElementById("missions")?.scrollIntoView({ behavior: "smooth" })}><span><Lightning weight="fill" /></span><div><small>Aktiver Boost</small><strong>2× XP Rush</strong><p>Noch 18 Minuten</p></div><b>2×</b></button></aside>
      </div>

      <section className="premium-liveops" aria-labelledby="premium-liveops-title">
        <div className="premium-world-header"><div><span>Live-Service-Zentrale</span><h2 id="premium-liveops-title">Heute läuft mehr</h2></div><Link href="/#events">Alle Events</Link></div>
        <div className="premium-liveops-grid">
          <article className="premium-tournament-card"><div className="premium-tournament-glow" aria-hidden="true" /><span className="premium-liveops-icon"><Trophy weight="fill" /></span><div className="premium-liveops-copy"><small>Wochenend-Turnier</small><strong>Neon Crown Clash</strong><p>Spiele dich in die Top 100 und sichere dir einen Anteil am 50-Millionen-Pool.</p></div><div className="premium-rank-block"><small>Dein Rang</small><strong>#148</strong><span>↑ 26 Plätze</span></div><div className="premium-countdown"><Timer weight="fill" /><span><b>{hours}</b><small>STD</small></span><i>:</i><span><b>{minutes}</b><small>MIN</small></span><i>:</i><span><b>{seconds}</b><small>SEK</small></span></div><Link href="/slots/neon-nights">Punkte sammeln <ArrowRight weight="bold" /></Link></article>
          <article className="premium-quest-card"><header><span><Target weight="fill" /></span><div><small>Tagesmission</small><strong>Bonusjäger</strong></div><b>3/5</b></header><p>Löse fünf Bonus-Runden in beliebigen Slots aus.</p><div className="premium-progress"><i style={{ width: "60%" }} /></div><footer><span><Gift weight="fill" /> 400K Coins</span><Link href="/#missions">Missionen</Link></footer></article>
          <article className="premium-vip-card"><header><span><Medal weight="fill" /></span><div><small>VIP-Fortschritt</small><strong>Gold III</strong></div><b>72%</b></header><p>Noch 2.800 VIP-Punkte bis Platin I und exklusiven Monatsboni.</p><div className="premium-progress vip"><i style={{ width: "72%" }} /></div><footer><span><Crown weight="fill" /> 7-Tage-Bonus +15%</span><Link href="/#rewards">VIP ansehen</Link></footer></article>
        </div>
      </section>

      <section className="premium-pass-center" aria-labelledby="premium-pass-title">
        <article className="premium-season-pass">
          <div className="premium-pass-copy"><span><Crown weight="fill" /> Season Pass</span><h2 id="premium-pass-title">Neon Dynasty</h2><p>Verdiene Saison-XP, steige durch 50 Stufen und sichere dir exklusive Belohnungen.</p><div className="premium-pass-level"><strong>Stufe 22</strong><span>7.480 / 10.000 XP</span></div><div className="premium-pass-progress"><i /></div></div>
          <div className="premium-pass-track">{passRewards.map((item) => { const Icon = item.icon; return <div className={item.unlocked ? "unlocked" : "locked"} key={item.level}><small>{item.level}</small><span><Icon weight="fill" /></span><strong>{item.reward}</strong>{!item.unlocked && <i><LockKey weight="fill" /></i>}</div>; })}</div>
          <Link href="/#rewards">Season Pass öffnen <ArrowRight weight="bold" /></Link>
        </article>

        <article className={inboxClaimed ? "premium-reward-inbox claimed" : "premium-reward-inbox"}>
          <header><span><EnvelopeSimple weight="fill" /></span><div><small>Belohnungs-Inbox</small><strong>{inboxClaimed ? "Alles abgeholt" : "3 Geschenke warten"}</strong></div>{!inboxClaimed && <b>3</b>}</header>
          <div className="premium-inbox-items"><span><Coins weight="fill" /> 300K Coins</span><span><Lightning weight="fill" /> 30 Min. XP-Boost</span><span><Gift weight="fill" /> Mystery Box</span></div>
          <button type="button" disabled={inboxClaimed} onClick={() => setInboxClaimed(true)}>{inboxClaimed ? <><CheckCircle weight="fill" /> Eingesammelt</> : <><Gift weight="fill" /> Alles abholen</>}</button>
        </article>
      </section>

      <section className="premium-featured" id="featured" aria-labelledby="premium-featured-title"><div className="premium-world-header"><div><span>Für dich ausgewählt</span><h2 id="premium-featured-title">Empfohlene Slots</h2></div><Link href="/#all-games">Alle anzeigen</Link></div><div className="premium-featured-rail">{featuredGames.map((game) => { const favorite = favorites.includes(game.title); return <article className={`premium-game-tile ${game.tone}`} key={game.title}><Link href={game.href} className="premium-game-cover"><Image src={game.image} alt={`${game.title} Slot Cover`} fill sizes="(max-width: 680px) 44vw, 220px" quality={84} /><span className="premium-game-vignette" /><b className="premium-game-badge">{game.badge}</b><span className="premium-game-play"><Play weight="fill" /></span></Link><button type="button" className={favorite ? "premium-favorite active" : "premium-favorite"} onClick={() => toggleFavorite(game.title)} aria-label={`${game.title} ${favorite ? "aus Favoriten entfernen" : "favorisieren"}`}><Heart weight={favorite ? "fill" : "bold"} /></button><div className="premium-game-meta"><strong>{game.title}</strong><small><i /> {game.players} spielen</small></div></article>; })}</div></section>

      <div className="premium-world-header"><div><span>Ausgewählte Welten</span><h2>Jeder Slot fühlt sich anders an</h2></div><Link href="/#all-games">Alle Slots</Link></div>
      <div className="premium-world-rail">{worlds.map((world, index) => <Link href={world.href} className={`premium-world-card ${world.className}`} key={world.title}><span className="premium-card-index">0{index + 1}</span><div className="premium-card-energy" aria-hidden="true" /><div className="premium-card-copy"><small>{world.eyebrow}</small><h3>{world.title}</h3><p>{world.copy}</p><b><Play weight="fill" /> Spielen</b></div></Link>)}</div>
    </section>
  );
}
