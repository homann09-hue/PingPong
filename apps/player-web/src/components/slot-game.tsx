"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Minus } from "@phosphor-icons/react/dist/csr/Minus";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { initialGrid, type SpinResult } from "@/lib/contracts";
import { lowSymbolLabels, pharaohSymbols } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import { usePlayer } from "@/hooks/use-player";

const bets = [100, 200, 500, 1_000, 2_000, 5_000] as const;

export function SlotGame() {
  const { profile, setProfile, error } = usePlayer();
  const [betIndex, setBetIndex] = useState(0);
  const [grid, setGrid] = useState(initialGrid);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [win, setWin] = useState(0);
  const [message, setMessage] = useState("Place your bet and spin");
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const bet = bets[betIndex] ?? bets[0];
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);

  async function spin() {
    if (spinning) return;
    setSpinning(true); setWinCells(new Set()); setWin(0); setMessage("Reels spinning…");
    try {
      const response = await fetch("/api/player/slots/pharaoh-oasis/spins", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ bet, bonusBuy: false }),
      });
      const body = await response.json() as SpinResult & { code?: string };
      if (!response.ok) throw new Error(body.code ?? "SPIN_FAILED");
      await new Promise((resolve) => window.setTimeout(resolve, turbo ? 160 : 720));
      setGrid(body.spin.grid);
      setWin(body.spin.totalWin);
      setWinCells(new Set(body.spin.wins.flatMap((entry) => entry.cells.map(([reel, row]) => `${reel}:${row}`))));
      setMessage(body.spin.totalWin > 0 ? `${body.spin.winClass ?? "WIN"} · ${coinNumber(body.spin.totalWin)} coins` : "Try another spin");
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      setMessage(code === "INSUFFICIENT_FUNDS" ? "Not enough coins for this bet" : "Spin could not be completed. Your balance is safe.");
    } finally { setSpinning(false); }
  }

  return <AppShell profile={profile}>
    <section className="slot-stage" aria-labelledby="slot-title">
      <Image className="slot-backdrop" src="/assets/slots/pharaoh_oasis.png" alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      <header className="slot-header"><Link href="/" className="back-link"><ArrowLeft weight="bold" /> Lobby</Link><div><span>Pharaoh Oasis</span><h1 id="slot-title">Grand 72,450,000</h1></div><button className="icon-button" onClick={() => setSound((value) => !value)} aria-label={sound ? "Mute sound" : "Enable sound"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button></header>
      {error && <div className="service-alert" role="status">{error}</div>}
      <div className="jackpot-strip" aria-label="Progressive jackpots"><span><small>Mini</small><strong>12,540</strong></span><span><small>Minor</small><strong>184,200</strong></span><span><small>Major</small><strong>2,840,000</strong></span><span><small>Grand</small><strong>72,450,000</strong></span></div>
      <div className={`reel-frame ${spinning ? "is-spinning" : ""}`} aria-label="Five reel, three row slot grid" aria-busy={spinning}>
        {reels.map(({ column, reel }) => <div className="reel" key={reel} style={{ "--reel-delay": `${reel * 70}ms` } as React.CSSProperties}>{column.map((symbol, row) => <div className={`symbol ${winCells.has(`${reel}:${row}`) ? "winning" : ""}`} key={`${reel}-${row}`}>{pharaohSymbols[symbol] ? <Image src={pharaohSymbols[symbol]} alt={`${symbol} symbol`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} /> : <span className="low-symbol" aria-label={`${lowSymbolLabels[symbol] ?? symbol} symbol`}>{lowSymbolLabels[symbol] ?? symbol}</span>}</div>)}</div>)}
      </div>
      <div className="win-panel" aria-live="polite"><span>{message}</span>{win > 0 && <strong>WIN {coinNumber(win)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Decrease bet"><Minus weight="bold" /></button><span><small>Bet</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex === bets.length - 1} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Increase bet"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile} aria-label={spinning ? "Spinning" : `Spin for ${coinNumber(bet)} coins`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? "Spin" : "Spin"}</span></button>
        <button className="auto-button" disabled title="Auto play will be enabled after responsible-play controls"><ArrowsClockwise weight="bold" /><span>Auto</span></button>
      </div>
      <p className="play-money-notice">For entertainment only · Virtual coins have no cash value · Server-authoritative results</p>
    </section>
  </AppShell>;
}
