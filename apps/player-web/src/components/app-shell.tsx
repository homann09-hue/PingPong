"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDots, Coins, Crown, Diamond, House, List, Medal, ShoppingBag, Target, UsersThree } from "@phosphor-icons/react";
import { coinNumber } from "@/lib/format";
import type { Profile } from "@/lib/contracts";

const nav = [
  { href: "/", label: "Lobby", icon: House },
  { href: "/#missions", label: "Missions", icon: Target },
  { href: "/#events", label: "Events", icon: CalendarDots },
  { href: "/#clans", label: "Clans", icon: UsersThree },
  { href: "/#rewards", label: "Rewards", icon: Medal },
] as const;

export function AppShell({ profile, children }: Readonly<{ profile: Profile | null; children: React.ReactNode }>) {
  const pathname = usePathname();
  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Aurora Casino lobby"><Crown weight="fill" /><span>AURORA</span></Link>
      <div className="wallet-cluster" aria-label="Player wallet">
        <div className="wallet-pill"><Coins weight="fill" /><span>{profile ? coinNumber(profile.coinBalance) : "—"}</span><button aria-label="Buy coins">+</button></div>
        <div className="wallet-pill compact"><Diamond weight="fill" /><span>{profile?.gemBalance ?? 320}</span></div>
      </div>
      <div className="player-cluster">
        <button className="icon-button" aria-label="Notifications"><Bell weight="fill" /></button>
        <div className="level-copy"><strong>Level {profile?.progression.level ?? 1}</strong><span>{profile?.vip?.tier ?? "BRONZE"} VIP</span></div>
        <Image src="/assets/ui/player-avatar.png" alt="Player profile" width={42} height={42} quality={72} />
      </div>
    </header>
    <aside className="side-nav" aria-label="Primary navigation">
      <Link href="/" className="side-brand"><Crown weight="fill" /><span>AURORA</span></Link>
      <nav>{nav.map((item) => { const Icon = item.icon; const active = item.href === "/" && pathname === "/"; return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>; })}</nav>
      <Link className="shop-link" href="/#shop"><ShoppingBag weight="fill" /><span>Shop</span></Link>
    </aside>
    <main className="page-content">{children}</main>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0, 4).map((item) => { const Icon = item.icon; const active = item.href === "/" && pathname === "/"; return <Link key={item.label} href={item.href} className={active ? "active" : ""}><Icon weight={active ? "fill" : "bold"} /><span>{item.label}</span></Link>; })}<button aria-label="More"><List weight="bold" /><span>More</span></button></nav>
  </div>;
}
