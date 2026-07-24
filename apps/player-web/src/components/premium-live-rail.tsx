"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Broadcast, ChatCircleDots, CheckCircle, ClockCounterClockwise, Coins, Confetti, Crown, EnvelopeSimple, Fire, Gift, Heart, Lightning, LockKey, Medal, Play, Sparkle, SquaresFour, Star, Target, Timer, Trophy, UserPlus, UsersThree } from "@phosphor-icons/react";

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
const featuredGames = [
  { href: "/slots/candy-carnival", title: "Candy Carnival", image: "/assets/slots/candy_carnival.png", players: "12.450", badge: "HOT", tone: "pink" },
  { href: "/slots/pharaoh-oasis", title: "Pharaoh Oasis", image: "/assets/slots/pharaoh_oasis.png", players: "8.932", badge: "TOP", tone: "gold" },
  { href: "/slots/neon-nights", title: "Neon Nights", image: "/assets/slots/neon_nights.png", players: "6.521", badge: "NEU", tone: "violet" },
  { href: "/slots/verdant-afterfall", title: "Verdant Afterfall", image: "/assets/slots/verdant_afterfall.png", players: "5.362", badge: "LIVE", tone: "green" },
  { href: "/slots/vegas-gold", title: "Vegas Gold", image: "/assets/slots/vegas_gold.png", players: "9.817", badge: "JACKPOT", tone: "orange" },
];
const worlds = [
  { href: "/slots/pharaoh-oasis", eyebrow: "MEGAWAYS", title: "Pharaoh Oasis", copy: "Goldene Kammern, Mystery Wilds und bis zu 117.649 Gewinnwege.", className: "pharaoh" },
  { href: "/slots/neon-nights", eyebrow: "HOLD & WIN", title: "Neon Nights", copy: "Jackpot-Orbs, pulsierende Reels und ein wachsender Bonus-Tresor.", className: "neon" },
  { href: "/slots/candy-carnival", eyebrow: "CLUSTER PAYS", title: "Candy Carnival", copy: "Kettenreaktionen, Multiplikatoren und riesige Symbol-Explosionen.", className: "candy" },
];
const passRewards = [
  { level: 21, reward: "150K", icon: Coins, unlocked: true }, { level: 22, reward: "2× XP", icon: Lightning, unlocked: true },
  { level: 23, reward: "Chest", icon: Gift, unlocked: false }, { level: 24, reward: "500K", icon: Coins, unlocked: false },
  { level: 25, reward: "VIP Box", icon: Crown, unlocked: false },
];
const promos = [
  { kicker: "Nur heute", title: "Lucky Hour", copy: "Doppelte Saison-XP in allen Neon-Welten.", reward: "2× XP", href: "/slots/neon-nights", tone: "violet" },
  { kicker: "Freunde-Boost", title: "Team Jackpot", copy: "Spielt gemeinsam und füllt euren Gruppen-Tresor.", reward: "+1.5 M", href: "/#social", tone: "cyan" },
  { kicker: "Mega Drop", title: "Goldregen", copy: "Zufällige Coin-Drops laufen noch für kurze Zeit.", reward: "LIVE", href: "/#events", tone: "gold" },
];
const friends = [
  { name: "Luna77", game: "Candy Carnival", level: 64, status: "spielt gerade" },
  { name: "MikaX", game: "Neon Nights", level: 51, status: "Jackpot-Runde" },
  { name: "LuckyLeo", game: "Pharaoh Oasis", level: 47, status: "online" },
];
const jackpotPools = [
  { name: "GRAND", value: "128.745.920", game: "Neon Nights", href: "/slots/neon-nights", tone: "grand" },
  { name: "MAJOR", value: "24.892.640", game: "Pharaoh Oasis", href: "/slots/pharaoh-oasis", tone: "major" },
  { name: "SUPER", value: "6.418.300", game: "Vegas Gold", href: "/slots/vegas-gold", tone: "super" },
];
const recentGames = [
  { title: "Candy Carnival", href: "/slots/candy-carnival", image: "/assets/slots/candy_carnival.png", last: "vor 18 Min.", bet: "25K" },
  { title: "Neon Nights", href: "/slots/neon-nights", image: "/assets/slots/neon_nights.png", last: "gestern", bet: "50K" },
  { title: "Pharaoh Oasis", href: "/slots/pharaoh-oasis", image: "/assets/slots/pharaoh_oasis.png", last: "vor 3 Tagen", bet: "10K" },
];
const achievements = [
  { title: "Jackpot-Jäger", copy: "Gewinne 5 progressive Jackpots", progress: 80, value: "4/5", icon: Trophy, tone: "gold" },
  { title: "Neon-Legende", copy: "Erreiche Stufe 25 im Season Pass", progress: 88, value: "22/25", icon: Crown, tone: "violet" },
  { title: "Crew Player", copy: "Spiele 20 Runden mit Freunden", progress: 65, value: "13/20", icon: UsersThree, tone: "cyan" },
];

export function PremiumLiveRail() {
  const [activeWin, setActiveWin] = useState(0);
  const [activePromo, setActivePromo] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Alle Spiele");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [inboxClaimed, setInboxClaimed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5 * 3600 + 42 * 60 + 18);
  const [jackpotTick, setJackpotTick] = useState(0);

  useEffect(() => { const timer = window.setInterval(() => setActiveWin((current) => (current + 1) % liveWins.length), 3200); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => setActivePromo((current) => (current + 1) % promos.length), 5200); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => setJackpotTick((current) => current + 137), 1800); return () => window.clearInterval(timer); }, []);

  const win = liveWins[activeWin];
  const promo = promos[activePromo];
  const toggleFavorite = (title: string) => setFavorites((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return <section className="premium-live-layer" aria-label="Live-Casino-Highlights">
    <div className="premium-ambient" aria-hidden="true"><i /><i /><i /></div>
    <section className="premium-welcome-grid" aria-label="Willkommen und Tagesbonus"><article className="premium-welcome-card"><div className="premium-welcome-copy"><span><Sparkle weight="fill" /> Willkommen zurück</span><h2>Dein Casino wartet.</h2><p>Neue Jackpots, frische Missionen und deine Lieblingswelten sind bereit.</p><div><Link href="/slots/candy-carnival"><Play weight="fill" /> Weiterspielen</Link><small>Letzter Slot: Candy Carnival</small></div></div><div className="premium-welcome-coins" aria-hidden="true"><i /><i /><i /><i /><i /></div></article><article className={bonusClaimed ? "premium-daily-chest claimed" : "premium-daily-chest"}><div className="premium-chest-scene" aria-hidden="true"><span className="premium-chest-rays" /><div className="premium-chest"><i /><b /><em /></div><span className="premium-chest-coin one">●</span><span className="premium-chest-coin two">●</span><span className="premium-chest-coin three">●</span></div><div className="premium-daily-copy"><small>Tagesbonus · Tag 6</small><strong>{bonusClaimed ? "Bonus abgeholt" : "250.000 Coins warten"}</strong><p>{bonusClaimed ? "Morgen wartet die Mystery Chest auf dich." : "Halte deine Serie aktiv und öffne morgen die große Mystery Chest."}</p><button type="button" disabled={bonusClaimed} onClick={() => setBonusClaimed(true)}>{bonusClaimed ? <><CheckCircle weight="fill" /> Abgeholt</> : <><Gift weight="fill" /> Bonus abholen</>}</button></div><div className="premium-streak" aria-label="Tagesbonus-Serie">{[1,2,3,4,5,6,7].map((day) => <span className={day <= 6 ? "done" : ""} key={day}>{day < 6 ? "✓" : day === 6 ? "HEUTE" : "?"}</span>)}</div></article></section>
    <nav className="premium-category-nav" aria-label="Spielkategorien">{categories.map((category) => { const Icon = category.icon; const active = activeCategory === category.label; return <Link href={category.href} key={category.label} className={active ? "active" : ""} onClick={() => setActiveCategory(category.label)}><span><Icon weight={active ? "fill" : "bold"} /></span><strong>{category.label}</strong>{category.badge ? <small>{category.badge}</small> : null}</Link>; })}</nav>
    <div className="premium-live-strip"><span className="premium-live-label"><i /> LIVE</span><div className="premium-win-feed" key={`${win.player}-${activeWin}`}><Sparkle weight="fill" /><strong>{win.player}</strong><span>gewann {win.amount} in {win.game}</span></div><Link href="/#events"><Trophy weight="fill" /> Rangliste</Link></div>
    <div className="premium-hero-grid"><article className="premium-season-hero"><div className="premium-event-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><div className="premium-orbit" aria-hidden="true"><span /><span /><span /></div><div className="premium-season-copy"><span className="premium-kicker"><Fire weight="fill" /> Saison-Event</span><h1><small>Empire of</small> Neon</h1><p>Spiele dich durch animierte Casino-Welten, sammle Kronen und öffne den exklusiven Grand Vault.</p><div className="premium-actions"><Link href="/slots/neon-nights"><Play weight="fill" /> Jetzt spielen</Link><button type="button" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Event ansehen</button></div></div><div className="premium-jackpot-core" aria-label="Event-Jackpot 24,8 Millionen Coins"><span>Event Jackpot</span><strong>24.8 M</strong><small>steigt live</small><i aria-hidden="true" /></div></article><aside className="premium-reward-stack"><button type="button" className="premium-reward-card daily"><span><Gift weight="fill" /></span><div><small>Tägliche Serie</small><strong>Tag 6 von 7</strong><p>Morgen: Mystery Chest</p></div><b>+250K</b></button><button type="button" className="premium-reward-card boost"><span><Lightning weight="fill" /></span><div><small>Aktiver Boost</small><strong>2× XP Rush</strong><p>Noch 18 Minuten</p></div><b>2×</b></button></aside></div>
    <section className="premium-jackpot-zone" id="jackpots" aria-labelledby="premium-jackpot-title"><div className="premium-world-header"><div><span>Progressive Pools</span><h2 id="premium-jackpot-title">Jackpots steigen live</h2></div><Link href="/#all-games">Jackpot-Slots</Link></div><div className="premium-jackpot-board">{jackpotPools.map((pool, index) => { const base = Number(pool.value.replace(/\./g, "")); const shown = (base + jackpotTick * (index + 1)).toLocaleString("de-DE"); return <Link href={pool.href} className={`premium-jackpot-pool ${pool.tone}`} key={pool.name}><span className="premium-pool-rays" aria-hidden="true" /><small>{pool.name}</small><strong>{shown}</strong><p><i /> wächst gerade · {pool.game}</p><b><Play weight="fill" /> Jackpot jagen</b></Link>; })}</div></section>
    <section className="premium-liveops" aria-labelledby="premium-liveops-title"><div className="premium-world-header"><div><span>Live-Service-Zentrale</span><h2 id="premium-liveops-title">Heute läuft mehr</h2></div><Link href="/#events">Alle Events</Link></div><div className="premium-liveops-grid"><article className="premium-tournament-card"><div className="premium-tournament-glow" aria-hidden="true" /><span className="premium-liveops-icon"><Trophy weight="fill" /></span><div className="premium-liveops-copy"><small>Wochenend-Turnier</small><strong>Neon Crown Clash</strong><p>Spiele dich in die Top 100 und sichere dir einen Anteil am 50-Millionen-Pool.</p></div><div className="premium-rank-block"><small>Dein Rang</small><strong>#148</strong><span>↑ 26 Plätze</span></div><div className="premium-countdown"><Timer weight="fill" /><span><b>{hours}</b><small>STD</small></span><i>:</i><span><b>{minutes}</b><small>MIN</small></span><i>:</i><span><b>{seconds}</b><small>SEK</small></span></div><Link href="/slots/neon-nights">Punkte sammeln <ArrowRight weight="bold" /></Link></article><article className="premium-quest-card"><header><span><Target weight="fill" /></span><div><small>Tagesmission</small><strong>Bonusjäger</strong></div><b>3/5</b></header><p>Löse fünf Bonus-Runden in beliebigen Slots aus.</p><div className="premium-progress"><i style={{ width: "60%" }} /></div><footer><span><Gift weight="fill" /> 400K Coins</span><Link href="/#missions">Missionen</Link></footer></article><article className="premium-vip-card"><header><span><Medal weight="fill" /></span><div><small>VIP-Fortschritt</small><strong>Gold III</strong></div><b>72%</b></header><p>Noch 2.800 VIP-Punkte bis Platin I und exklusiven Monatsboni.</p><div className="premium-progress vip"><i style={{ width: "72%" }} /></div><footer><span><Crown weight="fill" /> 7-Tage-Bonus +15%</span><Link href="/#rewards">VIP ansehen</Link></footer></article></div></section>
    <section className="premium-pass-center" aria-labelledby="premium-pass-title"><article className="premium-season-pass"><div className="premium-pass-copy"><span><Crown weight="fill" /> Season Pass</span><h2 id="premium-pass-title">Neon Dynasty</h2><p>Verdiene Saison-XP, steige durch 50 Stufen und sichere dir exklusive Belohnungen.</p><div className="premium-pass-level"><strong>Stufe 22</strong><span>7.480 / 10.000 XP</span></div><div className="premium-pass-progress"><i /></div></div><div className="premium-pass-track">{passRewards.map((item) => { const Icon = item.icon; return <div className={item.unlocked ? "unlocked" : "locked"} key={item.level}><small>{item.level}</small><span><Icon weight="fill" /></span><strong>{item.reward}</strong>{!item.unlocked && <i><LockKey weight="fill" /></i>}</div>; })}</div><Link href="/#rewards">Season Pass öffnen <ArrowRight weight="bold" /></Link></article><article className={inboxClaimed ? "premium-reward-inbox claimed" : "premium-reward-inbox"}><header><span><EnvelopeSimple weight="fill" /></span><div><small>Belohnungs-Inbox</small><strong>{inboxClaimed ? "Alles abgeholt" : "3 Geschenke warten"}</strong></div>{!inboxClaimed && <b>3</b>}</header><div className="premium-inbox-items"><span><Coins weight="fill" /> 300K Coins</span><span><Lightning weight="fill" /> 30 Min. XP-Boost</span><span><Gift weight="fill" /> Mystery Box</span></div><button type="button" disabled={inboxClaimed} onClick={() => setInboxClaimed(true)}>{inboxClaimed ? <><CheckCircle weight="fill" /> Eingesammelt</> : <><Gift weight="fill" /> Alles abholen</>}</button></article></section>
    <section className="premium-social-promo" id="social"><article className={`premium-promo-rotator ${promo.tone}`} key={activePromo}><div className="premium-promo-energy" aria-hidden="true"><i /><i /><i /></div><div className="premium-promo-copy"><span><Broadcast weight="fill" /> {promo.kicker}</span><h2>{promo.title}</h2><p>{promo.copy}</p><Link href={promo.href}><Play weight="fill" /> Jetzt nutzen</Link></div><strong>{promo.reward}</strong><div className="premium-promo-dots">{promos.map((item, index) => <button type="button" key={item.title} className={index === activePromo ? "active" : ""} aria-label={`Promo ${index + 1} anzeigen`} onClick={() => setActivePromo(index)} />)}</div></article><article className="premium-friends-panel"><header><div><span>Deine Casino-Crew</span><h2>Freunde sind online</h2></div><Link href="/#clans"><UserPlus weight="bold" /> Einladen</Link></header><div className="premium-friend-list">{friends.map((friend, index) => <div key={friend.name}><span className="premium-friend-avatar"><Image src="/assets/ui/player-avatar.png" alt="" width={48} height={48} /><i /></span><div><strong>{friend.name}</strong><small>Level {friend.level} · {friend.status}</small></div><Link href={index === 2 ? "/#social" : `/slots/${index === 0 ? "candy-carnival" : "neon-nights"}`}><ChatCircleDots weight="fill" /><span>{friend.game}</span></Link></div>)}</div><footer><Confetti weight="fill" /><span>Gemeinsamer Wochenbonus: <strong>68%</strong></span><div><i /></div></footer></article></section>
    <section className="premium-achievement-zone" aria-labelledby="premium-achievement-title"><div className="premium-world-header"><div><span>Deine Sammlung</span><h2 id="premium-achievement-title">Erfolge & Wochenziel</h2></div><Link href="/#rewards">Alle Erfolge</Link></div><div className="premium-achievement-layout"><article className="premium-weekly-goal"><div className="premium-weekly-orbit" aria-hidden="true"><i /><i /></div><span><Star weight="fill" /> Wochenziel</span><h3>Casino-Meister</h3><p>Sammle diese Woche 10.000 Aktivitätspunkte und öffne die legendäre Master Chest.</p><div className="premium-weekly-meter"><i /></div><div><strong>7.650 / 10.000</strong><b>76%</b></div><footer><Gift weight="fill" /><span>Belohnung: Master Chest + 1M Coins</span></footer></article><div className="premium-achievement-list">{achievements.map((item) => { const Icon = item.icon; return <article className={item.tone} key={item.title}><span><Icon weight="fill" /></span><div><header><strong>{item.title}</strong><b>{item.value}</b></header><p>{item.copy}</p><div className="premium-achievement-progress"><i style={{ width: `${item.progress}%` }} /></div></div></article>; })}</div></div></section>
    <section className="premium-recent-zone" id="recent" aria-labelledby="premium-recent-title"><div className="premium-world-header"><div><span>Sofort weitermachen</span><h2 id="premium-recent-title">Zuletzt gespielt</h2></div><Link href="/#all-games">Spielverlauf</Link></div><div className="premium-recent-grid">{recentGames.map((game, index) => <article className={index === 0 ? "featured" : ""} key={game.title}><Link href={game.href} className="premium-recent-cover"><Image src={game.image} alt="" fill sizes="(max-width: 700px) 34vw, 160px" /><span><Play weight="fill" /></span></Link><div><small><ClockCounterClockwise weight="bold" /> {game.last}</small><strong>{game.title}</strong><p>Letzter Einsatz: {game.bet}</p><Link href={game.href}>Weiterspielen <ArrowRight weight="bold" /></Link></div></article>)}</div></section>
    <section className="premium-featured" id="featured" aria-labelledby="premium-featured-title"><div className="premium-world-header"><div><span>Für dich ausgewählt</span><h2 id="premium-featured-title">Empfohlene Slots</h2></div><Link href="/#all-games">Alle anzeigen</Link></div><div className="premium-featured-rail">{featuredGames.map((game) => { const favorite = favorites.includes(game.title); return <article className={`premium-game-tile ${game.tone}`} key={game.title}><Link href={game.href} className="premium-game-cover"><Image src={game.image} alt={`${game.title} Slot Cover`} fill sizes="(max-width: 680px) 44vw, 220px" quality={84} /><span className="premium-game-vignette" /><b className="premium-game-badge">{game.badge}</b><span className="premium-game-play"><Play weight="fill" /></span></Link><button type="button" className={favorite ? "premium-favorite active" : "premium-favorite"} onClick={() => toggleFavorite(game.title)} aria-label={`${game.title} ${favorite ? "aus Favoriten entfernen" : "favorisieren"}`}><Heart weight={favorite ? "fill" : "bold"} /></button><div className="premium-game-meta"><strong>{game.title}</strong><small><i /> {game.players} spielen</small></div></article>; })}</div></section>
    <div className="premium-world-header"><div><span>Ausgewählte Welten</span><h2>Jeder Slot fühlt sich anders an</h2></div><Link href="/#all-games">Alle Slots</Link></div><div className="premium-world-rail">{worlds.map((world, index) => <Link href={world.href} className={`premium-world-card ${world.className}`} key={world.title}><span className="premium-card-index">0{index + 1}</span><div className="premium-card-energy" aria-hidden="true" /><div className="premium-card-copy"><small>{world.eyebrow}</small><h3>{world.title}</h3><p>{world.copy}</p><b><Play weight="fill" /> Spielen</b></div></Link>)}</div>
  </section>;
}
