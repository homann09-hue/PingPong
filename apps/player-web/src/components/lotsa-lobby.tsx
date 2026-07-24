"use client";

import Image from "next/image";
import Link from "next/link";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { games, type GameCard } from "@/lib/catalog";
import { coinNumber, timeLeft } from "@/lib/format";
import { useLobbyData } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";
import { useSlotAvailability } from "@/hooks/use-slot-availability";

const filters = ["Alle", "Neu", "Jackpot", "Freispiele", "Bonus", "VIP"] as const;
type Filter = (typeof filters)[number];

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

  useEffect(() => {
    const timer = window.setInterval(() => setBonusSeconds((value) => value > 0 ? value - 1 : 60 * 60), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const level = profile?.progression.level ?? 1;
  const grand = jackpots.find((entry) => entry.tier === "GRAND")?.amount ?? 125_000_000;
  const featured = games.filter((game) => game.featured).slice(0, 4);
  const newGames = games.filter((game) => game.isNew).slice(0, 5);
  const visible = useMemo(() => games.filter((game) => matchesFilter(game, filter)), [filter]);
  const completedMissions = missions.filter((mission) => mission.completed).length;
  const minutes = Math.floor(bonusSeconds / 60).toString().padStart(2, "0");
  const seconds = (bonusSeconds % 60).toString().padStart(2, "0");

  return <AppShell profile={profile}>
    {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => { void refresh(); void refreshLobby(); }}>Erneut versuchen</button></div>}

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
      <Link href="/boost"><Gift weight="fill" /> BONUS</Link>
    </section>
  </AppShell>;
}

function TargetBadge({ label, value }: Readonly<{ label: string; value: string }>) {
  return <span><Gift weight="fill" /><strong>{label}</strong><small>{value}</small></span>;
}
