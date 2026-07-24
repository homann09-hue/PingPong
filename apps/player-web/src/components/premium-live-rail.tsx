"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fire, Gift, Lightning, Play, Sparkle, Trophy, SquaresFour, Crown, Star, ClockCounterClockwise, UsersThree, Coins, UserPlus, ChatsCircle } from "@phosphor-icons/react";

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

const worlds = [
  { href: "/slots/pharaoh-oasis", eyebrow: "MEGAWAYS", title: "Pharaoh Oasis", copy: "Goldene Kammern, Mystery Wilds und bis zu 117.649 Gewinnwege.", className: "pharaoh" },
  { href: "/slots/neon-nights", eyebrow: "HOLD & WIN", title: "Neon Nights", copy: "Jackpot-Orbs, pulsierende Reels und ein wachsender Bonus-Tresor.", className: "neon" },
  { href: "/slots/candy-carnival", eyebrow: "CLUSTER PAYS", title: "Candy Carnival", copy: "Kettenreaktionen, Multiplikatoren und riesige Symbol-Explosionen.", className: "candy" },
];

const jackpots = [
  { tier: "GRAND", game: "Pharaoh Oasis", amount: "24.850.987", className: "grand", href: "/slots/pharaoh-oasis" },
  { tier: "MAJOR", game: "Neon Nights", amount: "5.210.456", className: "major", href: "/slots/neon-nights" },
  { tier: "SUPER", game: "Candy Carnival", amount: "2.500.000", className: "super", href: "/slots/candy-carnival" },
];

const friends = [
  { name: "Julia", level: 42, status: "In Neon Nights", initials: "JU" },
  { name: "Tommy", level: 36, status: "Online", initials: "TO" },
  { name: "Lisa", level: 28, status: "In der Lobby", initials: "LI" },
];

export function PremiumLiveRail() {
  const [activeWin, setActiveWin] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Alle Spiele");

  useEffect(() => {
    const timer = window.setInterval(() => setActiveWin((current) => (current + 1) % liveWins.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  const win = liveWins[activeWin];

  return (
    <section className="premium-live-layer" aria-label="Live-Casino-Highlights">
      <div className="premium-ambient" aria-hidden="true"><i /><i /><i /></div>

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
          <div className="premium-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="premium-season-copy">
            <span className="premium-kicker"><Fire weight="fill" /> Saison-Event</span>
            <h1><small>Empire of</small> Neon</h1>
            <p>Spiele dich durch animierte Casino-Welten, sammle Kronen und öffne den exklusiven Grand Vault.</p>
            <div className="premium-actions"><Link href="/slots/neon-nights"><Play weight="fill" /> Jetzt spielen</Link><button type="button" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Event ansehen</button></div>
          </div>
          <div className="premium-jackpot-core" aria-label="Event-Jackpot 24,8 Millionen Coins"><span>Event Jackpot</span><strong>24.8 M</strong><small>steigt live</small></div>
        </article>

        <aside className="premium-reward-stack">
          <button type="button" className="premium-reward-card daily" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}><span><Gift weight="fill" /></span><div><small>Tägliche Serie</small><strong>Tag 6 von 7</strong><p>Morgen: Mystery Chest</p></div><b>+250K</b></button>
          <button type="button" className="premium-reward-card boost" onClick={() => document.getElementById("missions")?.scrollIntoView({ behavior: "smooth" })}><span><Lightning weight="fill" /></span><div><small>Aktiver Boost</small><strong>2× XP Rush</strong><p>Noch 18 Minuten</p></div><b>2×</b></button>
        </aside>
      </div>

      <div className="premium-world-header"><div><span>Ausgewählte Welten</span><h2>Jeder Slot fühlt sich anders an</h2></div><Link href="/#all-games">Alle Slots</Link></div>
      <div className="premium-world-rail">
        {worlds.map((world, index) => <Link href={world.href} className={`premium-world-card ${world.className}`} key={world.title}><span className="premium-card-index">0{index + 1}</span><div className="premium-card-energy" aria-hidden="true" /><div className="premium-card-copy"><small>{world.eyebrow}</small><h3>{world.title}</h3><p>{world.copy}</p><b><Play weight="fill" /> Spielen</b></div></Link>)}
      </div>

      <div className="premium-community-grid">
        <section className="premium-jackpot-board" id="jackpots" aria-labelledby="premium-jackpot-title">
          <header><div><span>Live-Pools</span><h2 id="premium-jackpot-title">Top Jackpots</h2></div><Link href="/#all-games">Alle anzeigen</Link></header>
          <div className="premium-jackpot-list">
            {jackpots.map((jackpot) => <Link href={jackpot.href} className={`premium-jackpot-row ${jackpot.className}`} key={jackpot.tier}><span className="premium-jackpot-medal"><Crown weight="fill" /></span><div><small>{jackpot.tier}</small><strong>{jackpot.game}</strong></div><b><Coins weight="fill" /> {jackpot.amount}</b><i>SPIELEN</i></Link>)}
          </div>
        </section>

        <section className="premium-friends-panel" id="social" aria-labelledby="premium-friends-title">
          <header><div><span>Social Lobby</span><h2 id="premium-friends-title">Freunde online</h2></div><button type="button" aria-label="Freund einladen"><UserPlus weight="bold" /></button></header>
          <div className="premium-friend-list">
            {friends.map((friend, index) => <article key={friend.name}><span className={`premium-friend-avatar avatar-${index + 1}`}>{friend.initials}<i /></span><div><strong>{friend.name}<small>LVL {friend.level}</small></strong><p>{friend.status}</p></div><button type="button"><ChatsCircle weight="fill" /><span>Einladen</span></button></article>)}
          </div>
          <div className="premium-party-card"><div className="premium-party-avatars"><span>JU</span><span>TO</span><span>LI</span><b>+2</b></div><div><small>Deine Gruppe</small><strong>3 von 5 online</strong></div><Link href="/#clans">Lobby öffnen</Link></div>
        </section>
      </div>
    </section>
  );
}
