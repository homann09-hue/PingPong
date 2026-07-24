"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
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

const bottomNav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/missions", label: "Missionen", icon: Target },
  { href: "/club", label: "Club", icon: UsersThree },
  { href: "/boost", label: "Boost", icon: Lightning },
  { href: "/inbox", label: "Inbox", icon: Gift },
] as const;

const drawerLinks = [
  { href: "/events", label: "Events & Turniere", icon: CalendarDots },
  { href: "/missions", label: "Meine Missionen", icon: Target },
  { href: "/club", label: "Club & VIP", icon: UsersThree },
  { href: "/boost", label: "Booster & Bonusrad", icon: Lightning },
  { href: "/shop", label: "Coin Shop", icon: ShoppingBag },
  { href: "/inbox", label: "Inbox & Geschenke", icon: Gift },
  { href: "/account", label: "Profil & Einstellungen", icon: Medal },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
    else setQuery("");
  }, [searchOpen]);

  const normalized = query.trim().toLowerCase();
  const results = games.filter((game) =>
    game.name.toLowerCase().includes(normalized)
    || game.category.toLowerCase().includes(normalized)
    || game.features.toLowerCase().includes(normalized));

  return <div className="ls-app-shell">
    <header className="ls-topbar">
      <Link className="ls-buy-button" href="/shop"><ShoppingBag weight="fill" /><span>BUY</span></Link>
      <div className="ls-brand"><Crown weight="fill" /><span>AURORA</span><strong>SLOTS</strong></div>
      <div className="ls-top-actions">
        <div className="ls-balance coin"><Coins weight="fill" /><strong>{profile ? coinNumber(profile.coinBalance) : "—"}</strong></div>
        <div className="ls-balance gem"><Diamond weight="fill" /><strong>{profile ? coinNumber(profile.gemBalance ?? 0) : "—"}</strong></div>
        <Link className="ls-scratch-button" href="/boost"><Gift weight="fill" /><span>SCRATCH</span></Link>
        <button className="ls-icon-button" onClick={() => setSearchOpen(true)} aria-label="Slots suchen"><MagnifyingGlass weight="bold" /></button>
        <button className="ls-menu-button" onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen"><List weight="bold" /></button>
      </div>
    </header>

    {searchOpen && <div className="ls-overlay" role="dialog" aria-modal="true" aria-label="Slot-Suche" onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <section className="ls-search-modal">
        <header><MagnifyingGlass weight="bold" /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Slot oder Thema suchen …" /><button onClick={() => setSearchOpen(false)} aria-label="Suche schließen"><X weight="bold" /></button></header>
        <div className="ls-search-grid">
          {results.map((game) => <Link key={game.id} href={`/slots/${game.id}`} onClick={() => setSearchOpen(false)}>
            <Image src={game.cover} alt="" width={94} height={72} quality={78} />
            <span><strong>{game.name}</strong><small>{game.category} · Level {game.unlockLevel}</small></span>
          </Link>)}
          {results.length === 0 && <p>Kein Slot gefunden.</p>}
        </div>
      </section>
    </div>}

    {drawerOpen && <div className="ls-drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
      <aside className="ls-menu-drawer" role="dialog" aria-modal="true" aria-label="Hauptmenü" onClick={(event) => event.stopPropagation()}>
        <header>
          <Image src="/assets/ui/player-avatar.png" alt="Spielerprofil" width={58} height={58} quality={82} />
          <span><strong>PlayerOne</strong><small>Level {profile?.progression.level ?? 1} · VIP {profile?.vip?.tier ?? "Bronze"}</small></span>
          <button onClick={() => setDrawerOpen(false)} aria-label="Menü schließen"><X weight="bold" /></button>
        </header>
        <nav>{drawerLinks.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}><Icon weight="fill" /><span>{item.label}</span><b>›</b></Link>; })}</nav>
        <footer><Crown weight="fill" /><span>Social Casino · Nur virtuelles Spielgeld</span></footer>
      </aside>
    </div>}

    <main className="ls-page-content">{children}</main>

    <nav className="ls-bottom-nav" aria-label="App Navigation">
      {bottomNav.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}
    </nav>
  </div>;
}
