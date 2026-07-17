"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Fire, Gift, LockKey, Play, Sparkle, Star, Target, Trophy } from "@phosphor-icons/react";
import { AppShell } from "./app-shell";
import { games } from "@/lib/catalog";
import { usePlayer } from "@/hooks/use-player";
import { useState } from "react";

const categories = ["Featured", "New", "Free spins", "Jackpots", "Bonus games"] as const;

export function Lobby() {
  const { profile, error } = usePlayer();
  const [category, setCategory] = useState<(typeof categories)[number]>("Featured");
  const level = profile?.progression.level ?? 1;
  const visibleGames = games.filter((game) => {
    if (category === "Featured") return game.featured || game.id === "pharaoh-oasis";
    if (category === "New") return game.isNew;
    if (category === "Free spins") return game.features.toLowerCase().includes("free spin");
    if (category === "Bonus games") return game.category === "Bonus games" || game.features.toLowerCase().includes("bonus");
    return game.id === "vegas-gold" || game.id === "pharaoh-oasis";
  });
  return <AppShell profile={profile}>
    {error && <div className="service-alert" role="status">{error} Playing will reconnect automatically.</div>}
    <section className="hero" aria-labelledby="hero-title">
      <Image src="/assets/slots/pharaoh_oasis.png" alt="Pharaoh Oasis golden temple artwork" fill priority sizes="(max-width: 760px) 100vw, 70vw" quality={86} />
      <div className="hero-scrim" />
      <div className="hero-copy"><span className="eyebrow"><Sparkle weight="fill" /> Featured adventure</span><h1 id="hero-title">Pharaoh Oasis</h1><p>Mystery reveals, expanding wilds and 2× free-spin wins.</p><Link href="/slots/pharaoh-oasis" className="primary-button"><Play weight="fill" /> Play now</Link></div>
      <div className="hero-jackpot"><span>Grand jackpot</span><strong>72,450,000</strong></div>
    </section>

    <section className="quick-actions" aria-label="Daily activities">
      <article><span className="action-icon gold"><Gift weight="fill" /></span><div><strong>Daily bonus</strong><span>Ready to collect</span></div><button aria-label="Open daily bonus"><ArrowRight /></button></article>
      <article id="missions"><span className="action-icon pink"><Target weight="fill" /></span><div><strong>Daily missions</strong><span>2 of 5 complete</span><progress value="2" max="5" /></div><button aria-label="Open missions"><ArrowRight /></button></article>
      <article id="events"><span className="action-icon cyan"><Trophy weight="fill" /></span><div><strong>Fireball league</strong><span>Rank 124 · 2d 8h</span></div><button aria-label="Open league"><ArrowRight /></button></article>
    </section>

    <section className="catalog" aria-labelledby="games-title">
      <div className="section-heading"><div><span className="eyebrow"><Fire weight="fill" /> Live casino</span><h2 id="games-title">Find your next win</h2></div><Link href="#all-games">View all <ArrowRight /></Link></div>
      <div className="category-row" role="list" aria-label="Slot categories">{categories.map((item) => <button key={item} className={item === category ? "selected" : ""} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="game-grid" id="all-games">{visibleGames.map((game) => {
        const locked = level < game.unlockLevel;
        return <article className="game-card" key={game.id}>
          <div className="game-cover"><Image src={game.cover} alt={`${game.name} slot cover`} fill sizes="(max-width: 600px) 72vw, (max-width: 1100px) 40vw, 23vw" quality={72} />
            <div className="card-badges">{game.isNew && <span>New</span>}{game.highRoller && <span className="vip-badge"><Star weight="fill" /> VIP</span>}</div>
            {locked ? <div className="lock-state"><LockKey weight="fill" /><span>Unlocks at level {game.unlockLevel}</span></div> : <Link className="cover-play" href={game.id === "pharaoh-oasis" ? `/slots/${game.id}` : "#coming-soon"} aria-label={`Play ${game.name}`}><Play weight="fill" /></Link>}
          </div>
          <div className="game-copy"><div><h3>{game.name}</h3><span>{game.category}</span></div><p>{game.features}</p></div>
        </article>;
      })}</div>
    </section>

    <aside className="live-rail">
      <article><span className="eyebrow"><Clock weight="fill" /> Limited time</span><h2>Oasis Quest</h2><p>Land 24 scatters in Pharaoh Oasis.</p><progress value="9" max="24" /><div className="rail-progress"><span>9 / 24</span><strong>50,000 coins</strong></div></article>
      <article id="rewards"><span className="eyebrow"><Trophy weight="fill" /> Tournament</span><h2>Weekend Crown</h2><p>Your current rank</p><div className="rank-line"><strong>#124</strong><span>Top 20% · 2d 8h</span></div></article>
    </aside>
  </AppShell>;
}
