"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { games, type GameCard } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import { useLobbyData } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";
import { useSlotAvailability } from "@/hooks/use-slot-availability";

const filters = ["Alle", "Neu", "Jackpot", "Freispiele", "Bonus", "VIP"] as const;
type Filter = (typeof filters)[number];

const coinParticles = Array.from({ length: 24 }, (_, index) => ({
  left: `${4 + ((index * 37) % 92)}%`,
  x: `${-80 + ((index * 67) % 160)}px`,
  delay: `${(index % 8) * -0.42}s`,
  time: `${2.8 + (index % 5) * 0.35}s`,
}));
const confettiParticles = Array.from({ length: 34 }, (_, index) => ({
  x: `${-210 + ((index * 83) % 420)}px`,
  y: `${-180 + ((index * 61) % 390)}px`,
  delay: `${(index % 9) * 0.045}s`,
  color: ["#ffd83e", "#ff3e8e", "#52e8ff", "#8cff3e", "#a95cff"][index % 5]!,
}));

function matchesFilter(game: GameCard, filter: Filter): boolean {
  const features = game.features.toLowerCase();
  if (filter === "Neu") return game.isNew === true;
  if (filter === "Jackpot") return features.includes("jackpot") || game.category.toLowerCase().includes("vegas");
  if (filter === "Freispiele") return features.includes("freispiel") || game.category.toLowerCase().includes("freispiel");
  if (filter === "Bonus") return features.includes("bonus") || game.bonusBuyMultiplier !== undefined;
  if (filter === "VIP") return game.highRoller === true;
  return true;
}

function ThemeCard({ game, level, status }: Readonly<{ game: GameCard; level: number; status?: { status: string; message?: string | null } }>) {
  const locked = level < game.unlockLevel;
  const offline = status !== undefined && status.status !== "live";
  const playable = !locked && !offline;
  const body = <>
    <div className="ls-theme-art">
      <Image src={game.cover} alt={`${game.name} Themen-Slot`} fill sizes="(max-width: 700px) 46vw, 220px" quality={88} />
      <div className="ls-theme-vignette" />
      <div className="ls-theme-badges">{game.isNew && <i>NEW</i>}{game.highRoller && <i className="vip"><Star weight="fill" /> VIP</i>}</div>
      <div className="ls-theme-action">
        {locked ? <span><LockKey weight="fill" /> LEVEL {game.unlockLevel}</span> : offline ? <span><Wrench weight="fill" /> {status?.status === "maintenance" ? "WARTUNG" : "PAUSE"}</span> : <b><Play weight="fill" /></b>}
      </div>
    </div>
    <div className="ls-theme-copy"><strong>{game.name}</strong><small>{game.category}</small></div>
  </>;
  return <article className={`ls-theme-card ${locked ? "locked" : ""} ${offline ? "offline" : ""}`} style={{ "--theme-primary": game.primary, "--theme-secondary": game.secondary } as React.CSSProperties}>
    {playable ? <Link href={`/slots/${game.id}`}>{body}</Link> : <div>{body}</div>}
  </article>;
}

export function LotsaLobby() {
  const { profile, error, refresh } = usePlayer();
  const { events, jackpots, missions, refresh: refreshLobby } = useLobbyData();
  const availability = useSlotAvailability();
  const [filter, setFilter] = useState<Filter>("Alle");
  const [bonusSeconds, setBonusSeconds] = useState(59 * 60 + 57);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setBonusSeconds((value) => value > 0 ? value - 1 : 60 * 60), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem("aurora-daily-reward-seen") === "1") return;
    const timer = window.setTimeout(() => setRewardOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const level = profile?.progression.level ?? 1;
  const grand = jackpots.find((entry) => entry.tier === "GRAND")?.amount ?? 125_000_000;
  const featured = games.filter((game) => game.featured).slice(0, 4);
  const newGames = games.filter((game) => game.isNew).slice(0, 5);
  const visible = useMemo(() => games.filter((game) => matchesFilter(game, filter)), [filter]);
  const completedMissions = missions.filter((mission) => mission.completed).length;
  const minutes = Math.floor(bonusSeconds / 60).toString().padStart(2, "0");
  const seconds = (bonusSeconds % 60).toString().padStart(2, "0");

  function closeReward() {
    window.sessionStorage.setItem("aurora-daily-reward-seen", "1");
    setRewardOpen(false);
  }

  function claimPreviewReward() {
    setRewardClaimed(true);
    window.setTimeout(closeReward, 1450);
  }

  return <AppShell profile={profile}>
    {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => { void refresh(); void refreshLobby(); }}>Erneut versuchen</button></div>}

    <nav className="ls-side-events" aria-label="Schnellzugriff">
      <Link href="/events" aria-label="Live Event"><Trophy weight="fill" /><i>{events.length || 1}</i></Link>
      <Link href="/missions" aria-label="Missionen"><Target weight="fill" />{missions.length > completedMissions && <i>{missions.length - completedMissions}</i>}</Link>
      <Link href="/inbox" aria-label="Inbox"><Bell weight="fill" /><i>3</i></Link>
    </nav>

    <section className="ls-event-carousel" aria-label="Aktuelle Events">
      <article className="ls-event-hero">
        <Image src={featured[0]?.cover ?? "/assets/slots/pharaoh_oasis.svg"} alt="" fill priority sizes="100vw" quality={85} />
        <div className="ls-event-shade" />
        <div className="ls-event-copy"><span><Fire weight="fill" /> LIVE EVENT</span><h1>{events[0]?.title ?? "Jackpot Adventure"}</h1><p>{events[0]?.subtitle ?? "Spiele besondere Themen-Slots und sammle Event-Belohnungen."}</p><Link href="/events">EVENT ÖFFNEN</Link></div>
        <aside><small>GRAND JACKPOT</small><strong>{coinNumber(grand)}</strong><Trophy weight="fill" /></aside>
      </article>
      <div className="ls-mini-promos">
        <Link href="/missions"><TargetBadge label="MISSION BLITZ" value={`${completedMissions}/${missions.length || 4}`} /></Link>
        <Link href="/boost"><TargetBadge label="BONUS WHEEL" value="READY" /></Link>
        <Link href="/club"><TargetBadge label="CLUB LEAGUE" value={`LVL ${level}`} /></Link>
      </div>
    </section>

    <section className="ls-slot-section">
      <header><div><small>PLAY NOW</small><h2>Featured Slots</h2></div><Link href="#all-slots">ALLE</Link></header>
      <div className="ls-featured-rail">{featured.map((game) => <ThemeCard key={game.id} game={game} level={level} status={availability.get(game.id)} />)}</div>
    </section>

    <section className="ls-slot-section">
      <header><div><small>FRESH THEMES</small><h2>New Slots</h2></div><span>{newGames.length} NEU</span></header>
      <div className="ls-new-rail">{newGames.map((game) => <ThemeCard key={game.id} game={game} level={level} status={availability.get(game.id)} />)}</div>
    </section>

    <section className="ls-slot-section" id="all-slots">
      <header><div><small>CHOOSE YOUR WORLD</small><h2>All Slots</h2></div><span>{games.filter((game) => level >= game.unlockLevel).length}/{games.length} OFFEN</span></header>
      <div className="ls-filter-bar">{filters.map((item) => <button key={item} className={item === filter ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="ls-theme-grid">{visible.map((game) => <ThemeCard key={game.id} game={game} level={level} status={availability.get(game.id)} />)}</div>
    </section>

    <section className="ls-lobby-bonus" aria-label="Lobby Bonus">
      <div><Lightning weight="fill" /><span><small>GET BOOSTED!</small><strong>LOBBY BONUS IN {minutes}:{seconds}</strong></span></div>
      <div className="ls-bonus-progress"><i style={{ width: `${Math.max(4, 100 - (bonusSeconds / 3600) * 100)}%` }} /></div>
      <button onClick={() => { setRewardClaimed(false); setRewardOpen(true); }}><Gift weight="fill" /> BONUS</button>
    </section>

    {rewardOpen && <div className="ls-reward-overlay" role="dialog" aria-modal="true" aria-label="Tägliche Belohnung">
      <div className="ls-reward-card">
        <button className="close" onClick={closeReward} aria-label="Schließen"><X weight="bold" /></button>
        <div className="ls-coin-rain" aria-hidden="true">{coinParticles.map((coin, index) => <i key={index} className="ls-coin" style={{ left: coin.left, "--coin-x": coin.x, "--coin-delay": coin.delay, "--coin-time": coin.time } as React.CSSProperties} />)}</div>
        {rewardClaimed && <div className="ls-confetti-burst" aria-hidden="true">{confettiParticles.map((piece, index) => <i key={index} className="ls-confetti" style={{ "--conf-x": piece.x, "--conf-y": piece.y, "--conf-delay": piece.delay, "--conf-color": piece.color } as React.CSSProperties} />)}</div>}
        <Gift size={70} weight="fill" />
        <p>{rewardClaimed ? "BELohnung eingesammelt!" : "TÄGLICHER BONUS"}</p>
        <h2>{rewardClaimed ? "GEWONNEN!" : "WELCOME BACK"}</h2>
        <div className="ls-reward-amount"><Coins weight="fill" /> {coinNumber(2_000_000)}</div>
        <p>Tag 7 wartet eine besondere Truhe auf dich.</p>
        <button onClick={claimPreviewReward} disabled={rewardClaimed}>{rewardClaimed ? "GUTGESCHRIEBEN" : "JETZT ABHOLEN"}</button>
      </div>
    </div>}
  </AppShell>;
}

function TargetBadge({ label, value }: Readonly<{ label: string; value: string }>) {
  return <span><Gift weight="fill" /><strong>{label}</strong><small>{value}</small></span>;
}
