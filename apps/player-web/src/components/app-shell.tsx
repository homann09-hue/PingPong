"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Medal } from "@phosphor-icons/react/dist/csr/Medal";
import { ShoppingBag } from "@phosphor-icons/react/dist/csr/ShoppingBag";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import { games } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import type { Profile } from "@/lib/contracts";

const nav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/#all-games", label: "Welten", icon: Compass },
  { href: "/#missions", label: "Missionen", icon: Target },
  { href: "/#events", label: "Events", icon: CalendarDots },
  { href: "/#clans", label: "Clans", icon: UsersThree },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const claimableRewards = profile?.achievements?.filter((entry) => entry.completed && !entry.claimed && entry.unlocked).length ?? 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); else setQuery(""); }, [searchOpen]);

  const results = games.filter((game) =>
    game.name.toLowerCase().includes(query.trim().toLowerCase())
    || game.category.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="mobile-brand" aria-label="Zur Aurora-Arcade-Lobby"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong></Link>
      <button className="search-trigger" aria-label="Spiele durchsuchen" onClick={() => setSearchOpen(true)}><MagnifyingGlass weight="bold" /><span>Welten durchsuchen</span><kbd>⌘ K</kbd></button>
      <div className="wallet-cluster" aria-label="Spieler-Guthaben">
        <div className="wallet-pill coin-wallet"><Coins weight="fill" /><span>{profile ? coinNumber(profile.coinBalance) : "—"}</span><Link href="/#shop" aria-label="Coins holen">+</Link></div>
        <div className="wallet-pill gem-wallet"><Diamond weight="fill" /><span>{profile ? coinNumber(profile.gemBalance ?? 0) : "—"}</span><Link href="/#shop" aria-label="Gems holen">+</Link></div>
        <Link className="store-button" href="/#shop"><ShoppingBag weight="fill" /><span>Shop</span></Link>
      </div>
      <div className="player-cluster">
        <div className="level-copy"><strong>Level {profile?.progression.level ?? "…"}</strong><span>{profile?.vip?.tier ?? "…"} VIP</span></div>
        <Link href="/account" className="profile-link" aria-label="Konto und Cloud-Speicherstand oeffnen"><Image src="/assets/ui/player-avatar.png" alt="Spielerprofil" width={46} height={46} quality={78} /></Link>
      </div>
    </header>

    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Spielsuche" onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <div className="search-panel">
        <div className="search-head">
          <MagnifyingGlass weight="bold" />
          <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Slot oder Kategorie suchen …" aria-label="Suchbegriff" />
          <button onClick={() => setSearchOpen(false)} aria-label="Suche schliessen"><X weight="bold" /></button>
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

    <aside className="side-nav" aria-label="Hauptnavigation">
      <Link href="/" className="side-brand" aria-label="Aurora Arcade"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong><small>ARCADE</small></Link>
      <nav>{nav.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" && pathname === "/";
        return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}</nav>
      <div className="nav-utility">
        <Link href="/#rewards"><Medal weight="fill" /><span>Rewards</span>{claimableRewards > 0 && <i>{claimableRewards}</i>}</Link>
        <Link className="shop-link" href="/#shop"><Gift weight="fill" /><span>Shop</span></Link>
      </div>
    </aside>

    <main className="page-content">{children}</main>

    <nav className="bottom-nav" aria-label="Mobile Navigation">
      {nav.slice(0, 3).map((item) => { const Icon = item.icon; const active = item.href === "/" && pathname === "/"; return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>; })}
      <Link href="/#shop"><ShoppingBag weight="bold" /><span>Shop</span></Link>
      <Link href="/account" className={pathname === "/account" ? "active" : ""}><List weight="bold" /><span>Konto</span></Link>
    </nav>
  </div>;
}
