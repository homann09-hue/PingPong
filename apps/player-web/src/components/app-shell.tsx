"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { ShoppingBag } from "@phosphor-icons/react/dist/csr/ShoppingBag";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import { games } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import type { Profile } from "@/lib/contracts";

const desktopNav = [
  { href: "/", label: "Alle Spiele", icon: Compass },
  { href: "/#all-games", label: "Slots", icon: Crown },
  { href: "/#events", label: "Jackpots", icon: Trophy },
  { href: "/#social", label: "Live Casino", icon: UsersThree },
  { href: "/#bonus-features", label: "Bonus", icon: Gift },
  { href: "/#all-games", label: "Favoriten", icon: Star },
] as const;

const bottomNav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/#missions", label: "Missionen", icon: Target },
  { href: "/", label: "Home", icon: Crown },
  { href: "/#events", label: "Turnier", icon: Trophy },
  { href: "/#social", label: "Social", icon: UsersThree },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const claimableRewards = profile?.achievements?.filter((entry) => entry.completed && !entry.claimed && entry.unlocked).length ?? 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
    else setQuery("");
  }, [searchOpen]);

  const normalized = query.trim().toLowerCase();
  const results = games.filter((game) => game.name.toLowerCase().includes(normalized) || game.category.toLowerCase().includes(normalized));

  return <div className="fl-app-shell">
    <header className="fl-topbar">
      <Link href="/" className="fl-player" aria-label="Spielerprofil öffnen">
        <Image src="/assets/ui/player-avatar.png" alt="Spielerprofil" width={46} height={46} quality={82} />
        <span><strong>PlayerOne</strong><small>VIP {profile?.vip?.tier ?? "5"}</small></span>
      </Link>

      <div className="fl-wallets" aria-label="Spielguthaben">
        <div className="fl-wallet fl-wallet-coins"><Coins weight="fill" /><strong>{profile ? coinNumber(profile.coinBalance) : "25,680,000"}</strong><Link href="/#shop" aria-label="Coins holen">+</Link></div>
        <div className="fl-wallet fl-wallet-gems"><Diamond weight="fill" /><strong>{profile ? coinNumber(profile.gemBalance ?? 0) : "2,450"}</strong></div>
      </div>

      <button className="fl-search-button" onClick={() => setSearchOpen(true)} aria-label="Spiele suchen"><MagnifyingGlass weight="bold" /></button>
      <Link className="fl-shop-button" href="/#shop"><ShoppingBag weight="fill" /><span>Shop</span></Link>
      <Link className="fl-menu-button" href="/account" aria-label="Menü öffnen"><List weight="bold" /></Link>
    </header>

    {searchOpen && <div className="fl-search-overlay" role="dialog" aria-modal="true" aria-label="Spielsuche" onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <div className="fl-search-panel">
        <div className="fl-search-head">
          <MagnifyingGlass weight="bold" />
          <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games..." aria-label="Suchbegriff" />
          <button onClick={() => setSearchOpen(false)} aria-label="Suche schließen"><X weight="bold" /></button>
        </div>
        <ul>
          {results.map((game) => <li key={game.id}><Link href={`/slots/${game.id}`} onClick={() => setSearchOpen(false)}><Image src={game.cover} alt="" width={84} height={56} quality={76} /><span><strong>{game.name}</strong><small>{game.category} · Level {game.unlockLevel}</small></span></Link></li>)}
          {results.length === 0 && <li className="fl-search-empty">Kein Spiel gefunden.</li>}
        </ul>
      </div>
    </div>}

    <aside className="fl-side-nav" aria-label="Hauptnavigation">
      <Link className="fl-compact-logo" href="/" aria-label="Fortune Legends"><Crown weight="fill" /><span>FL</span></Link>
      <nav>{desktopNav.map((item, index) => {
        const Icon = item.icon;
        const active = index === 0 && pathname === "/";
        return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}</nav>
      <Link className="fl-side-reward" href="/#rewards"><Gift weight="fill" />{claimableRewards > 0 && <i>{claimableRewards}</i>}</Link>
    </aside>

    <main className="fl-page-content">{children}</main>

    <nav className="fl-bottom-nav" aria-label="Mobile Navigation">
      {bottomNav.map((item, index) => {
        const Icon = item.icon;
        const active = index === 0 && pathname === "/";
        return <Link key={item.label} href={item.href} className={`${active ? "active" : ""} ${index === 2 ? "home" : ""}`}><Icon weight={active || index === 2 ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}
    </nav>
  </div>;
}
