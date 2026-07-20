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
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { initialGrid, type JackpotTier, type SpinResult } from "@/lib/contracts";
import { lowSymbolLabels, pharaohSymbols } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import { usePlayer } from "@/hooks/use-player";

const bets = [100, 200, 500, 1_000, 2_000, 5_000] as const;
const jackpotOrder = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;
const jackpotLabels: Readonly<Record<string, string>> = { MINI: "Mini", MINOR: "Minor", MAJOR: "Major", GRAND: "Grand" };

let audioContext: AudioContext | null = null;
/** Kleine synthetische Spielgeraeusche – kein Asset noetig, laeuft nur nach Nutzer-Geste. */
function playTones(frequencies: readonly number[], step = 0.09, type: OscillatorType = "triangle", volume = 0.05) {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    const now = audioContext.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, now + index * step);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (index + 1) * step);
      oscillator.connect(gain).connect(audioContext!.destination);
      oscillator.start(now + index * step);
      oscillator.stop(now + (index + 1) * step + 0.02);
    });
  } catch { /* Sound ist optional */ }
}

export function SlotGame() {
  const { profile, setProfile, error, refresh } = usePlayer();
  const [betIndex, setBetIndex] = useState(0);
  const [grid, setGrid] = useState(initialGrid);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [win, setWin] = useState(0);
  const [message, setMessage] = useState("Setz deinen Einsatz und dreh los");
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const [jackpots, setJackpots] = useState<readonly JackpotTier[]>([]);
  const bet = bets[betIndex] ?? bets[0];
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);
  const grand = jackpots.find((entry) => entry.tier === "GRAND");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/player/jackpots", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { jackpots: JackpotTier[] } : null)
      .then((body) => { if (body && !cancelled) setJackpots(body.jackpots); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function spin() {
    if (spinning) return;
    setSpinning(true); setWinCells(new Set()); setWin(0); setMessage("Walzen drehen …");
    if (sound) playTones([196, 175, 165], 0.08, "sawtooth", 0.03);
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
      if (body.jackpots) setJackpots(body.jackpots);
      if (body.spin.totalWin > 0) {
        setMessage(`${body.spin.winClass ?? "GEWINN"} · ${coinNumber(body.spin.totalWin)} Coins`);
        if (sound) playTones([523, 659, 784, 1047], 0.1, "triangle", 0.05);
      } else {
        setMessage("Versuch den naechsten Spin");
      }
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      setMessage(code === "INSUFFICIENT_FUNDS"
        ? "Nicht genug Coins fuer diesen Einsatz – hol dir Gratis-Boni im Shop."
        : "Der Spin konnte nicht abgeschlossen werden. Dein Guthaben ist sicher.");
    } finally { setSpinning(false); }
  }

  return <AppShell profile={profile}>
    <section className="slot-stage" aria-labelledby="slot-title">
      <Image className="slot-backdrop" src="/assets/slots/pharaoh_oasis.png" alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      <header className="slot-header">
        <Link href="/" className="back-link" aria-label="Zurueck zur Lobby"><ArrowLeft weight="bold" /> Lobby</Link>
        <div><span>Pharaoh Oasis</span><h1 id="slot-title">Grand {grand ? coinNumber(grand.amount) : "—"}</h1></div>
        <button className="icon-button" onClick={() => setSound((value) => !value)} aria-pressed={sound} aria-label={sound ? "Ton aus" : "Ton an"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button>
      </header>
      {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => void refresh()}>Erneut versuchen</button></div>}
      <div className="jackpot-strip" aria-label="Progressive Jackpots">
        {jackpotOrder.map((tier) => {
          const entry = jackpots.find((jackpot) => jackpot.tier === tier);
          return <span key={tier}><small>{jackpotLabels[tier]}</small><strong>{entry ? coinNumber(entry.amount) : "—"}</strong></span>;
        })}
      </div>
      <div className={`reel-frame ${spinning ? "is-spinning" : ""}`} aria-label="Slot-Raster mit fuenf Walzen und drei Reihen" aria-busy={spinning}>
        {reels.map(({ column, reel }) => <div className="reel" key={reel} style={{ "--reel-delay": `${reel * 70}ms` } as React.CSSProperties}>{column.map((symbol, row) => <div className={`symbol ${winCells.has(`${reel}:${row}`) ? "winning" : ""}`} key={`${reel}-${row}`}>{pharaohSymbols[symbol] ? <Image src={pharaohSymbols[symbol]} alt={`Symbol ${symbol}`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} /> : <span className="low-symbol" aria-label={`Symbol ${lowSymbolLabels[symbol] ?? symbol}`}>{lowSymbolLabels[symbol] ?? symbol}</span>}</div>)}</div>)}
      </div>
      <div className="win-panel" aria-live="polite"><span>{message}</span>{win > 0 && <strong>GEWINN {coinNumber(win)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Einsatz verringern"><Minus weight="bold" /></button><span><small>Einsatz</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex === bets.length - 1} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Einsatz erhoehen"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile} aria-label={spinning ? "Walzen drehen" : `Fuer ${coinNumber(bet)} Coins drehen`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? "Dreht" : "Spin"}</span></button>
        <button className="auto-button" disabled><ArrowsClockwise weight="bold" /><span>Auto<em>Bald</em></span></button>
      </div>
      <p className="play-money-notice">Nur zur Unterhaltung · Virtuelle Coins haben keinen Geldwert · Ergebnisse kommen vom Server</p>
    </section>
  </AppShell>;
}
