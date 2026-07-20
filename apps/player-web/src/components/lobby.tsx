"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { RocketLaunch } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { useState } from "react";
import { AppShell } from "./app-shell";
import { games } from "@/lib/catalog";
import { usePlayer } from "@/hooks/use-player";

const categories = ["Featured", "New worlds", "Free spins", "Jackpots", "Bonus games"] as const;
const recentlyPlayed = games.slice(0, 4);

export function Lobby() {
  const { profile, error } = usePlayer();
  const [category, setCategory] = useState<(typeof categories)[number]>("Featured");
  const level = profile?.progression.level ?? 1;
  const visibleGames = games.filter((game) => {
    if (category === "Featured") return true;
    if (category === "New worlds") return game.isNew;
    if (category === "Free spins") return game.features.toLowerCase().includes("free spin");
    if (category === "Bonus games") return game.category === "Bonus games" || game.features.toLowerCase().includes("bonus");
    return game.id === "vegas-gold" || game.id === "pharaoh-oasis";
  });

  return <AppShell profile={profile}>
    {error && <div className="service-alert" role="status">{error} Playing will reconnect automatically.</div>}

    <section className="jackpot-ticker casino-ticker" aria-label="Live jackpot">
      <span><Sparkle weight="fill" /> Prize pool</span>
      <strong>997,089,018,605</strong>
      <span className="ticker-status"><i /> awards in 9d 16h</span>
    </section>

    <section className="casino-lobby-stage" aria-label="Featured worlds">
      <article className="live-events-panel">
        <div className="marquee-title">
          <span>Live</span>
          <strong>Events</strong>
          <i>17</i>
        </div>
        <div className="golden-promo-card">
          <Image src="/assets/slots/vegas_gold.png" alt="Golden slot promo with coins and bright stadium lights" fill priority sizes="(max-width: 760px) 94vw, 26vw" quality={88} />
          <div className="promo-shine" />
          <div className="promo-copy"><small>Oinky-style event</small><h1>Golden Day</h1><p>Collect coin symbols, unlock boosted free spins and climb the daily board.</p></div>
        </div>
        <div className="carousel-dots" aria-hidden="true"><i /><i /><i className="active" /><i /><i /></div>
      </article>

      <div className="center-promo-stack">
        <article className="quest-king-panel">
          <Image src="/assets/slots/neon_nights.png" alt="Neon space casino slot cover" fill sizes="(max-width: 760px) 94vw, 34vw" quality={88} />
          <div className="panel-vignette" />
          <span className="pool-chip">Prize pool · 9d 16h</span>
          <h2><small>Quest King</small>Galaxy Star</h2>
          <Link href="/slots/pharaoh-oasis"><Play weight="fill" /> Play now</Link>
        </article>
        <article className="quest-king-panel compact">
          <Image src="/assets/slots/candy_carnival.png" alt="Colorful bonus slot cover" fill sizes="(max-width: 760px) 94vw, 34vw" quality={84} />
          <div className="panel-vignette" />
          <span className="pool-chip new">New slot</span>
          <h2><small>Bonus rush</small>Top Treats</h2>
          <button aria-label="Open Top Treats"><RocketLaunch weight="fill" /> Hot</button>
        </article>
      </div>

      <aside className="recently-played-panel" aria-label="Recently played games">
        <div className="miner-card">
          <Image src="/assets/slots/verdant_afterfall.png" alt="Smiling explorer character style slot world" fill sizes="(max-width: 760px) 94vw, 24vw" quality={82} />
          <div className="miner-card-copy"><span>Kürzlich</span><strong>Gespielt</strong></div>
        </div>
        <div className="recent-slot-list">
          {recentlyPlayed.map((game, index) => <Link href={game.id === "pharaoh-oasis" ? `/slots/${game.id}` : "#coming-soon"} key={game.id} className={index > 1 ? "locked-mini" : ""}>
            <span className="jackpot-number">{index === 0 ? "482,907,367K" : index === 1 ? "188,265,574K" : "923,522,018K"}</span>
            <Image src={game.cover} alt={`${game.name} recently played cover`} width={156} height={92} quality={76} />
            {index > 1 && <i><LockKey weight="fill" /></i>}
          </Link>)}
        </div>
      </aside>
    </section>

    <section className="activity-dock casino-activity-dock" aria-label="Daily activities">
      <button><span className="activity-icon gold"><Gift weight="fill" /></span><span><small>Ready now</small><strong>Daily vault</strong></span><i>Claim</i></button>
      <button id="missions"><span className="activity-icon coral"><Target weight="fill" /></span><span><small>2 of 5 complete</small><strong>Daily missions</strong></span><b>+50K</b></button>
      <button id="events"><span className="activity-icon teal"><Trophy weight="fill" /></span><span><small>Top 20%</small><strong>Fireball league</strong></span><b>#124</b></button>
      <button id="rewards"><span className="activity-icon violet"><Star weight="fill" /></span><span><small>12 day streak</small><strong>VIP journey</strong></span><b>III</b></button>
    </section>

    <section className="catalog" aria-labelledby="games-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Fire weight="fill" /> 77 / 192 worlds</span><h2 id="games-title">Slot park</h2></div>
        <Link href="#all-games">All games <ArrowRight /></Link>
      </div>
      <div className="category-row" role="list" aria-label="Slot categories">
        {categories.map((item) => <button key={item} className={item === category ? "selected" : ""} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="game-grid" id="all-games">{visibleGames.map((game) => {
        const locked = level < game.unlockLevel;
        return <article className="game-card" key={game.id}>
          <div className="game-cover">
            <Image src={game.cover} alt={`${game.name} slot cover`} fill sizes="(max-width: 600px) 66vw, (max-width: 1100px) 33vw, 19vw" quality={78} />
            <div className="game-cover-vignette" />
            <div className="card-badges">{game.isNew && <span>New</span>}{game.highRoller && <span className="vip-badge"><Star weight="fill" /> VIP</span>}</div>
            {locked
              ? <div className="lock-state"><LockKey weight="fill" /><span>Level {game.unlockLevel}</span></div>
              : <Link className="cover-play" href={game.id === "pharaoh-oasis" ? `/slots/${game.id}` : "#coming-soon"} aria-label={`Play ${game.name}`}><Play weight="fill" /></Link>}
            <div className="game-title"><small>{game.category}</small><h3>{game.name}</h3><p>{game.features}</p></div>
          </div>
        </article>;
      })}</div>
    </section>
  </AppShell>;
}
