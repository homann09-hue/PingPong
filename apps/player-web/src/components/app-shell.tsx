"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Gear } from "@phosphor-icons/react/dist/csr/Gear";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Medal } from "@phosphor-icons/react/dist/csr/Medal";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { ShoppingBag } from "@phosphor-icons/react/dist/csr/ShoppingBag";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import { PremiumLiveRail } from "@/components/premium-live-rail";
import { games } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import type { Profile } from "@/lib/contracts";

const nav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/#all-games", label: "Slots", icon: Compass },
  { href: "/#social", label: "Freunde", icon: UsersThree },
  { href: "/#events", label: "Turniere", icon: Trophy },
  { href: "/#missions", label: "Quests", icon: Target },
] as const;

const mobileMenuItems = [
  { href: "/#featured", label: "Top Slots", copy: "Beliebte Welten", icon: Crown },
  { href: "/#jackpots", label: "Jackpots", copy: "Live-Pools", icon: Trophy },
  { href: "/#events", label: "Events", copy: "Turniere & Drops", icon: Medal },
  { href: "/#missions", label: "Missionen", copy: "Aufgaben & XP", icon: Target },
  { href: "/#social", label: "Freunde", copy: "Crew & Clans", icon: UsersThree },
  { href: "/#rewards", label: "VIP & Pass", copy: "Ränge & Prämien", icon: Gift },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  const isSlotRoute = /^\/slots\/[^/?#]+/.test(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const claimableRewards = profile?.achievements?.filter((entry) => entry.completed && !entry.claimed && entry.unlocked).length ?? 0;
  const level = profile?.progression.level ?? 1;
  const vipPoints = profile?.vip?.points ?? 0;
  const vipProgress = Math.min(100, Math.max(8, (vipPoints % 1000) / 10));
  const menuGames = games.slice(0, 4);

  useEffect(() => {
    document.documentElement.classList.toggle("slot-mobile-session", isSlotRoute);
    return () => document.documentElement.classList.remove("slot-mobile-session");
  }, [isSlotRoute]);

  useEffect(() => {
    document.body.classList.toggle("mobile-casino-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-casino-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileMenuOpen(false);
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (searchOpen) searchInput.current?.focus(); else setQuery(""); }, [searchOpen]);

  const results = games.filter((game) =>
    game.name.toLowerCase().includes(query.trim().toLowerCase())
    || game.category.toLowerCase().includes(query.trim().toLowerCase()));
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return <div className={`app-shell premium-shell${isSlotRoute ? " is-slot-route" : ""}`}>
    <header className="topbar premium-topbar">
      <Link href="/" className="mobile-brand" aria-label="Zur Aurora-Lobby"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong></Link>
      <Link href="/account" className="top-player-card">
        <Image src="/assets/ui/player-avatar.png" alt="Spielerprofil" width={48} height={48} quality={82} />
        <span><strong>MaxMustermann</strong><small>Level {level}</small></span>
        <i style={{ "--player-progress": `${Math.min(100, level * 3)}%` } as React.CSSProperties} />
      </Link>
      <button className="search-trigger" aria-label="Spiele durchsuchen" onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }}><MagnifyingGlass weight="bold" /><span>Slots durchsuchen</span><kbd>⌘ K</kbd></button>
      <div className="wallet-cluster" aria-label="Spieler-Guthaben">
        <div className="wallet-pill coin-wallet"><Coins weight="fill" /><span>{profile ? coinNumber(profile.coinBalance) : "—"}</span><Link href="/#shop" aria-label="Coins holen">+</Link></div>
        <div className="wallet-pill gem-wallet"><Diamond weight="fill" /><span>{profile ? coinNumber(profile.gemBalance ?? 0) : "—"}</span><Link href="/#shop" aria-label="Gems holen">+</Link></div>
      </div>
      <div className="top-actions">
        <Link href="/#shop" aria-label="Tagesbonus" className="notify-action gift-action"><Gift weight="fill" /><i>1</i></Link>
        <Link href="/#events" aria-label="Turniere" className="notify-action"><Trophy weight="fill" /><i>2</i></Link>
        <Link href="/#rewards" aria-label="Benachrichtigungen" className="notify-action"><Bell weight="fill" />{claimableRewards > 0 && <i>{claimableRewards}</i>}</Link>
        <Link href="/account" aria-label="Einstellungen" className="settings-action"><Gear weight="fill" /></Link>
      </div>
    </header>

    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Spielsuche" onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <div className="search-panel">
        <div className="search-head">
          <MagnifyingGlass weight="bold" />
          <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Slot oder Kategorie suchen …" aria-label="Suchbegriff" />
          <button onClick={() => setSearchOpen(false)} aria-label="Suche schließen"><X weight="bold" /></button>
        </div>
        <ul className="search-results">
          {results.map((game) => <li key={game.id}>
            <Link href={`/slots/${game.id}`} onClick={() => setSearchOpen(false)}>
              <Image src={game.cover} alt="" width={72} height={44} quality={72} />
              <span><strong>{game.name}</strong><small>{game.category} · ab Level {game.unlockLevel}</small></span>
            </Link>
          </li>)}
          {results.length === 0 && <li className="search-empty">Keine Welt gefunden.</li>}
        </ul>
      </div>
    </div>}

    {mobileMenuOpen && <div className="mobile-casino-overlay" role="dialog" aria-modal="true" aria-label="Casino-Menü" onClick={(event) => { if (event.target === event.currentTarget) closeMobileMenu(); }}>
      <section className="mobile-casino-menu">
        <header>
          <div><span><Crown weight="fill" /></span><div><small>AURORA CASINO</small><strong>Was möchtest du spielen?</strong></div></div>
          <button type="button" aria-label="Casino-Menü schließen" onClick={closeMobileMenu}><X weight="bold" /></button>
        </header>
        <div className="mobile-menu-wallets">
          <span><Coins weight="fill" /><small>Coins</small><strong>{profile ? coinNumber(profile.coinBalance) : "—"}</strong></span>
          <span><Diamond weight="fill" /><small>Gems</small><strong>{profile ? coinNumber(profile.gemBalance ?? 0) : "—"}</strong></span>
          <Link href="/#shop" onClick={closeMobileMenu}><ShoppingBag weight="fill" /> Shop</Link>
        </div>
        <nav className="mobile-menu-grid" aria-label="Casino-Bereiche">
          {mobileMenuItems.map((item) => { const Icon = item.icon; return <Link href={item.href} key={item.label} onClick={closeMobileMenu}><span><Icon weight="fill" /></span><strong>{item.label}</strong><small>{item.copy}</small></Link>; })}
        </nav>
        <div className="mobile-menu-section-head"><div><small>Direkt starten</small><strong>Beliebte Slot-Welten</strong></div><button type="button" onClick={() => { closeMobileMenu(); setSearchOpen(true); }}><MagnifyingGlass weight="bold" /> Suchen</button></div>
        <div className="mobile-menu-games">
          {menuGames.map((game) => <Link href={`/slots/${game.id}`} key={game.id} onClick={closeMobileMenu}>
            <span><Image src={game.cover} alt="" fill sizes="38vw" /></span>
            <div><strong>{game.name}</strong><small>{game.category}</small><b><Play weight="fill" /> Spielen</b></div>
          </Link>)}
        </div>
      </section>
    </div>}

    <aside className="side-nav premium-side-nav" aria-label="Hauptnavigation">
      <Link href="/" className="side-brand" aria-label="Aurora Casino"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong><small>CASINO</small></Link>
      <nav>{nav.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" && pathname === "/";
        return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}</nav>
      <div className="nav-utility">
        <Link href="/#shop"><ShoppingBag weight="fill" /><span>Shop</span></Link>
        <Link href="/#rewards"><Medal weight="fill" /><span>VIP</span>{claimableRewards > 0 && <i>{claimableRewards}</i>}</Link>
      </div>
      <Link href="/#rewards" className="vip-rank-card">
        <span><Crown weight="fill" /></span>
        <div><strong>{profile?.vip?.tier ?? "Gold III"}</strong><small>{Math.round(vipProgress)}% bis zum Rangaufstieg</small><i><b style={{ width: `${vipProgress}%` }} /></i></div>
      </Link>
    </aside>

    <main className="page-content">
      {pathname === "/" && <PremiumLiveRail />}
      {children}
    </main>

    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <Link href="/" className={pathname === "/" ? "active" : ""}><House weight={pathname === "/" ? "fill" : "bold"} /><span>Lobby</span></Link>
      <Link href="/#all-games"><Compass weight="bold" /><span>Slots</span></Link>
      <button type="button" className={mobileMenuOpen ? "mobile-menu-trigger active" : "mobile-menu-trigger"} aria-label="Casino-Menü öffnen" aria-expanded={mobileMenuOpen} onClick={() => { setSearchOpen(false); setMobileMenuOpen((current) => !current); }}><List weight="bold" /><span>Menü</span></button>
      <Link href="/#shop"><ShoppingBag weight="bold" /><span>Shop</span></Link>
      <Link href="/account" className={pathname === "/account" ? "active" : ""}><Gear weight="bold" /><span>Konto</span></Link>
    </nav>
  </div>;
}
