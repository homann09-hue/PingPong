"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";
import { useState } from "react";
import { AppShell } from "./app-shell";
import { games } from "@/lib/catalog";
import { coinNumber, describeMission, missionTierLabel, timeLeft } from "@/lib/format";
import { ShopSection } from "@/components/shop-section";
import { ClanSection } from "@/components/clan-section";
import { LuckyWheel } from "@/components/lucky-wheel";
import { BoostCenter } from "@/components/boost-center";
import { useSlotAvailability } from "@/hooks/use-slot-availability";
import { useLobbyData, postClaim } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";

const categories = ["Alle", "Neu", "Freispiele", "Bonus", "VIP"] as const;
const reelSymbols = ["A", "K", "♛", "K", "10", "♞", "10", "♚", "J", "K", "Q", "J", "♦", "J", "K"];
const dailyRewards = ["1M", "2M", "3M", "5M", "10M", "15M", "20M"];
const socialPlayers = [
  { name: "Emma", state: "Online" },
  { name: "JackpotKing", state: "Online" },
  { name: "Lucky777", state: "Im Spiel" },
  { name: "SlotQueen", state: "Offline" },
  { name: "KingOfSlots", state: "Offline" },
] as const;

function claimErrorText(code?: string): string {
  if (code === "ALREADY_CLAIMED" || code === "REWARD_ALREADY_CLAIMED") return "Diese Belohnung wurde bereits abgeholt.";
  if (code === "REWARD_NOT_AVAILABLE" || code === "NOT_AVAILABLE" || code === "OBJECTIVE_NOT_MET") return "Noch nicht verfügbar – schau später wieder vorbei.";
  return "Die Belohnung konnte nicht abgeholt werden. Versuch es später erneut.";
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Lobby() {
  const { profile, error, refresh } = usePlayer();
  const { missions, events, jackpots, refresh: refreshLobby } = useLobbyData();
  const slotAvailability = useSlotAvailability();
  const [category, setCategory] = useState<(typeof categories)[number]>("Alle");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const level = profile?.progression.level ?? 1;
  const tournament = profile?.tournament;
  const achievements = profile?.achievements ?? [];
  const claimableAchievements = achievements.filter((entry) => entry.completed && !entry.claimed && entry.unlocked);
  const featuredGames = games.slice(0, 6);
  const visibleGames = games.filter((game) => {
    if (category === "Neu") return game.isNew === true;
    if (category === "Freispiele") return game.features.toLowerCase().includes("free spin") || game.category === "Free spins";
    if (category === "Bonus") return game.category === "Bonus games" || game.features.toLowerCase().includes("bonus");
    if (category === "VIP") return game.highRoller === true;
    return true;
  });

  const jackpot = (tier: string, fallback: number) => jackpots.find((entry) => entry.tier === tier)?.amount ?? fallback;

  async function claim(kind: string, path: string) {
    if (busy) return;
    setBusy(kind);
    setNotice(null);
    const result = await postClaim(path);
    if (result.ok) {
      setNotice({ tone: "good", text: "Belohnung gutgeschrieben!" });
      await Promise.all([refresh(), refreshLobby()]);
    } else {
      setNotice({ tone: "bad", text: claimErrorText(result.code) });
    }
    setBusy(null);
  }

  return <AppShell profile={profile}>
    {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => { void refresh(); void refreshLobby(); }}>Erneut versuchen</button></div>}
    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}

    <section className="fl-reference-stage" aria-label="Fortune Legends Lobby">
      <aside className="fl-brand-panel">
        <div className="fl-crown-logo"><Crown weight="fill" /><span>FORTUNE</span><strong>LEGENDS</strong><small>SOCIAL CASINO</small></div>
        <p>THE ULTIMATE<br />SOCIAL CASINO EXPERIENCE</p>
        <ul>
          <li><Crown weight="fill" /><span><strong>REAL SLOTS</strong><small>Exciting casino games</small></span></li>
          <li><Gift weight="fill" /><span><strong>DAILY REWARDS</strong><small>Collect free coins & bonuses</small></span></li>
          <li><UsersThree weight="fill" /><span><strong>SOCIAL FEATURES</strong><small>Play with friends & compete</small></span></li>
          <li><Star weight="fill" /><span><strong>VIP CLUB</strong><small>Unlock exclusive rewards</small></span></li>
          <li><Trophy weight="fill" /><span><strong>TOURNAMENTS</strong><small>Compete & win big</small></span></li>
          <li><CheckCircle weight="fill" /><span><strong>SAFE & FAIR</strong><small>100% play-money entertainment</small></span></li>
        </ul>
      </aside>

      <article className="fl-machine-card">
        <div className="fl-jackpot-grid">
          <span className="grand"><small>GRAND</small><strong>{coinNumber(jackpot("GRAND", 125_000_000))}</strong></span>
          <span className="major"><small>MAJOR</small><strong>{coinNumber(jackpot("MAJOR", 25_000_000))}</strong></span>
          <span className="minor"><small>MINOR</small><strong>{coinNumber(jackpot("MINOR", 5_000_000))}</strong></span>
          <span className="mini"><small>MINI</small><strong>{coinNumber(jackpot("MINI", 2_000_000))}</strong></span>
        </div>
        <div className="fl-machine-title"><Crown weight="fill" /><span>LEGEND</span><strong>OF GOLD</strong></div>
        <div className="fl-reel-window">{reelSymbols.map((symbol, index) => <span key={`${symbol}-${index}`} className={symbol === "♛" || symbol === "♚" || symbol === "♞" || symbol === "♦" ? "special" : ""}>{symbol}</span>)}</div>
        <div className="fl-win-readout"><span><small>TOTAL BET</small><strong>500,000</strong></span><span><small>WIN</small><strong>2,450,000</strong></span><button>MAX BET</button></div>
        <Link className="fl-spin-cta" href={`/slots/${games[0]?.id ?? "pharaoh-oasis"}`}><Play weight="fill" /><span>SPIN</span><small>HOLD FOR AUTO</small></Link>
      </article>

      <article className="fl-featured-panel">
        <header><div><small>LOBBY</small><h1>Featured Games</h1></div><button onClick={() => scrollToSection("all-games")}>SEE ALL <ArrowRight /></button></header>
        <button className="fl-inline-search" onClick={() => scrollToSection("all-games")}><span>Search games...</span><Sparkle /></button>
        <div className="fl-featured-grid">{featuredGames.map((game, index) => <Link href={`/slots/${game.id}`} key={game.id}>
          <div><Image src={game.cover} alt={`${game.name} Cover`} fill sizes="160px" quality={82} /><i>{index < 2 ? "NEW" : index === 4 ? "HOT" : ""}</i></div>
          <strong>{game.name}</strong>
        </Link>)}</div>
        <div className="fl-jackpot-banner"><Crown weight="fill" /><span><small>GRAND JACKPOT</small><strong>{coinNumber(jackpot("GRAND", 125_000_000))}</strong></span></div>
      </article>
    </section>

    <section className="fl-dashboard-grid">
      <div className="fl-stack-column">
        <article className="fl-panel fl-daily-panel" id="daily-rewards">
          <header><span><Gift weight="fill" /> DAILY REWARDS</span><small>Come back every day and win!</small></header>
          <div className="fl-days">{dailyRewards.map((reward, index) => <div key={reward} className={index === 0 ? "active" : index === dailyRewards.length - 1 ? "final" : ""}><small>DAY {index + 1}</small><Coins weight="fill" /><strong>{reward}</strong>{index === 0 && <i>COLLECT</i>}</div>)}</div>
          <button className="fl-gold-button" onClick={() => scrollToSection("shop")}>COLLECT</button>
        </article>

        <article className="fl-panel fl-missions-panel" id="missions">
          <header><span><Target weight="fill" /> MISSIONS</span><small>Daily objectives</small></header>
          <div className="fl-mission-rows">
            {missions.slice(0, 4).map((mission) => {
              const progress = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
              const claimable = mission.completed && !mission.claimed && mission.unlocked;
              return <div key={mission.id} className={!mission.unlocked ? "locked" : mission.claimed ? "claimed" : ""}>
                <Target weight="fill" />
                <span><strong>{describeMission(mission.metric, mission.target)}</strong><i><b style={{ width: `${progress}%` }} /></i><small>{coinNumber(Math.min(mission.progress, mission.target))}/{coinNumber(mission.target)}</small></span>
                <em><Coins weight="fill" /> {coinNumber(mission.rewardCoins)}</em>
                {claimable && <button disabled={busy !== null} onClick={() => void claim(mission.id, `/api/player/missions/${mission.id}/claim`)}>{busy === mission.id ? "…" : "CLAIM"}</button>}
              </div>;
            })}
            {missions.length === 0 && <p>Missionen werden geladen …</p>}
          </div>
          <button className="fl-dark-button" onClick={() => scrollToSection("mission-details")}>VIEW ALL MISSIONS</button>
        </article>
      </div>

      <article className="fl-panel fl-tournament-panel" id="events">
        <header><span><Trophy weight="fill" /> TOURNAMENTS</span><small>{tournament ? timeLeft(tournament.endsAt) : "Live"}</small></header>
        <div className="fl-trophy-mark"><Trophy weight="fill" /></div>
        <div className="fl-tournament-tabs"><span>TOP WIN</span><span>BIGGEST BET</span><span>MOST SPINS</span></div>
        <ol>
          {(tournament?.leaders ?? [
            { name: "JackpotKing", score: 125_000_000 },
            { name: "Lucky777", score: 98_500_000 },
            { name: "SlotMaster", score: 76_250_000 },
            { name: "QueenBee", score: 55_000_000 },
          ]).slice(0, 4).map((leader, index) => <li key={leader.name}><span>{index + 1}</span><Image src="/assets/ui/player-avatar.png" alt="" width={30} height={30} /><strong>{leader.name}</strong><b>{coinNumber(leader.score)}</b></li>)}
          <li className="self"><span>{tournament?.rank ?? 5}</span><Image src="/assets/ui/player-avatar.png" alt="" width={30} height={30} /><strong>PlayerOne</strong><b>{coinNumber(tournament?.score ?? 42_300_000)}</b></li>
        </ol>
        <footer><span>YOUR RANK <strong>{tournament?.rank ?? 5}</strong></span><b>{coinNumber(tournament?.score ?? 42_300_000)}</b></footer>
        <Link className="fl-purple-button" href={`/slots/${games[0]?.id ?? "pharaoh-oasis"}`}>PLAY NOW</Link>
      </article>

      <article className="fl-panel fl-vip-panel" id="rewards">
        <header><span><Crown weight="fill" /> VIP CLUB</span><small>Premium rewards</small></header>
        <div className="fl-vip-emblem"><Crown weight="fill" /><span>VIP</span><strong>{profile?.vip?.tier ?? "5"}</strong></div>
        <div className="fl-vip-progress"><i><b style={{ width: `${Math.min(100, Math.round(((profile?.vip?.points ?? 25_680) / Math.max(1, profile?.vip?.nextTierPoints ?? 50_000)) * 100))}%` }} /></i><small>{coinNumber(profile?.vip?.points ?? 25_680)} / {coinNumber(profile?.vip?.nextTierPoints ?? 50_000)} XP</small></div>
        <h3>VIP {profile?.vip?.tier ?? "5"} BENEFITS</h3>
        <ul><li>10% more coins on purchases</li><li>Daily VIP bonus</li><li>Exclusive slot tournaments</li><li>Higher reward limits</li><li>Priority support</li></ul>
        <button className="fl-gold-button" onClick={() => scrollToSection("achievement-details")}>VIEW ALL VIP LEVELS</button>
      </article>

      <article className="fl-panel fl-social-panel" id="social">
        <header><span><UsersThree weight="fill" /> SOCIAL</span><small>Friends & competition</small></header>
        <div className="fl-social-tabs"><span className="active">FRIENDS</span><span>CHAT</span><span>LEADERBOARD</span></div>
        <ul>{socialPlayers.map((player, index) => <li key={player.name}><Image src="/assets/ui/player-avatar.png" alt="" width={40} height={40} /><span><strong>{player.name}</strong><small className={player.state === "Offline" ? "offline" : ""}>{player.state}</small></span><button>{index < 3 ? "CHALLENGE" : "INVITE"}</button></li>)}</ul>
        <button className="fl-gold-button">ADD FRIENDS</button>
      </article>
    </section>

    <section className="fl-feature-row" id="bonus-features">
      <article className="fl-panel"><header><span>AMAZING SLOT FEATURES</span></header><div className="fl-feature-icons">
        <div><Crown weight="fill" /><strong>WILD SYMBOLS</strong><small>Expand and substitute</small></div>
        <div><Gift weight="fill" /><strong>SCATTER SYMBOLS</strong><small>Trigger free spins</small></div>
        <div><Diamond weight="fill" /><strong>FREE SPINS</strong><small>Win more with bonus rounds</small></div>
        <div><Fire weight="fill" /><strong>MULTIPLIERS</strong><small>Increase your wins</small></div>
        <div><Coins weight="fill" /><strong>MEGA WIN</strong><small>Big wins, big excitement</small></div>
      </div></article>
      <article className="fl-panel"><header><span>BONUS FEATURES</span></header><div className="fl-feature-icons">
        <div><Gift weight="fill" /><strong>DAILY BONUS</strong><small>Free coins every day</small></div>
        <div><Sparkle weight="fill" /><strong>LUCKY WHEEL</strong><small>Spin and win</small></div>
        <div><Trophy weight="fill" /><strong>COIN SHOP</strong><small>Great deals & packs</small></div>
        <div><Crown weight="fill" /><strong>SPECIAL EVENTS</strong><small>Limited time only</small></div>
        <div><Gift weight="fill" /><strong>GIFT CENTER</strong><small>Free gifts & coins</small></div>
      </div></article>
    </section>

    <section className="fl-catalog" id="all-games" aria-labelledby="all-games-title">
      <div className="fl-section-heading"><div><small><Fire weight="fill" /> PREMIUM SLOT COLLECTION</small><h2 id="all-games-title">ALL GAMES</h2></div><span>{games.filter((game) => level >= game.unlockLevel).length}/{games.length} UNLOCKED</span></div>
      <div className="fl-category-row">{categories.map((item) => <button key={item} className={item === category ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="fl-game-grid">{visibleGames.map((game) => {
        const locked = level < game.unlockLevel;
        const availability = slotAvailability.get(game.id);
        const offline = availability !== undefined && availability.status !== "live";
        return <article key={game.id} className="fl-game-card">
          <div><Image src={game.cover} alt={`${game.name} Slot-Cover`} fill sizes="(max-width: 700px) 44vw, 220px" quality={84} />{game.isNew && <i>NEW</i>}{game.highRoller && <em>VIP</em>}
            {locked ? <span className="fl-game-lock"><LockKey weight="fill" /> LEVEL {game.unlockLevel}</span> : offline ? <span className="fl-game-lock"><Wrench weight="fill" /> OFFLINE</span> : <Link href={`/slots/${game.id}`}><Play weight="fill" /></Link>}
          </div><strong>{game.name}</strong><small>{game.category}</small>
        </article>;
      })}</div>
    </section>

    <section className="fl-details-grid" id="mission-details">
      <article className="fl-panel fl-detail-panel"><header><span><Target weight="fill" /> ALL MISSIONS</span><small>Resets at 00:00 UTC</small></header><div className="fl-detail-list">{missions.map((mission) => {
        const progress = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
        const claimable = mission.completed && !mission.claimed && mission.unlocked;
        return <div key={mission.id}><span><small>{missionTierLabel(mission.tier, mission.cadence)}</small><strong>{describeMission(mission.metric, mission.target)}</strong><i><b style={{ width: `${progress}%` }} /></i></span><em>{coinNumber(mission.rewardCoins)} COINS</em>{claimable && <button onClick={() => void claim(mission.id, `/api/player/missions/${mission.id}/claim`)}>CLAIM</button>}</div>;
      })}</div></article>

      <article className="fl-panel fl-detail-panel" id="achievement-details"><header><span><Star weight="fill" /> ACHIEVEMENTS</span><small>{claimableAchievements.length} ready</small></header><div className="fl-detail-list">{achievements.slice(0, 8).map((entry) => {
        const progress = Math.min(100, Math.round((entry.progress / Math.max(1, entry.target)) * 100));
        const claimable = entry.completed && !entry.claimed && entry.unlocked;
        return <div key={entry.id}><span><small>{entry.tier.toUpperCase()}</small><strong>{entry.name}</strong><i><b style={{ width: `${progress}%` }} /></i></span><em>{coinNumber(entry.coins)} COINS</em>{claimable && <button onClick={() => void claim(entry.id, `/api/player/rewards/${entry.rewardId}/claims`)}>CLAIM</button>}</div>;
      })}</div></article>
    </section>

    <section className="fl-live-events">
      {events.map((event) => <article className="fl-panel" key={event.id}><header><span><Trophy weight="fill" /> {event.title}</span><small>{timeLeft(event.endsAt) || "LIVE"}</small></header><p>{event.subtitle}</p><div>{event.milestones.map((milestone) => <span key={milestone.id} className={milestone.claimed ? "claimed" : milestone.completed ? "ready" : ""}><small>{coinNumber(milestone.target)}</small><strong>+{coinNumber(milestone.rewardCoins)}</strong>{milestone.completed && !milestone.claimed && <button onClick={() => void claim(milestone.id, `/api/player/events/${event.id}/milestones/${milestone.id}/claim`)}>CLAIM</button>}</span>)}</div></article>)}
    </section>

    <LuckyWheel onRewardGranted={refreshLobby} />
    <BoostCenter onWalletChanged={refreshLobby} />
    <ShopSection gems={profile?.gemBalance ?? 0} onWalletChanged={refreshLobby} />
    <div id="social-details"><ClanSection onChanged={refreshLobby} /></div>
  </AppShell>;
}
