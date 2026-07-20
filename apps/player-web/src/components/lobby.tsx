"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
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
import { useState } from "react";
import { AppShell } from "./app-shell";
import { games } from "@/lib/catalog";
import { coinNumber, describeMission, missionTierLabel, timeLeft } from "@/lib/format";
import { useLobbyData, postClaim } from "@/hooks/use-lobby-data";
import { usePlayer } from "@/hooks/use-player";

const categories = ["Alle", "Neu", "Freispiele", "Bonus", "VIP"] as const;

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
  const [category, setCategory] = useState<(typeof categories)[number]>("Alle");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const level = profile?.progression.level ?? 1;
  const grand = jackpots.find((entry) => entry.tier === "GRAND");
  const tournament = profile?.tournament;
  const dailyMissions = missions.filter((mission) => mission.cadence === "daily" && mission.tier === "standard");
  const dailyDone = dailyMissions.filter((mission) => mission.completed).length;
  const achievements = profile?.achievements ?? [];
  const claimableAchievements = achievements.filter((entry) => entry.completed && !entry.claimed && entry.unlocked);
  const unlockedGames = games.filter((game) => level >= game.unlockLevel).length;
  const recentlyPlayed = games.slice(0, 4);

  const visibleGames = games.filter((game) => {
    if (category === "Neu") return game.isNew === true;
    if (category === "Freispiele") return game.features.toLowerCase().includes("free spin") || game.category === "Free spins";
    if (category === "Bonus") return game.category === "Bonus games" || game.features.toLowerCase().includes("bonus");
    if (category === "VIP") return game.highRoller === true;
    return true;
  });

  async function claim(kind: string, path: string) {
    if (busy) return;
    setBusy(kind); setNotice(null);
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

    <section className="jackpot-ticker casino-ticker" aria-label="Live-Jackpot">
      <span><Sparkle weight="fill" /> Grand-Jackpot</span>
      <strong>{grand ? coinNumber(grand.amount) : "—"}</strong>
      <span className="ticker-status"><i /> {tournament && timeLeft(tournament.endsAt) ? `Turnier endet in ${timeLeft(tournament.endsAt)}` : "Live"}</span>
    </section>

    <section className="casino-lobby-stage" aria-label="Empfohlene Welten">
      <article className="live-events-panel">
        <div className="marquee-title">
          <span>Live</span>
          <strong>Events</strong>
          <i>{events.length || "•"}</i>
        </div>
        <div className="golden-promo-card">
          <Image src="/assets/slots/vegas_gold.png" alt="Goldene Slot-Promo mit Muenzen und hellen Lichtern" fill priority sizes="(max-width: 760px) 94vw, 26vw" quality={88} />
          <div className="promo-shine" />
          <div className="promo-copy">
            <small>{events[0] ? "Live-Event" : "Event"}</small>
            <h1>{events[0]?.title ?? "Golden Day"}</h1>
            <p>{events[0]?.subtitle ?? "Sammle Gewinne und steig in den Event-Stufen auf."}</p>
          </div>
        </div>
        <Link className="panel-more-link" href="/#events">Alle Events ansehen <ArrowRight /></Link>
      </article>

      <div className="center-promo-stack">
        <article className="quest-king-panel">
          <Image src="/assets/slots/neon_nights.png" alt="Neon-Casino-Slot-Cover" fill sizes="(max-width: 760px) 94vw, 34vw" quality={88} />
          <div className="panel-vignette" />
          <span className="pool-chip">{tournament ? `Preispool ${coinNumber(tournament.prizePool)}` : "Turnier"}{tournament && timeLeft(tournament.endsAt) ? ` · ${timeLeft(tournament.endsAt)}` : ""}</span>
          <h2><small>{tournament?.name ?? "Turnier"}</small>Spiel dich hoch</h2>
          <Link href="/slots/pharaoh-oasis"><Play weight="fill" /> Jetzt spielen</Link>
        </article>
        <article className="quest-king-panel compact">
          <Image src="/assets/slots/candy_carnival.png" alt="Buntes Bonus-Slot-Cover" fill sizes="(max-width: 760px) 94vw, 34vw" quality={84} />
          <div className="panel-vignette" />
          <span className="pool-chip new">{events[1] ? "Tages-Event" : "Neu"}</span>
          <h2><small>{events[1]?.title ?? "Bonus Rush"}</small>{events[1] ? "Mach mit" : "Top Treats"}</h2>
          <Link href="/#events" aria-label="Zum Event-Bereich"><Trophy weight="fill" /> Zum Event</Link>
        </article>
      </div>

      <aside className="recently-played-panel" aria-label="Kuerzlich gespielte Spiele">
        <div className="miner-card">
          <Image src="/assets/slots/verdant_afterfall.png" alt="Abenteuer-Slot-Welt" fill sizes="(max-width: 760px) 94vw, 24vw" quality={82} />
          <div className="miner-card-copy"><span>Kürzlich</span><strong>gespielt</strong></div>
        </div>
        <div className="recent-slot-list">
          {recentlyPlayed.map((game) => {
            const locked = level < game.unlockLevel;
            return <Link href={`/slots/${game.id}`} key={game.id} className={locked ? "locked-mini" : ""}>
              <span className="jackpot-number">{locked ? `AB LEVEL ${game.unlockLevel}` : game.name.toUpperCase()}</span>
              <Image src={game.cover} alt={`${game.name} Cover`} width={156} height={92} quality={76} />
              {locked && <i><LockKey weight="fill" /></i>}
            </Link>;
          })}
        </div>
      </aside>
    </section>

    <section className="activity-dock casino-activity-dock" aria-label="Taegliche Aktivitaeten">
      <button onClick={() => scrollToSection("shop")}><span className="activity-icon gold"><Gift weight="fill" /></span><span><small>Gratis-Boni</small><strong>Tagesbonus</strong></span><i>Abholen</i></button>
      <button onClick={() => scrollToSection("missions")}><span className="activity-icon coral"><Target weight="fill" /></span><span><small>{dailyMissions.length > 0 ? `${dailyDone} von ${dailyMissions.length} erledigt` : "Heute aktiv"}</small><strong>Tagesmissionen</strong></span><b>{dailyMissions.length > 0 ? `+${coinNumber(dailyMissions.reduce((sum, mission) => sum + mission.rewardCoins, 0))}` : "→"}</b></button>
      <button onClick={() => scrollToSection("events")}><span className="activity-icon teal"><Trophy weight="fill" /></span><span><small>{tournament ? `Platz ${tournament.rank} von ${tournament.entrants}` : "Turnier"}</small><strong>{tournament?.name ?? "Turnier"}</strong></span><b>{tournament ? `#${tournament.rank}` : "→"}</b></button>
      <button onClick={() => scrollToSection("rewards")}><span className="activity-icon violet"><Star weight="fill" /></span><span><small>{profile?.vip ? `${coinNumber(profile.vip.points)} VIP-Punkte` : "VIP-Reise"}</small><strong>VIP {profile?.vip?.tier ?? ""}</strong></span><b>{claimableAchievements.length > 0 ? `${claimableAchievements.length} offen` : "→"}</b></button>
    </section>

    <section className="catalog" aria-labelledby="games-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Fire weight="fill" /> {unlockedGames} / {games.length} Welten freigeschaltet</span><h2 id="games-title">Slot-Park</h2></div>
        <Link href="/#all-games" onClick={() => setCategory("Alle")}>Alle Spiele <ArrowRight /></Link>
      </div>
      <div className="category-row" role="list" aria-label="Slot-Kategorien">
        {categories.map((item) => <button key={item} className={item === category ? "selected" : ""} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="game-grid" id="all-games">{visibleGames.map((game) => {
        const locked = level < game.unlockLevel;
        return <article className="game-card" key={game.id}>
          <div className="game-cover">
            <Image src={game.cover} alt={`${game.name} Slot-Cover`} fill sizes="(max-width: 600px) 66vw, (max-width: 1100px) 33vw, 19vw" quality={78} />
            <div className="game-cover-vignette" />
            <div className="card-badges">{game.isNew && <span>Neu</span>}{game.highRoller && <span className="vip-badge"><Star weight="fill" /> VIP</span>}</div>
            {locked
              ? <div className="lock-state"><LockKey weight="fill" /><span>Level {game.unlockLevel}</span></div>
              : <Link className="cover-play" href={`/slots/${game.id}`} aria-label={`${game.name} spielen`}><Play weight="fill" /></Link>}
            <div className="game-title"><small>{game.category}</small><h3>{game.name}</h3><p>{game.features}</p></div>
          </div>
        </article>;
      })}</div>
    </section>

    <section className="lobby-section" id="missions" aria-labelledby="missions-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Target weight="fill" /> Taeglich neu um 00:00 UTC</span><h2 id="missions-title">Missionen</h2></div>
      </div>
      <div className="mission-list">
        {missions.length === 0 && <p className="section-empty">Missionen werden geladen …</p>}
        {missions.map((mission) => {
          const progress = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
          const claimable = mission.completed && !mission.claimed && mission.unlocked;
          return <article className={`mission-item ${mission.claimed ? "is-claimed" : ""} ${!mission.unlocked ? "is-locked" : ""}`} key={mission.id}>
            <div className="mission-copy">
              <span className="mission-tier">{missionTierLabel(mission.tier, mission.cadence)}</span>
              <strong>{describeMission(mission.metric, mission.target)}</strong>
              <small>{mission.unlocked
                ? `${coinNumber(Math.min(mission.progress, mission.target))} / ${coinNumber(mission.target)} · endet in ${timeLeft(mission.endsAt) || "Kuerze"}`
                : `Gesperrt – schliesse zuerst ${mission.unlockTarget ?? ""} Missionen ab`}</small>
              <span className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></span>
            </div>
            <div className="mission-reward">
              <span>+{coinNumber(mission.rewardCoins)}</span>
              {mission.claimed
                ? <b className="claimed-chip"><CheckCircle weight="fill" /> Abgeholt</b>
                : claimable
                  ? <button className="claim-button" disabled={busy !== null} onClick={() => void claim(mission.id, `/api/player/missions/${mission.id}/claim`)}>{busy === mission.id ? "…" : "Abholen"}</button>
                  : !mission.unlocked ? <b className="locked-chip"><LockKey weight="fill" /></b> : null}
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="lobby-section" id="events" aria-labelledby="events-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Trophy weight="fill" /> Live-Events & Turnier</span><h2 id="events-title">Events</h2></div>
      </div>
      <div className="event-grid">
        {events.map((event) => <article className="event-card" key={event.id}>
          <header><strong>{event.title}</strong><small>{timeLeft(event.endsAt) ? `endet in ${timeLeft(event.endsAt)}` : "laeuft"}</small></header>
          <p>{event.subtitle}</p>
          <ul>{event.milestones.map((milestone) => <li key={milestone.id} className={milestone.completed ? "done" : ""}>
            <span>{coinNumber(milestone.target)}</span>
            <b>+{coinNumber(milestone.rewardCoins)}</b>
            {milestone.completed && <CheckCircle weight="fill" />}
          </li>)}</ul>
        </article>)}
        {tournament && <article className="event-card tournament-card">
          <header><strong>{tournament.name}</strong><small>Preispool {coinNumber(tournament.prizePool)}</small></header>
          <p>{tournament.subtitle ?? "Sammle Turnierpunkte mit jedem Spin."}</p>
          <ol className="leaderboard">
            {tournament.leaders.map((leader, index) => <li key={leader.name}><span>#{index + 1}</span><strong>{leader.name}</strong><b>{coinNumber(leader.score)}</b></li>)}
            <li className="own-rank"><span>#{tournament.rank}</span><strong>Du</strong><b>{coinNumber(tournament.score)}</b></li>
          </ol>
        </article>}
        {events.length === 0 && !tournament && <p className="section-empty">Events werden geladen …</p>}
      </div>
    </section>

    <section className="lobby-section" id="rewards" aria-labelledby="rewards-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Star weight="fill" /> {claimableAchievements.length > 0 ? `${claimableAchievements.length} Belohnung${claimableAchievements.length === 1 ? "" : "en"} abholbereit` : "Erfolge & VIP"}</span><h2 id="rewards-title">Rewards</h2></div>
      </div>
      {profile?.vip && <div className="vip-progress">
        <span><Star weight="fill" /> VIP {profile.vip.tier}</span>
        <span className="progress-track"><i style={{ width: `${Math.min(100, Math.round((profile.vip.points / Math.max(1, profile.vip.nextTierPoints)) * 100))}%` }} /></span>
        <small>{coinNumber(profile.vip.points)} / {coinNumber(profile.vip.nextTierPoints)} Punkte bis zur naechsten Stufe</small>
      </div>}
      <div className="achievement-grid">
        {achievements.length === 0 && <p className="section-empty">Erfolge werden geladen …</p>}
        {achievements.map((entry) => {
          const claimable = entry.completed && !entry.claimed && entry.unlocked;
          return <article className={`achievement-card tier-${entry.tier} ${entry.claimed ? "is-claimed" : ""} ${!entry.unlocked && !entry.completed ? "is-locked" : ""}`} key={entry.id}>
            <span className="achievement-tier">{entry.tier === "bronze" ? "Bronze" : entry.tier === "silver" ? "Silber" : "Gold"}</span>
            <strong>{entry.name}</strong>
            <small>{entry.description}</small>
            <span className="progress-track"><i style={{ width: `${Math.min(100, Math.round((entry.progress / Math.max(1, entry.target)) * 100))}%` }} /></span>
            <div className="achievement-foot">
              <span>+{coinNumber(entry.coins)}</span>
              {entry.claimed
                ? <b className="claimed-chip"><CheckCircle weight="fill" /> Abgeholt</b>
                : claimable
                  ? <button className="claim-button" disabled={busy !== null} onClick={() => void claim(entry.id, `/api/player/rewards/${entry.rewardId}/claims`)}>{busy === entry.id ? "…" : "Abholen"}</button>
                  : !entry.unlocked ? <b className="locked-chip"><LockKey weight="fill" /></b> : null}
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="lobby-section" id="shop" aria-labelledby="shop-title">
      <div className="section-heading">
        <div><span className="eyebrow"><Gift weight="fill" /> Spielgeld – keine Echtgeld-Kaeufe</span><h2 id="shop-title">Shop</h2></div>
      </div>
      <div className="shop-wallet">
        <span><Coins weight="fill" /> {profile ? coinNumber(profile.coinBalance) : "—"} Coins</span>
        <span><Diamond weight="fill" /> {profile ? coinNumber(profile.gemBalance ?? 0) : "—"} Gems</span>
      </div>
      <div className="shop-grid">
        <article className="shop-card free-card">
          <span className="shop-badge">Gratis</span>
          <strong>Stuendlicher Bonus</strong>
          <small>Alle 60 Minuten kostenlose Coins abholen.</small>
          <button className="claim-button" disabled={busy !== null} onClick={() => void claim("hourly", "/api/player/rewards/hourly/claim")}>{busy === "hourly" ? "…" : "Jetzt abholen"}</button>
        </article>
        <article className="shop-card free-card">
          <span className="shop-badge">Gratis</span>
          <strong>Tagesbonus</strong>
          <small>Einmal taeglich – mit Serie steigt die Belohnung.</small>
          <button className="claim-button" disabled={busy !== null} onClick={() => void claim("daily", "/api/player/rewards/daily/claim")}>{busy === "daily" ? "…" : "Jetzt abholen"}</button>
        </article>
        <article className="shop-card">
          <span className="shop-badge soon">Bald</span>
          <strong>Coin-Pakete</strong>
          <small>Groessere Coin-Bundles kommen mit dem Store-Update.</small>
          <button className="claim-button" disabled aria-disabled="true">Bald verfuegbar</button>
        </article>
        <article className="shop-card">
          <span className="shop-badge soon">Bald</span>
          <strong>Gem-Angebote</strong>
          <small>Gems fuer Booster und Extras – in Arbeit.</small>
          <button className="claim-button" disabled aria-disabled="true">Bald verfuegbar</button>
        </article>
      </div>
    </section>

    <section className="lobby-section" id="clans" aria-labelledby="clans-title">
      <div className="section-heading">
        <div><span className="eyebrow"><UsersThree weight="fill" /> Gemeinsam gewinnen</span><h2 id="clans-title">Clans</h2></div>
      </div>
      <div className="clans-teaser">
        <UsersThree weight="fill" />
        <div>
          <strong>Clans kommen ins Web</strong>
          <p>Freunde, Clan-Chat und Clan-Punkte sind in der Aurora-App bereits live. Die Web-Version folgt als Naechstes – dein Fortschritt zaehlt jetzt schon.</p>
        </div>
      </div>
    </section>
  </AppShell>;
}
