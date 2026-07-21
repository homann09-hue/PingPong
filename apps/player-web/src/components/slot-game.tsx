"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Minus } from "@phosphor-icons/react/dist/csr/Minus";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { initialGrid, type JackpotTier, type SpinResult } from "@/lib/contracts";
import type { Paytable } from "@/lib/paytable";
import { lowSymbolLabels, symbolAsset, type GameCard } from "@/lib/catalog";
import { coinNumber } from "@/lib/format";
import { usePlayer } from "@/hooks/use-player";
import { WinCelebration, winTierFor } from "./win-celebration";

const jackpotOrder = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;
const jackpotLabels: Readonly<Record<string, string>> = { MINI: "Mini", MINOR: "Minor", MAJOR: "Major", GRAND: "Grand" };
const fallbackBets = [100, 200, 500, 1_000, 2_000, 5_000];

let audioContext: AudioContext | null = null;
/** Kleine synthetische Spielgeraeusche; laeuft nur nach einer Nutzer-Geste. */
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

/** Server-authoritative Slot-Oberflaeche fuer jedes konfigurierte Theme. */
export function SlotGame({ game }: Readonly<{ game: GameCard }>) {
  const { profile, setProfile, error, refresh } = usePlayer();
  const [paytable, setPaytable] = useState<Paytable | null>(null);
  const [betIndex, setBetIndex] = useState(0);
  const [grid, setGrid] = useState(initialGrid);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [win, setWin] = useState(0);
  const [message, setMessage] = useState("Setz deinen Einsatz und dreh los");
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [jackpots, setJackpots] = useState<readonly JackpotTier[]>([]);
  const [celebration, setCelebration] = useState<{ tier: ReturnType<typeof winTierFor>; amount: number } | null>(null);
  const bets = paytable?.betSteps?.length ? paytable.betSteps : fallbackBets;
  const bet = bets[Math.min(betIndex, bets.length - 1)] ?? bets[0]!;
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);
  const grand = jackpots.find((entry) => entry.tier === "GRAND");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/player/jackpots", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { jackpots: JackpotTier[] } : null)
      .then((body) => { if (body && !cancelled) setJackpots(body.jackpots); })
      .catch(() => undefined);
    void fetch(`/api/player/slots/${game.id}/paytable`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Paytable : null)
      .then((body) => { if (body && !cancelled) setPaytable(body); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [game.id]);

  async function spin() {
    if (spinning) return;
    setSpinning(true); setWinCells(new Set()); setWin(0); setCelebration(null); setMessage("Walzen drehen …");
    if (sound) playTones([196, 175, 165], 0.08, "sawtooth", 0.03);
    try {
      const response = await fetch(`/api/player/slots/${game.id}/spins`, {
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
        const tier = winTierFor(body.spin.winClass, body.spin.totalWin / bet);
        if (tier) setCelebration({ tier, amount: body.spin.totalWin });
      } else {
        setMessage("Versuch den naechsten Spin");
      }
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      if (code === "INSUFFICIENT_FUNDS") setMessage("Nicht genug Coins fuer diesen Einsatz – hol dir Gratis-Boni im Shop.");
      else if (code === "HIGH_ROLLER_MEMBERSHIP_REQUIRED") setMessage("Dieser Slot ist dem High Roller Club vorbehalten.");
      else if (code === "RATE_LIMITED") setMessage("Zu viele Spins in kurzer Zeit. Kurz durchatmen und weiter geht es.");
      else setMessage("Der Spin konnte nicht abgeschlossen werden. Dein Guthaben ist sicher.");
    } finally { setSpinning(false); }
  }

  const themeStyle = { "--slot-primary": game.primary, "--slot-secondary": game.secondary } as React.CSSProperties;
  return <AppShell profile={profile}>
    <section className="slot-stage" aria-labelledby="slot-title" style={themeStyle}>
      <Image className="slot-backdrop" src={game.cover} alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      <header className="slot-header">
        <Link href="/" className="back-link" aria-label="Zurueck zur Lobby"><ArrowLeft weight="bold" /> Lobby</Link>
        <div><span>{game.name}</span><h1 id="slot-title">Grand {grand ? coinNumber(grand.amount) : "—"}</h1></div>
        <div className="slot-actions">
          <button className="icon-button" onClick={() => setInfoOpen(true)} aria-label="Gewinntabelle und Regeln"><Info weight="fill" /></button>
          <button className="icon-button" onClick={() => setSound((value) => !value)} aria-pressed={sound} aria-label={sound ? "Ton aus" : "Ton an"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button>
        </div>
      </header>
      {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => void refresh()}>Erneut versuchen</button></div>}
      <div className="jackpot-strip" aria-label="Progressive Jackpots">
        {jackpotOrder.map((tier) => {
          const entry = jackpots.find((jackpot) => jackpot.tier === tier);
          return <span key={tier}><small>{jackpotLabels[tier]}</small><strong>{entry ? coinNumber(entry.amount) : "—"}</strong></span>;
        })}
      </div>
      <div className={`reel-frame ${spinning ? "is-spinning" : ""}`} aria-label="Slot-Raster" aria-busy={spinning}>
        {reels.map(({ column, reel }) => <div className="reel" key={reel} style={{ "--reel-delay": `${reel * 70}ms` } as React.CSSProperties}>
          {/* Laufende Walze: rein dekorativ. Das Ergebnis steht serverseitig
              fest, bevor sich hier etwas bewegt — die Drehung erzaehlt es nur nach. */}
          <div className="reel-strip" aria-hidden="true">
            {[...column, ...column, ...column].map((symbol, index) => {
              const stripAsset = symbolAsset(game.symbolSet, symbol);
              return <div className="symbol strip-symbol" key={`strip-${reel}-${index}`}>
                {stripAsset
                  ? <Image src={stripAsset} alt="" fill sizes="(max-width: 600px) 18vw, 120px" quality={55} />
                  : <span className="low-symbol">{lowSymbolLabels[symbol] ?? symbol}</span>}
              </div>;
            })}
          </div>
          {column.map((symbol, row) => {
          const asset = symbolAsset(game.symbolSet, symbol);
          return <div className={`symbol ${winCells.has(`${reel}:${row}`) ? "winning" : ""}`} key={`${reel}-${row}`}>
            {asset
              ? <Image src={asset} alt={`Symbol ${symbol}`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} />
              : <span className="low-symbol" aria-label={`Symbol ${lowSymbolLabels[symbol] ?? symbol}`}>{lowSymbolLabels[symbol] ?? symbol}</span>}
          </div>;
        })}</div>)}
      </div>
      <div className="win-panel" aria-live="polite"><span>{message}</span>{win > 0 && <strong>GEWINN {coinNumber(win)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Einsatz verringern"><Minus weight="bold" /></button><span><small>Einsatz</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex >= bets.length - 1} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Einsatz erhoehen"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile} aria-label={spinning ? "Walzen drehen" : `Fuer ${coinNumber(bet)} Coins drehen`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? "Dreht" : "Spin"}</span></button>
        <button className="auto-button" disabled><ArrowsClockwise weight="bold" /><span>Auto<em>Bald</em></span></button>
      </div>
      {celebration?.tier && <WinCelebration
        tier={celebration.tier}
        amount={celebration.amount}
        primary={game.primary}
        secondary={game.secondary}
        onDone={() => setCelebration(null)}
      />}
      <p className="play-money-notice">Nur zur Unterhaltung · Virtuelle Coins haben keinen Geldwert · Ergebnisse kommen vom Server</p>

      {infoOpen && <div className="paytable-overlay" role="dialog" aria-modal="true" aria-label="Gewinntabelle" onClick={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}>
        <div className="paytable-panel">
          <header><h2>{game.name}</h2><button onClick={() => setInfoOpen(false)} aria-label="Schliessen"><X weight="bold" /></button></header>
          {paytable ? <>
            <dl className="paytable-facts">
              <div><dt>RTP (Ziel)</dt><dd>{(paytable.targetRtp * 100).toFixed(2)} %</dd></div>
              <div><dt>Volatilitaet</dt><dd>{paytable.volatility ?? "—"}</dd></div>
              <div><dt>Gewinnlinien</dt><dd>{paytable.paylines ?? "—"}</dd></div>
              <div><dt>Max. Gewinn</dt><dd>{paytable.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}×` : "—"}</dd></div>
            </dl>
            <table className="paytable-table">
              <thead><tr><th scope="col">Symbol</th><th scope="col">Auszahlung (× Einsatz)</th></tr></thead>
              <tbody>{Object.entries(paytable.symbols ?? {}).map(([symbol, definition]) => {
                const asset = symbolAsset(game.symbolSet, symbol);
                const payouts = Object.entries(definition.payouts ?? {}).filter(([, value]) => value > 0);
                if (payouts.length === 0) return null;
                return <tr key={symbol}>
                  <th scope="row">{asset ? <Image src={asset} alt="" width={34} height={34} quality={72} /> : <span>{lowSymbolLabels[symbol] ?? symbol}</span>}<em>{definition.kind === "scatter" ? "Scatter" : definition.kind === "wild" ? "Wild" : symbol}</em></th>
                  <td>{payouts.map(([count, value]) => `${count}× = ${value}`).join(" · ")}</td>
                </tr>;
              })}</tbody>
            </table>
          </> : <p className="section-empty">Gewinntabelle wird geladen …</p>}
          <p className="paytable-note">Alle Ergebnisse werden serverseitig ermittelt. Die veroeffentlichten RTP-Werte werden regelmaessig durch deterministische Simulationen geprueft.</p>
        </div>
      </div>}
    </section>
  </AppShell>;
}
