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
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./app-shell";
import { SlotFeatureHud } from "./slot-feature-hud";
import { SlotMechanicFx } from "./slot-mechanic-fx";
import { initialGrid, type JackpotTier, type SpinEvent, type SpinResult, type SpinRound, type SpinRoundPhase, type SpinWin } from "@/lib/contracts";
import type { Paytable } from "@/lib/paytable";
import { presentSpinRound, type RoundPresentation } from "@/lib/slot-round-presentation";
import { presentSlotCell } from "@/lib/slot-cell-presentation";
import { lowSymbolLabels, symbolAsset, type GameCard } from "@/lib/catalog";
import { hasSymbolArt, SlotSymbol } from "@/lib/slot-symbols";
import { coinNumber } from "@/lib/format";
import { usePlayer } from "@/hooks/use-player";
import { WinCelebration, winTierFor } from "./win-celebration";

const jackpotOrder = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;
const jackpotLabels: Readonly<Record<string, string>> = { MINI: "Mini", MINOR: "Minor", MAJOR: "Major", GRAND: "Grand" };
const fallbackBets = [100, 200, 500, 1_000, 2_000, 5_000];
const autoSpinOptions = [10, 25, 50, 100] as const;
const noSpinEvents: readonly SpinEvent[] = [];

type ActiveRoundBanner = RoundPresentation & { readonly key: string };
interface PlayableSpinRound {
  readonly phase: SpinRoundPhase;
  readonly index: number;
  readonly grid: readonly (readonly string[])[];
  readonly wins: readonly SpinWin[];
  readonly totalWin: number;
  readonly events: readonly SpinEvent[];
}

let audioContext: AudioContext | null = null;
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
  } catch { /* Sound ist optional. */ }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function normalizeSpinRounds(body: SpinResult): readonly PlayableSpinRound[] {
  const source: readonly SpinRound[] = body.spin.rounds.length > 0 ? body.spin.rounds : [{
    phase: "base",
    index: 0,
    grid: body.spin.grid,
    wins: body.spin.wins,
    totalWin: body.spin.totalWin,
    events: [],
  }];

  return source.map((round, roundIndex) => ({
    phase: round.phase,
    index: round.index ?? roundIndex,
    grid: round.grid?.length ? round.grid : body.spin.grid,
    wins: round.wins ?? (roundIndex === 0 ? body.spin.wins : []),
    totalWin: round.totalWin,
    events: round.events ?? [],
  }));
}

function useAnimatedNumber(target: number, duration = 650) {
  const [display, setDisplay] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    const start = previous.current;
    previous.current = target;
    if (target === start || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return undefined;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target]);

  return display;
}

export function SlotGame({ game }: Readonly<{ game: GameCard }>) {
  const { profile, setProfile, error, refresh } = usePlayer();
  const [paytable, setPaytable] = useState<Paytable | null>(null);
  const [betIndex, setBetIndex] = useState(0);
  const [grid, setGrid] = useState(initialGrid);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [win, setWin] = useState(0);
  const [message, setMessage] = useState("Setz deinen Einsatz und dreh los");
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(5);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [autoMenuOpen, setAutoMenuOpen] = useState(false);
  const [jackpots, setJackpots] = useState<readonly JackpotTier[]>([]);
  const [celebration, setCelebration] = useState<{ tier: ReturnType<typeof winTierFor>; amount: number } | null>(null);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [roundBanner, setRoundBanner] = useState<ActiveRoundBanner | null>(null);
  const [activeRound, setActiveRound] = useState<PlayableSpinRound | null>(null);
  const animatedWin = useAnimatedNumber(win, turbo ? 240 : 780);
  const bets = paytable?.betSteps?.length ? paytable.betSteps : fallbackBets;
  const bet = bets[Math.min(betIndex, bets.length - 1)] ?? bets[0]!;
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);
  const grand = jackpots.find((entry) => entry.tier === "GRAND");
  const activeEvents = activeRound?.events ?? noSpinEvents;

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

  const spinRef = useRef(spin);
  useEffect(() => { spinRef.current = spin; });
  useEffect(() => {
    if (autoRemaining <= 0 || spinning) return undefined;
    const timer = setTimeout(() => {
      void spinRef.current();
      setAutoRemaining((remaining) => Math.max(0, remaining - 1));
    }, turbo ? 320 : 780);
    return () => clearTimeout(timer);
  }, [autoRemaining, spinning, turbo]);

  async function revealRoundGrid(round: PlayableSpinRound, animateReels: boolean) {
    setGrid(round.grid);
    setWinCells(new Set(round.wins.flatMap((entry) => entry.cells.map(([reel, row]) => `${reel}:${row}`))));
    const reelCount = round.grid.length;
    setStoppedReels(0);

    if (!animateReels) {
      await wait(turbo ? 45 : 110);
      setStoppedReels(reelCount);
      return;
    }

    const step = turbo ? 45 : 125;
    for (let reel = 1; reel <= reelCount; reel += 1) {
      await wait(step);
      setStoppedReels(reel);
      if (sound && !turbo) playTones([210 + reel * 35], 0.04, "triangle", 0.025);
    }
  }

  async function revealResult(body: SpinResult) {
    const rounds = normalizeSpinRounds(body);
    let cumulativeWin = 0;

    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
      const round = rounds[roundIndex]!;
      const presentation = presentSpinRound(round, game.mechanicLabel);
      setActiveRound(round);
      setRoundBanner({ ...presentation, key: `${round.phase}-${round.index}-${roundIndex}` });
      setMessage(presentation.detail);
      await revealRoundGrid(round, roundIndex === 0);
      cumulativeWin += round.totalWin;
      setWin(cumulativeWin);

      if (sound && round.phase !== "base") {
        playTones(round.totalWin > 0 ? [392, 523, 659] : [294, 392], 0.08, "triangle", 0.035);
      }
      await wait(turbo ? 120 : round.phase === "base" ? 320 : 1_050);
    }

    setWin(body.spin.totalWin);
    setActiveRound(null);
    setRoundBanner(null);
  }

  async function spin() {
    if (spinning) return;
    setAutoMenuOpen(false);
    setSpinning(true);
    setStoppedReels(0);
    setWinCells(new Set());
    setWin(0);
    setCelebration(null);
    setActiveRound(null);
    setRoundBanner(null);
    setMessage(turbo ? "Turbo-Spin läuft …" : "Walzen drehen …");
    if (sound) playTones([196, 175, 165], 0.08, "sawtooth", 0.03);
    try {
      const response = await fetch(`/api/player/slots/${game.id}/spins`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ bet, bonusBuy: false }),
      });
      const body = await response.json() as SpinResult & { code?: string };
      if (!response.ok) throw new Error(body.code ?? "SPIN_FAILED");
      await wait(turbo ? 80 : 260);
      await revealResult(body);
      setWin(body.spin.totalWin);
      if (body.jackpots) setJackpots(body.jackpots);
      if (body.spin.totalWin > 0) {
        setMessage(`${body.spin.winClass ?? "GEWINN"} · ${coinNumber(body.spin.totalWin)} Coins`);
        if (sound) playTones([523, 659, 784, 1047], 0.1, "triangle", 0.05);
        const tier = winTierFor(body.spin.winClass, body.spin.totalWin / bet);
        if (tier) setCelebration({ tier, amount: body.spin.totalWin });
      } else {
        setMessage("Versuch den nächsten Spin");
      }
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      setStoppedReels(5);
      setAutoRemaining(0);
      setActiveRound(null);
      setRoundBanner(null);
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      if (code === "INSUFFICIENT_FUNDS") setMessage("Nicht genug Coins für diesen Einsatz – hol dir Gratis-Boni im Shop.");
      else if (code === "HIGH_ROLLER_MEMBERSHIP_REQUIRED") setMessage("Dieser Slot ist dem High Roller Club vorbehalten.");
      else if (code === "RATE_LIMITED") setMessage("Zu viele Spins in kurzer Zeit. Kurz durchatmen und weiter geht es.");
      else setMessage("Der Spin konnte nicht abgeschlossen werden. Dein Guthaben ist sicher.");
    } finally {
      setSpinning(false);
    }
  }

  function startAutoSpins(rounds: number) {
    if (!profile || spinning) return;
    setAutoMenuOpen(false);
    setAutoRemaining(rounds);
    setMessage(`Auto-Spin gestartet · ${rounds} Runden`);
  }

  function stopAutoSpins() {
    setAutoRemaining(0);
    setAutoMenuOpen(false);
    setMessage("Auto-Spin gestoppt");
  }

  const themeStyle = {
    "--slot-primary": game.primary,
    "--slot-secondary": game.secondary,
    "--slot-cover": `url("${game.cover}")`,
    "--world-marquee": `"${game.marquee}"`,
    "--world-mechanic": `"${game.mechanicLabel}"`,
  } as React.CSSProperties;

  return <AppShell profile={profile}>
    <section
      className={`slot-stage slot-world-${game.cabinet}`}
      data-cabinet={game.cabinet}
      data-spin-phase={activeRound?.phase ?? (spinning ? "base" : "idle")}
      aria-labelledby="slot-title"
      aria-describedby="slot-atmosphere"
      style={themeStyle}
    >
      <Image className="slot-backdrop" src={game.cover} alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      <p id="slot-atmosphere" className="slot-atmosphere">{game.atmosphere}</p>
      {activeRound && <SlotMechanicFx phase={activeRound.phase} index={activeRound.index} totalWin={activeRound.totalWin} events={activeEvents} cabinet={game.cabinet} />}
      {roundBanner && <div key={roundBanner.key} className="slot-round-banner" data-tone={roundBanner.tone} role="status" aria-live="polite"><strong>{roundBanner.label}</strong><span>{roundBanner.detail}</span></div>}
      {!paytable && <div className="slot-intro" role="status" aria-label={`${game.name} wird geladen`}><span className="slot-intro-emblem" aria-hidden="true" /><p className="slot-intro-name">{game.name}</p><span className="slot-intro-bar" aria-hidden="true"><i /></span></div>}
      <header className="slot-header">
        <Link href="/" className="back-link" aria-label="Zurück zur Lobby"><ArrowLeft weight="bold" /> Lobby</Link>
        <div><span>{game.name}</span><h1 id="slot-title">Grand {grand ? coinNumber(grand.amount) : "—"}</h1></div>
        <div className="slot-actions">
          <button className="icon-button" onClick={() => setInfoOpen(true)} aria-label="Gewinntabelle und Regeln"><Info weight="fill" /></button>
          <button className="icon-button" onClick={() => setSound((value) => !value)} aria-pressed={sound} aria-label={sound ? "Ton aus" : "Ton an"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button>
        </div>
      </header>
      {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => void refresh()}>Erneut versuchen</button></div>}
      <div className="jackpot-strip" aria-label="Progressive Jackpots">{jackpotOrder.map((tier) => { const entry = jackpots.find((jackpot) => jackpot.tier === tier); return <span key={tier}><small>{jackpotLabels[tier]}</small><strong>{entry ? coinNumber(entry.amount) : "—"}</strong></span>; })}</div>
      <SlotFeatureHud active={Boolean(activeRound)} phase={activeRound?.phase} index={activeRound?.index} totalWin={activeRound?.totalWin} events={activeEvents} mechanicLabel={game.mechanicLabel} cabinet={game.cabinet} />
      <div className={`reel-frame ${spinning ? "is-spinning" : ""}`} aria-label="Slot-Raster" aria-busy={spinning}>
        <div className="spin-status" aria-hidden="true"><span>{turbo ? "TURBO" : "SPIN"}</span><i style={{ width: `${Math.max(0, Math.min(100, (stoppedReels / Math.max(1, reels.length)) * 100))}%` }} /></div>
        {reels.map(({ column, reel }) => <div className={`reel ${reel < stoppedReels ? "is-stopped" : "is-running"}`} key={reel} style={{ "--reel-delay": `${reel * 140}ms` } as React.CSSProperties}>
          <div className="reel-strip" aria-hidden="true">{[...column, ...column, ...column].map((symbol, index) => { const stripAsset = symbolAsset(game.symbolSet, symbol); return <div className="symbol strip-symbol" key={`strip-${reel}-${index}`}>{stripAsset ? <Image src={stripAsset} alt="" fill sizes="(max-width: 600px) 18vw, 120px" quality={55} /> : <span className="low-symbol">{lowSymbolLabels[symbol] ?? symbol}</span>}</div>; })}</div>
          {column.map((symbol, row) => {
            const asset = symbolAsset(game.symbolSet, symbol);
            const winning = winCells.has(`${reel}:${row}`);
            const cell = presentSlotCell(activeEvents, reel, row, symbol);
            return <div className={`symbol ${winning ? "winning" : ""} ${cell.className}`} key={`${reel}-${row}`} title={cell.description} data-feature-cell={cell.description ? "true" : undefined}>
              {hasSymbolArt(game.symbolSet, symbol) ? <SlotSymbol set={game.symbolSet} code={symbol} winning={winning} /> : asset ? <Image src={asset} alt={`Symbol ${symbol}`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} /> : <span className="low-symbol" aria-label={`Symbol ${lowSymbolLabels[symbol] ?? symbol}`}>{lowSymbolLabels[symbol] ?? symbol}</span>}
              {cell.badge && <span className="slot-cell-badge" aria-hidden="true">{cell.badge}</span>}
              {cell.className && <span className="slot-cell-frame" aria-hidden="true" />}
            </div>;
          })}
        </div>)}
      </div>
      <div className={`win-panel ${win > 0 ? "has-win" : ""}`} aria-live="polite"><span>{message}</span>{win > 0 && <strong>GEWINN {coinNumber(animatedWin)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0 || autoRemaining > 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Einsatz verringern"><Minus weight="bold" /></button><span><small>Einsatz</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex >= bets.length - 1 || autoRemaining > 0} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Einsatz erhöhen"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile || autoRemaining > 0} aria-label={spinning ? "Walzen drehen" : `Für ${coinNumber(bet)} Coins drehen`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? `${stoppedReels}/${reels.length}` : "Spin"}</span></button>
        <div className={`auto-spin-control ${autoMenuOpen ? "is-open" : ""}`}>
          {autoMenuOpen && autoRemaining === 0 && <div className="auto-spin-menu" role="menu" aria-label="Auto-Spin Runden wählen"><strong>Auto-Spin</strong><small>Anzahl der Runden</small><div>{autoSpinOptions.map((rounds) => <button key={rounds} type="button" role="menuitem" onClick={() => startAutoSpins(rounds)}>{rounds}</button>)}</div></div>}
          <button className={autoRemaining > 0 ? "auto-button running" : "auto-button"} onClick={() => autoRemaining > 0 ? stopAutoSpins() : setAutoMenuOpen((value) => !value)} disabled={!profile || spinning} aria-expanded={autoMenuOpen} aria-label={autoRemaining > 0 ? `Autoplay stoppen, ${autoRemaining} Runden verbleiben` : "Auto-Spin Auswahl öffnen"}><ArrowsClockwise weight="bold" /><span>{autoRemaining > 0 ? "Stop" : "Auto"}<em>{autoRemaining > 0 ? autoRemaining : "Auswahl"}</em></span></button>
        </div>
      </div>
      {celebration?.tier && <WinCelebration tier={celebration.tier} amount={celebration.amount} primary={game.primary} secondary={game.secondary} onDone={() => setCelebration(null)} />}
      <p className="play-money-notice">Nur zur Unterhaltung · Virtuelle Coins haben keinen Geldwert · Ergebnisse kommen vom Server</p>
      {infoOpen && <div className="paytable-overlay" role="dialog" aria-modal="true" aria-label="Gewinntabelle" onClick={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}><div className="paytable-panel"><header><h2>{game.name}</h2><button onClick={() => setInfoOpen(false)} aria-label="Schließen"><X weight="bold" /></button></header>{paytable ? <><dl className="paytable-facts"><div><dt>RTP (Ziel)</dt><dd>{(paytable.targetRtp * 100).toFixed(2)} %</dd></div><div><dt>Volatilität</dt><dd>{paytable.volatility ?? "—"}</dd></div><div><dt>Gewinnlinien</dt><dd>{paytable.paylines ?? "—"}</dd></div><div><dt>Max. Gewinn</dt><dd>{paytable.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}×` : "—"}</dd></div></dl><table className="paytable-table"><thead><tr><th scope="col">Symbol</th><th scope="col">Auszahlung (× Einsatz)</th></tr></thead><tbody>{Object.entries(paytable.symbols ?? {}).map(([symbol, definition]) => { const asset = symbolAsset(game.symbolSet, symbol); const payouts = Object.entries(definition.payouts ?? {}).filter(([, value]) => value > 0); if (payouts.length === 0) return null; return <tr key={symbol}><th scope="row">{asset ? <Image src={asset} alt="" width={34} height={34} quality={72} /> : <span>{lowSymbolLabels[symbol] ?? symbol}</span>}<em>{definition.kind === "scatter" ? "Scatter" : definition.kind === "wild" ? "Wild" : symbol}</em></th><td>{payouts.map(([count, value]) => `${count}× = ${value}`).join(" · ")}</td></tr>; })}</tbody></table></> : <p className="section-empty">Gewinntabelle wird geladen …</p>}<p className="paytable-note">Alle Ergebnisse werden serverseitig ermittelt. Die veröffentlichten RTP-Werte werden regelmäßig durch deterministische Simulationen geprüft.</p></div></div>}
    </section>
  </AppShell>;
}
