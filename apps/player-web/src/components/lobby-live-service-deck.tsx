"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRinging, CheckCircle, Fire, Gift, Lightning, Play, ShieldStar, Sparkle, Target, Timer, Trophy, UsersThree, X } from "@phosphor-icons/react";
import { games } from "@/lib/catalog";
import { coinNumber, describeMission } from "@/lib/format";
import { postClaim, useLobbyData } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";

const socialWins = [
  { player: "Luna88", game: "Neon Nights", win: 8_420_000 },
  { player: "GoldFuchs", game: "Vegas Gold", win: 3_180_000 },
  { player: "MikaSpin", game: "Dragon Peak", win: 1_960_000 },
];

function secondsUntil(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return days > 0 ? `${days}T ${h}:${m}:${s}` : `${h}:${m}:${s}`;
}

function readStreak() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(window.localStorage.getItem("aurora-login-streak") ?? "null") as { day?: string; count?: number } | null;
    if (stored?.day === today) return Math.min(7, Math.max(1, stored.count ?? 1));
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const next = stored?.day === yesterday ? Math.min(7, (stored.count ?? 0) + 1) : 1;
    window.localStorage.setItem("aurora-login-streak", JSON.stringify({ day: today, count: next }));
    return next;
  } catch {
    return 1;
  }
}

export function LobbyLiveServiceDeck() {
  const { profile, refresh: refreshProfile } = usePlayer();
  const { missions, events, jackpots, refresh: refreshLobby } = useLobbyData();
  const [activeWin, setActiveWin] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [streak, setStreak] = useState(1);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<"idle" | "success" | "error">("idle");

  const level = profile?.progression.level ?? 1;
  const tournament = profile?.tournament;
  const activeEvent = events[0];
  const primaryMission = missions.find((mission) => mission.cadence === "daily" && mission.unlocked && !mission.claimed) ?? missions.find((mission) => mission.unlocked);
  const missionProgress = primaryMission ? Math.min(100, Math.round((primaryMission.progress / Math.max(1, primaryMission.target)) * 100)) : 0;
  const missionClaimable = Boolean(primaryMission?.completed && !primaryMission.claimed && primaryMission.unlocked);
  const claimableAchievements = profile?.achievements?.filter((item) => item.completed && !item.claimed && item.unlocked) ?? [];
  const claimableMilestones = events.flatMap((event) => event.milestones.filter((item) => item.completed && !item.claimed));
  const inboxCount = Number(missionClaimable) + claimableAchievements.length + claimableMilestones.length;
  const grand = jackpots.find((jackpot) => jackpot.tier === "GRAND");

  const featured = useMemo(() => games.filter((game) => level >= game.unlockLevel).slice(0, 6), [level]);
  const jackpotGames = useMemo(() => games.filter((game) => game.highRoller && level >= game.unlockLevel).slice(0, 5), [level]);
  const freshGames = useMemo(() => games.filter((game) => game.isNew && level >= game.unlockLevel).slice(0, 5), [level]);

  useEffect(() => setStreak(readStreak()), []);
  useEffect(() => {
    setSeconds(secondsUntil(activeEvent?.endsAt ?? tournament?.endsAt));
    const timer = window.setInterval(() => setSeconds(secondsUntil(activeEvent?.endsAt ?? tournament?.endsAt)), 1000);
    const wins = window.setInterval(() => setActiveWin((value) => (value + 1) % socialWins.length), 4200);
    return () => { window.clearInterval(timer); window.clearInterval(wins); };
  }, [activeEvent?.endsAt, tournament?.endsAt]);

  async function claimMission() {
    if (!primaryMission || !missionClaimable || claiming) return;
    setClaiming(primaryMission.id);
    setClaimStatus("idle");
    const result = await postClaim(`/api/player/missions/${primaryMission.id}/claim`);
    setClaimStatus(result.ok ? "success" : "error");
    if (result.ok) await Promise.all([refreshProfile(), refreshLobby()]);
    setClaiming(null);
  }

  const win = socialWins[activeWin];
  const eventTitle = activeEvent?.title ?? tournament?.name ?? "Royal Rush";
  const eventSubtitle = activeEvent?.subtitle ?? tournament?.subtitle ?? "Sammle Punkte, steige in der Liga auf und sichere dir den Grand Prize.";
  const rank = tournament?.rank;

  return <section className="lsd" aria-label="Live-Service-Zentrale">
    <div className="lsd__pulse" aria-hidden="true" />
    <header className="lsd__header">
      <div><span className="lsd__eyebrow"><Sparkle weight="fill" /> Deine Casino-Zentrale</span><h2>Heute wartet mehr auf dich</h2><p>Belohnungen, Wettbewerbe und neue Welten – live mit deinem Fortschritt.</p></div>
      <button className="lsd__inbox" type="button" aria-label="Nachrichten öffnen" aria-expanded={inboxOpen} onClick={() => setInboxOpen(true)}><BellRinging weight="fill" />{inboxCount > 0 && <span>{inboxCount}</span>}</button>
    </header>

    {inboxOpen && <div className="lsd__inbox-popover" role="dialog" aria-modal="true" aria-label="Belohnungs-Inbox">
      <button className="lsd__inbox-close" onClick={() => setInboxOpen(false)} aria-label="Inbox schließen"><X /></button>
      <span className="lsd__eyebrow"><BellRinging weight="fill" /> Deine Inbox</span><h3>{inboxCount > 0 ? `${inboxCount} Belohnungen warten` : "Alles erledigt"}</h3>
      <div className="lsd__inbox-list">
        {missionClaimable && <a href="#missions" onClick={() => setInboxOpen(false)}><Target weight="fill" /><span><strong>Tagesmission abgeschlossen</strong><small>+{coinNumber(primaryMission?.rewardCoins ?? 0)} Coins abholen</small></span><ArrowRight /></a>}
        {claimableAchievements.length > 0 && <a href="#rewards" onClick={() => setInboxOpen(false)}><Trophy weight="fill" /><span><strong>{claimableAchievements.length} Erfolge abgeschlossen</strong><small>Rewards sind bereit</small></span><ArrowRight /></a>}
        {claimableMilestones.length > 0 && <a href="#events" onClick={() => setInboxOpen(false)}><Sparkle weight="fill" /><span><strong>{claimableMilestones.length} Event-Meilensteine</strong><small>Event-Belohnungen abholen</small></span><ArrowRight /></a>}
        {inboxCount === 0 && <div className="lsd__inbox-empty"><CheckCircle weight="fill" /><span>Du hast alle aktuellen Belohnungen eingesammelt.</span></div>}
      </div>
    </div>}

    <div className="lsd__status-grid">
      <article className="lsd__streak lsd__panel"><div className="lsd__panel-head"><span><Fire weight="fill" /> Daily Streak</span><strong>Tag {streak}</strong></div><div className="lsd__days" aria-label="Tägliche Login-Serie">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={day < streak ? "done" : day === streak ? "current" : ""}>{day < streak ? "✓" : day}</span>)}</div><div className="lsd__reward-row"><Gift weight="fill" /><div><small>Aktiver Login-Bonus</small><strong>{streak === 7 ? "Wochenbonus erreicht" : `Noch ${7 - streak} Tag${7 - streak === 1 ? "" : "e"} bis zum Wochenbonus`}</strong></div><a href="#shop">Öffnen</a></div></article>

      <article className="lsd__quest lsd__panel"><div className="lsd__panel-head"><span><Target weight="fill" /> Tagesquest</span><strong>{missionProgress} %</strong></div><h3>{primaryMission ? describeMission(primaryMission.metric, primaryMission.target) : "Missionen werden geladen …"}</h3><div className="lsd__progress"><i style={{ width: `${missionProgress}%` }} /></div><footer><span>{primaryMission ? `${coinNumber(Math.min(primaryMission.progress, primaryMission.target))} / ${coinNumber(primaryMission.target)}` : "—"}</span>{missionClaimable ? <button onClick={() => void claimMission()} disabled={claiming !== null}>{claiming ? "…" : "Abholen"}</button> : <b>+{coinNumber(primaryMission?.rewardCoins ?? 0)}</b>}</footer>{claimStatus !== "idle" && <small className={`lsd__claim-status ${claimStatus}`}>{claimStatus === "success" ? "Belohnung gutgeschrieben" : "Claim nicht möglich"}</small>}</article>

      <article className="lsd__event lsd__panel"><div className="lsd__event-glow" aria-hidden="true" /><span className="lsd__event-label"><Timer weight="fill" /> {seconds > 0 ? `Endet in ${formatCountdown(seconds)}` : "Live"}</span><h3>{eventTitle}</h3><p>{eventSubtitle}</p><div className="lsd__event-rank"><Trophy weight="fill" /><span>{rank ? "Aktueller Rang" : "Event-Fortschritt"}</span><strong>{rank ? `#${rank}` : `${activeEvent?.progress ?? 0}`}</strong></div><Link href="/#events">Event öffnen <ArrowRight /></Link></article>

      <article className="lsd__social lsd__panel"><div className="lsd__panel-head"><span><UsersThree weight="fill" /> Live-Gewinne</span><i>LIVE</i></div><div className="lsd__win" key={activeWin}><span className="lsd__avatar">{win.player.slice(0,1)}</span><div><strong>{win.player}</strong><small>{win.game}</small></div><b>{coinNumber(win.win)}</b></div><a className="lsd__club" href="#clans"><ShieldStar weight="fill" /><span><small>Deine Liga</small><strong>{tournament ? `${tournament.name} · Platz ${tournament.rank}` : `VIP ${profile?.vip?.tier ?? "Starter"}`}</strong></span><ArrowRight /></a></article>
    </div>

    <div className="lsd__economy-strip"><span><Sparkle weight="fill" /> Grand Jackpot <strong>{grand ? coinNumber(grand.amount) : "Live"}</strong></span><span>Level <strong>{level}</strong></span><span>VIP <strong>{profile?.vip?.tier ?? "Starter"}</strong></span><span>Coins <strong>{coinNumber(profile?.coinBalance ?? 0)}</strong></span></div>

    <GameRail title="Für dich" subtitle="Freigeschaltet für dein Level" icon={<Lightning weight="fill" />} games={featured.length ? featured : games.slice(0,6)} />
    <GameRail title="Jackpot-Welten" subtitle="Große Pools, starke Features" icon={<Trophy weight="fill" />} games={jackpotGames.length ? jackpotGames : featured.slice(0,5)} emphasis />
    <GameRail title="Neu im Casino" subtitle="Frische Welten und Mechaniken" icon={<Sparkle weight="fill" />} games={freshGames.length ? freshGames : featured.slice().reverse().slice(0,5)} />
  </section>;
}

function GameRail({ title, subtitle, icon, games: railGames, emphasis = false }: { title: string; subtitle: string; icon: React.ReactNode; games: typeof games; emphasis?: boolean }) {
  return <section className={`lsd__rail ${emphasis ? "lsd__rail--jackpot" : ""}`}><div className="lsd__rail-head"><div><span>{icon}{subtitle}</span><h3>{title}</h3></div><Link href="/#all-games">Alle ansehen <ArrowRight /></Link></div><div className="lsd__rail-track">{railGames.map((game,index) => <article className="lsd__tile" key={`${title}-${game.id}`}><Link href={`/slots/${game.id}`} aria-label={`${game.name} spielen`}><Image src={game.cover} alt={`${game.name} Cover`} fill sizes="(max-width: 700px) 54vw, 240px" quality={86} /><div className="lsd__tile-shade" /><span className="lsd__tile-rank">{String(index+1).padStart(2,"0")}</span>{game.isNew && <span className="lsd__tile-badge">NEU</span>}{game.highRoller && <span className="lsd__tile-badge lsd__tile-badge--vip">VIP</span>}<div className="lsd__tile-copy"><small>{game.category}</small><strong>{game.name}</strong><span>{game.features}</span></div><i className="lsd__tile-play"><Play weight="fill" /></i></Link></article>)}</div></section>;
}
