"use client";

import Link from "next/link";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { BoostCenter } from "./boost-center";
import { ClanSection } from "./clan-section";
import { LuckyWheel } from "./lucky-wheel";
import { ShopSection } from "./shop-section";
import { coinNumber, describeMission, missionTierLabel, timeLeft } from "@/lib/format";
import { postClaim, useLobbyData } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";

function MenuHeader({ icon, eyebrow, title, subtitle }: Readonly<{ icon: React.ReactNode; eyebrow: string; title: string; subtitle: string }>) {
  return <header className="ls-screen-header"><div className="ls-screen-icon">{icon}</div><div><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div></header>;
}

export function MissionsScreen() {
  const { profile, refresh } = usePlayer();
  const { missions, refresh: refreshLobby } = useLobbyData();
  const [tab, setTab] = useState<"daily" | "all">("daily");
  const [busy, setBusy] = useState<string | null>(null);
  const visible = tab === "daily" ? missions.filter((mission) => mission.cadence === "daily") : missions;
  const completed = visible.filter((mission) => mission.completed).length;

  async function claim(id: string) {
    if (busy) return;
    setBusy(id);
    const result = await postClaim(`/api/player/missions/${id}/claim`);
    if (result.ok) await Promise.all([refresh(), refreshLobby()]);
    setBusy(null);
  }

  return <AppShell profile={profile}>
    <MenuHeader icon={<Target weight="fill" />} eyebrow="MISSION BLITZ" title="My Missions" subtitle="Erledige slot-spezifische Aufgaben und steig durch die täglichen Stufen." />
    <section className="ls-pass-card">
      <div><small>DAILY PASS</small><strong>{completed}/{visible.length || 4} COMPLETE</strong></div>
      <span><i style={{ width: `${visible.length ? Math.round((completed / visible.length) * 100) : 0}%` }} /></span>
      <b><Star weight="fill" /> {completed * 10} PASS STARS</b>
    </section>
    <div className="ls-screen-tabs"><button className={tab === "daily" ? "active" : ""} onClick={() => setTab("daily")}>DAILY</button><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>ALL MISSIONS</button></div>
    <section className="ls-mission-screen-list">
      {visible.map((mission) => {
        const progress = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
        const claimable = mission.completed && !mission.claimed && mission.unlocked;
        return <article key={mission.id} className={`${mission.claimed ? "claimed" : ""} ${!mission.unlocked ? "locked" : ""}`}>
          <div className="ls-mission-medal">{mission.unlocked ? <Target weight="fill" /> : <LockKey weight="fill" />}</div>
          <div className="ls-mission-body"><small>{missionTierLabel(mission.tier, mission.cadence)}</small><strong>{describeMission(mission.metric, mission.target)}</strong><span><i style={{ width: `${progress}%` }} /></span><em>{coinNumber(Math.min(mission.progress, mission.target))} / {coinNumber(mission.target)}</em></div>
          <div className="ls-mission-prize"><Coins weight="fill" /><strong>{coinNumber(mission.rewardCoins)}</strong>{mission.claimed ? <b><CheckCircle weight="fill" /> DONE</b> : claimable ? <button disabled={busy !== null} onClick={() => void claim(mission.id)}>{busy === mission.id ? "…" : "CLAIM"}</button> : null}</div>
        </article>;
      })}
      {visible.length === 0 && <p className="section-empty">Missionen werden geladen …</p>}
    </section>
  </AppShell>;
}

export function EventsScreen() {
  const { profile, refresh } = usePlayer();
  const { events, refresh: refreshLobby } = useLobbyData();
  const [busy, setBusy] = useState<string | null>(null);
  const tournament = profile?.tournament;

  async function claim(eventId: string, milestoneId: string) {
    if (busy) return;
    setBusy(milestoneId);
    const result = await postClaim(`/api/player/events/${eventId}/milestones/${milestoneId}/claim`);
    if (result.ok) await Promise.all([refresh(), refreshLobby()]);
    setBusy(null);
  }

  return <AppShell profile={profile}>
    <MenuHeader icon={<CalendarDots weight="fill" />} eyebrow="LIMITED TIME" title="Events" subtitle="Neue Themen, Wettbewerbe und zeitlich begrenzte Belohnungspfade." />
    {tournament && <section className="ls-tournament-screen">
      <header><div><small>WORLD SLOTS LEAGUE</small><h2>{tournament.name}</h2><p>{tournament.subtitle ?? "Jeder Spin bringt Ranglistenpunkte."}</p></div><span><Trophy weight="fill" /><strong>#{tournament.rank}</strong><small>{timeLeft(tournament.endsAt) || "LIVE"}</small></span></header>
      <ol>{tournament.leaders.map((leader, index) => <li key={leader.name}><b>{index + 1}</b><strong>{leader.name}</strong><span>{coinNumber(leader.score)}</span></li>)}<li className="self"><b>{tournament.rank}</b><strong>PlayerOne</strong><span>{coinNumber(tournament.score)}</span></li></ol>
      <Link href="/">PLAY SLOTS</Link>
    </section>}
    <section className="ls-event-screen-grid">
      {events.map((event) => <article key={event.id}>
        <header><div><small>LIVE EVENT</small><h2>{event.title}</h2><p>{event.subtitle}</p></div><b>{timeLeft(event.endsAt) || "LIVE"}</b></header>
        <div className="ls-event-milestones">{event.milestones.map((milestone) => {
          const claimable = milestone.completed && !milestone.claimed;
          return <span key={milestone.id} className={milestone.claimed ? "claimed" : claimable ? "ready" : ""}><Trophy weight="fill" /><small>{coinNumber(milestone.target)}</small><strong>+{coinNumber(milestone.rewardCoins)}</strong>{milestone.claimed ? <CheckCircle weight="fill" /> : claimable ? <button disabled={busy !== null} onClick={() => void claim(event.id, milestone.id)}>{busy === milestone.id ? "…" : "CLAIM"}</button> : null}</span>;
        })}</div>
      </article>)}
      {events.length === 0 && <p className="section-empty">Events werden geladen …</p>}
    </section>
  </AppShell>;
}

export function ClubScreen() {
  const { profile, refresh } = usePlayer();
  const achievements = profile?.achievements ?? [];
  const completed = achievements.filter((entry) => entry.completed).length;
  const vipProgress = profile?.vip ? Math.min(100, Math.round((profile.vip.points / Math.max(1, profile.vip.nextTierPoints)) * 100)) : 0;
  return <AppShell profile={profile}>
    <MenuHeader icon={<UsersThree weight="fill" />} eyebrow="SOCIAL PROGRESSION" title="Club & VIP" subtitle="Gemeinsamer Fortschritt, exklusive Vorteile und deine VIP-Reise." />
    <section className="ls-vip-screen-card"><Crown weight="fill" /><div><small>CURRENT VIP</small><h2>{profile?.vip?.tier ?? "Bronze"}</h2><span><i style={{ width: `${vipProgress}%` }} /></span><p>{coinNumber(profile?.vip?.points ?? 0)} / {coinNumber(profile?.vip?.nextTierPoints ?? 50_000)} VIP XP</p></div><b>{completed} TROPHIES</b></section>
    <section className="ls-benefit-grid"><article><Star weight="fill" /><strong>VIP Bonus</strong><small>Mehr Coins und exklusive Belohnungen.</small></article><article><Trophy weight="fill" /><strong>Club League</strong><small>Steig gemeinsam durch die Club-Ligen.</small></article><article><Gift weight="fill" /><strong>Club Gifts</strong><small>Geschenke und Team-Meilensteine.</small></article></section>
    <ClanSection onChanged={refresh} />
  </AppShell>;
}

export function BoostScreen() {
  const { profile, refresh } = usePlayer();
  return <AppShell profile={profile}>
    <MenuHeader icon={<Lightning weight="fill" />} eyebrow="POWER UPS" title="Boost Center" subtitle="Aktiviere Booster, drehe das Bonusrad und verstärke deine nächsten Spins." />
    <section className="ls-two-column-systems"><LuckyWheel onRewardGranted={refresh} /><BoostCenter onWalletChanged={refresh} /></section>
  </AppShell>;
}

export function ShopScreen() {
  const { profile, refresh } = usePlayer();
  return <AppShell profile={profile}>
    <MenuHeader icon={<Coins weight="fill" />} eyebrow="COIN STORE" title="Shop" subtitle="Virtuelle Coins, Gems und zeitlich begrenzte Spielgeld-Angebote." />
    <ShopSection gems={profile?.gemBalance ?? 0} onWalletChanged={refresh} />
  </AppShell>;
}

export function InboxScreen() {
  const { profile } = usePlayer();
  const { events, missions } = useLobbyData();
  const messages = useMemo(() => {
    const claimable = missions.filter((mission) => mission.completed && !mission.claimed).length;
    return [
      { id: "welcome", title: "Welcome Gift", body: "Dein tägliches Geschenk und neue Slot-Welten warten auf dich.", action: "/boost", badge: "GIFT" },
      { id: "missions", title: "Mission Blitz", body: claimable > 0 ? `${claimable} Missionsbelohnungen sind bereit.` : "Neue tägliche Missionen sind aktiv.", action: "/missions", badge: "MISSION" },
      { id: "events", title: events[0]?.title ?? "Live Event", body: events[0]?.subtitle ?? "Spiele im aktuellen Event und sammle Meilensteine.", action: "/events", badge: "LIVE" },
      { id: "club", title: "Club Activity", body: "Prüfe Club-Nachrichten, Einladungen und Teamfortschritt.", action: "/club", badge: "SOCIAL" },
    ];
  }, [events, missions]);
  return <AppShell profile={profile}>
    <MenuHeader icon={<Gift weight="fill" />} eyebrow="MESSAGES & GIFTS" title="Inbox" subtitle="Geschenke, Event-News, Missionen und Club-Aktivitäten an einem Ort." />
    <section className="ls-inbox-list">{messages.map((message) => <Link key={message.id} href={message.action}><div><Gift weight="fill" /></div><span><small>{message.badge}</small><strong>{message.title}</strong><p>{message.body}</p></span><b>›</b></Link>)}</section>
  </AppShell>;
}
