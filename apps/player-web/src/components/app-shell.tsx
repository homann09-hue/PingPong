"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Medal } from "@phosphor-icons/react/dist/csr/Medal";
import { ShoppingBag } from "@phosphor-icons/react/dist/csr/ShoppingBag";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { coinNumber } from "@/lib/format";
import type { Profile } from "@/lib/contracts";

const nav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/#all-games", label: "Worlds", icon: Compass },
  { href: "/#missions", label: "Missions", icon: Target },
  { href: "/#events", label: "Events", icon: CalendarDots },
  { href: "/#clans", label: "Clans", icon: UsersThree },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="mobile-brand" aria-label="Aurora Arcade lobby"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong></Link>
      <button className="search-trigger" aria-label="Search games"><MagnifyingGlass weight="bold" /><span>Search worlds</span><kbd>⌘ K</kbd></button>
      <div className="wallet-cluster" aria-label="Player wallet">
        <div className="wallet-pill coin-wallet"><Coins weight="fill" /><span>{profile ? coinNumber(profile.coinBalance) : "—"}</span><button aria-label="Buy coins">+</button></div>
        <div className="wallet-pill gem-wallet"><Diamond weight="fill" /><span>{profile?.gemBalance ?? 320}</span><button aria-label="Buy gems">+</button></div>
        <Link className="store-button" href="/#shop"><ShoppingBag weight="fill" /><span>Store</span></Link>
      </div>
      <div className="player-cluster">
        <button className="streak-pill" aria-label="Daily streak"><Fire weight="fill" /><span>12</span></button>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell weight="fill" /><i>3</i></button>
        <div className="level-copy"><strong>Level {profile?.progression.level ?? 1}</strong><span>{profile?.vip?.tier ?? "BRONZE"} VIP</span></div>
        <Link href="/account" className="profile-link" aria-label="Open account and cloud save"><Image src="/assets/ui/player-avatar.png" alt="Player profile" width={46} height={46} quality={78} /></Link>
      </div>
    </header>

    <aside className="side-nav" aria-label="Primary navigation">
      <Link href="/" className="side-brand" aria-label="Aurora Arcade"><span className="brand-mark"><Crown weight="fill" /></span><strong>AURORA</strong><small>ARCADE</small></Link>
      <nav>{nav.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" && pathname === "/";
        return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>;
      })}</nav>
      <div className="nav-utility"><Link href="/#rewards"><Medal weight="fill" /><span>Rewards</span><i>2</i></Link><Link className="shop-link" href="/#shop"><Gift weight="fill" /><span>Shop</span></Link></div>
    </aside>

    <main className="page-content">{children}</main>

    <nav className="bottom-nav" aria-label="Mobile navigation">
      {nav.slice(0, 4).map((item) => { const Icon = item.icon; const active = item.href === "/" && pathname === "/"; return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>; })}
      <Link href="/account"><List weight="bold" /><span>Account</span></Link>
    </nav>
  </div>;
}
