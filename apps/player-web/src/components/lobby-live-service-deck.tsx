"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRinging, Fire, Gift, Lightning, Play, ShieldStar, Sparkle, Target, Timer, Trophy, UsersThree } from "@phosphor-icons/react";
import { games } from "@/lib/catalog";

const socialWins = [
  { player: "Luna88", game: "Neon Nights", win: "8.420.000" },
  { player: "GoldFuchs", game: "Vegas Gold", win: "3.180.000" },
  { player: "MikaSpin", game: "Dragon Peak", win: "1.960.000" },
];

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function LobbyLiveServiceDeck() {
  const [seconds, setSeconds] = useState(7 * 3600 + 42 * 60 + 18);
  const [activeWin, setActiveWin] = useState(0);
  const featured = useMemo(() => games.slice(0, 6), []);
  const jackpotGames = useMemo(() => games.filter((game) => game.highRoller).slice(0, 5), []);
  const freshGames = useMemo(() => games.filter((game) => game.isNew).slice(0, 5), []);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => (value <= 0 ? 8 * 3600 : value - 1)), 1000);
    const wins = window.setInterval(() => setActiveWin((value) => (value + 1) % socialWins.length), 4200);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(wins);
    };
  }, []);

  const win = socialWins[activeWin];

  return <section className="lsd" aria-label="Live-Service-Zentrale">
    <div className="lsd__pulse" aria-hidden="true" />

    <header className="lsd__header">
      <div>
        <span className="lsd__eyebrow"><Sparkle weight="fill" /> Deine Casino-Zentrale</span>
        <h2>Heute wartet mehr auf dich</h2>
        <p>Belohnungen, Wettbewerbe und neue Welten – alles auf einen Blick.</p>
      </div>
      <button className="lsd__inbox" type="button" aria-label="Nachrichten öffnen">
        <BellRinging weight="fill" /><span>3</span>
      </button>
    </header>

    <div className="lsd__status-grid">
      <article className="lsd__streak lsd__panel">
        <div className="lsd__panel-head"><span><Fire weight="fill" /> Daily Streak</span><strong>Tag 5</strong></div>
        <div className="lsd__days" aria-label="Tägliche Login-Serie">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => <span key={day} className={day < 5 ? "done" : day === 5 ? "current" : ""}>{day < 5 ? "✓" : day}</span>)}
        </div>
        <div className="lsd__reward-row"><Gift weight="fill" /><div><small>Nächste Belohnung</small><strong>250.000 Coins + Booster</strong></div><button type="button">Abholen</button></div>
      </article>

      <article className="lsd__quest lsd__panel">
        <div className="lsd__panel-head"><span><Target weight="fill" /> Tagesquest</span><strong>72 %</strong></div>
        <h3>Gewinne 12 Spins in Bonusspielen</h3>
        <div className="lsd__progress"><i style={{ width: "72%" }} /></div>
        <footer><span>9 / 12</span><b>+400.000</b></footer>
      </article>

      <article className="lsd__event lsd__panel">
        <div className="lsd__event-glow" aria-hidden="true" />
        <span className="lsd__event-label"><Timer weight="fill" /> Endet in {formatCountdown(seconds)}</span>
        <h3>Royal Rush</h3>
        <p>Sammle Kronen, steige in der Liga auf und sichere dir den Grand Prize.</p>
        <div className="lsd__event-rank"><Trophy weight="fill" /><span>Aktueller Rang</span><strong>#18</strong></div>
        <Link href="/#events">Event öffnen <ArrowRight /></Link>
      </article>

      <article className="lsd__social lsd__panel">
        <div className="lsd__panel-head"><span><UsersThree weight="fill" /> Live-Gewinne</span><i>LIVE</i></div>
        <div className="lsd__win" key={activeWin}>
          <span className="lsd__avatar">{win.player.slice(0, 1)}</span>
          <div><strong>{win.player}</strong><small>{win.game}</small></div>
          <b>{win.win}</b>
        </div>
        <div className="lsd__club"><ShieldStar weight="fill" /><span><small>Dein Club</small><strong>Aurora Elite · Platz 12</strong></span><ArrowRight /></div>
      </article>
    </div>

    <GameRail title="Für dich" subtitle="Auf Basis deiner letzten Spiele" icon={<Lightning weight="fill" />} games={featured} />
    <GameRail title="Jackpot-Welten" subtitle="Große Pools, starke Features" icon={<Trophy weight="fill" />} games={jackpotGames.length ? jackpotGames : featured.slice(0, 5)} emphasis />
    <GameRail title="Neu im Casino" subtitle="Frische Welten und Mechaniken" icon={<Sparkle weight="fill" />} games={freshGames.length ? freshGames : featured.slice().reverse().slice(0, 5)} />
  </section>;
}

function GameRail({ title, subtitle, icon, games: railGames, emphasis = false }: { title: string; subtitle: string; icon: React.ReactNode; games: typeof games; emphasis?: boolean }) {
  return <section className={`lsd__rail ${emphasis ? "lsd__rail--jackpot" : ""}`}>
    <div className="lsd__rail-head"><div><span>{icon}{subtitle}</span><h3>{title}</h3></div><Link href="/#all-games">Alle ansehen <ArrowRight /></Link></div>
    <div className="lsd__rail-track">
      {railGames.map((game, index) => <article className="lsd__tile" key={`${title}-${game.id}`}>
        <Link href={`/slots/${game.id}`} aria-label={`${game.name} spielen`}>
          <Image src={game.cover} alt={`${game.name} Cover`} fill sizes="(max-width: 700px) 54vw, 240px" quality={86} />
          <div className="lsd__tile-shade" />
          <span className="lsd__tile-rank">{String(index + 1).padStart(2, "0")}</span>
          {game.isNew && <span className="lsd__tile-badge">NEU</span>}
          {game.highRoller && <span className="lsd__tile-badge lsd__tile-badge--vip">VIP</span>}
          <div className="lsd__tile-copy"><small>{game.category}</small><strong>{game.name}</strong><span>{game.features}</span></div>
          <i className="lsd__tile-play"><Play weight="fill" /></i>
        </Link>
      </article>)}
    </div>
  </section>;
}
