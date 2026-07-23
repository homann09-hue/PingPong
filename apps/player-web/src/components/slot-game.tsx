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
import { initialGrid, type JackpotTier, type SpinResult } from "@/lib/contracts";
import type { Paytable } from "@/lib/paytable";
import { lowSymbolLabels, symbolAsset, type GameCard } from "@/lib/catalog";
import { hasSymbolArt, SlotSymbol } from "@/lib/slot-symbols";
import { coinNumber } from "@/lib/format";
import { usePlayer } from "@/hooks/use-player";
import { WinCelebration, winTierFor } from "./win-celebration";

const jackpotOrder = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;
const jackpotLabels: Readonly<Record<string, string>> = { MINI: "Mini", MINOR: "Minor", MAJOR: "Major", GRAND: "Grand" };
const fallbackBets = [100, 200, 500, 1_000, 2_000, 5_000];
type FeaturePresentation = {
  readonly mode: "wheel" | "pick" | "hold" | "free_spins" | "jackpot" | "bonus";
  readonly title: string;
  readonly subtitle: string;
  readonly amount: number;
  readonly multiplier?: number;
  readonly count?: number;
};

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

function presentationFromSpin(body: SpinResult): FeaturePresentation | null {
  const bonusRound = body.spin.rounds.find((round) => round.phase === "bonus");
  const bonusEvent = bonusRound?.events?.find((event) => event.type === "bonus.awarded");
  if (bonusRound && bonusEvent) {
    const mode = String(bonusEvent.data?.mode ?? "bonus");
    const multiplier = Number(bonusEvent.data?.multiplier ?? 0) || undefined;
    const tier = typeof bonusEvent.data?.tier === "string" ? bonusEvent.data.tier : undefined;
    const title = mode === "wheel" ? "Riesiger Dreh"
      : mode === "pick" ? "Pick a Vault"
      : mode === "hold_and_win" ? "Hold & Spin"
      : mode === "jackpot" ? `${tier ?? "Mega"} Jackpot`
      : mode === "coin_collect" ? "Coin Collect"
      : "Bonus Game";
    const presentationMode: FeaturePresentation["mode"] = mode === "wheel" ? "wheel"
      : mode === "pick" ? "pick"
      : mode === "hold_and_win" || mode === "coin_collect" ? "hold"
      : mode === "jackpot" ? "jackpot"
      : "bonus";
    return {
      mode: presentationMode,
      title,
      subtitle: multiplier ? `${multiplier}× Einsatz gewonnen` : "Feature gewonnen",
      amount: bonusRound.totalWin,
      multiplier,
    };
  }
  if (body.spin.freeSpinsPlayed > 0) {
    return {
      mode: "free_spins",
      title: "Free Spins",
      subtitle: `${body.spin.freeSpinsPlayed} Freispiele gespielt`,
      amount: body.spin.rounds.filter((round) => round.phase === "free_spin").reduce((sum, round) => sum + round.totalWin, 0),
      count: body.spin.freeSpinsPlayed,
    };
  }
  const respins = body.spin.rounds.filter((round) => round.phase === "respin");
  if (respins.length > 0) {
    return {
      mode: "hold",
      title: "Respins",
      subtitle: `${respins.length} Lock-&-Respin Runden`,
      amount: respins.reduce((sum, round) => sum + round.totalWin, 0),
      count: respins.length,
    };
  }
  return null;
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
  const [presentationOpen, setPresentationOpen] = useState(true);
  const [jackpots, setJackpots] = useState<readonly JackpotTier[]>([]);
  const [celebration, setCelebration] = useState<{ tier: ReturnType<typeof winTierFor>; amount: number } | null>(null);
  const [featurePresentation, setFeaturePresentation] = useState<FeaturePresentation | null>(null);
  const bets = paytable?.betSteps?.length ? paytable.betSteps : fallbackBets;
  const bet = bets[Math.min(betIndex, bets.length - 1)] ?? bets[0]!;
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);
  const grand = jackpots.find((entry) => entry.tier === "GRAND");

  useEffect(() => {
    let cancelled = false;
    setPresentationOpen(true);
    const introTimer = window.setTimeout(() => setPresentationOpen(false), 2600);
    void fetch("/api/player/jackpots", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { jackpots: JackpotTier[] } : null)
      .then((body) => { if (body && !cancelled) setJackpots(body.jackpots); })
      .catch(() => undefined);
    void fetch(`/api/player/slots/${game.id}/paytable`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Paytable : null)
      .then((body) => { if (body && !cancelled) setPaytable(body); })
      .catch(() => undefined);
    return () => { cancelled = true; window.clearTimeout(introTimer); };
  }, [game.id]);

  // Autoplay: dreht bis zu N Runden automatisch. Der "latest ref"-Zeiger haelt
  // stets die aktuelle spin-Funktion, damit kein veralteter Closure-Stand
  // (Einsatz, Kontostand) verwendet wird. Der Effekt startet die naechste Runde
  // erst, wenn die vorige fertig ist â keine Timer-Kollision, terminiert nach N.
  const [autoRemaining, setAutoRemaining] = useState(0);
  const spinRef = useRef(spin);
  useEffect(() => { spinRef.current = spin; });
  useEffect(() => {
    if (autoRemaining <= 0 || spinning) return undefined;
    const timer = setTimeout(() => {
      void spinRef.current();
      setAutoRemaining((remaining) => remaining - 1);
    }, turbo ? 320 : 780);
    return () => clearTimeout(timer);
  }, [autoRemaining, spinning, turbo]);

  async function spin() {
    if (spinning) return;
    setSpinning(true); setWinCells(new Set()); setWin(0); setCelebration(null); setFeaturePresentation(null); setMessage("Walzen drehen â¦");
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
      const feature = presentationFromSpin(body);
      if (feature) {
        window.setTimeout(() => setFeaturePresentation(feature), turbo ? 260 : 580);
      }
      if (body.spin.totalWin > 0) {
        setMessage(`${body.spin.winClass ?? "GEWINN"} Â· ${coinNumber(body.spin.totalWin)} Coins`);
        if (sound) playTones([523, 659, 784, 1047], 0.1, "triangle", 0.05);
        const tier = winTierFor(body.spin.winClass, body.spin.totalWin / bet);
        if (tier) setCelebration({ tier, amount: body.spin.totalWin });
      } else {
        setMessage("Versuch den naechsten Spin");
      }
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      if (code === "INSUFFICIENT_FUNDS") setMessage("Nicht genug Coins fuer diesen Einsatz â hol dir Gratis-Boni im Shop.");
      else if (code === "HIGH_ROLLER_MEMBERSHIP_REQUIRED") setMessage("Dieser Slot ist dem High Roller Club vorbehalten.");
      else if (code === "RATE_LIMITED") setMessage("Zu viele Spins in kurzer Zeit. Kurz durchatmen und weiter geht es.");
      else setMessage("Der Spin konnte nicht abgeschlossen werden. Dein Guthaben ist sicher.");
    } finally { setSpinning(false); }
  }

  const themeStyle = { "--slot-primary": game.primary, "--slot-secondary": game.secondary,
    // Die Cover-Kunst des Slots dient als Blickfang am Bildrand â eigene
    // Grafik, kein zusaetzliches Asset noetig.
    "--slot-cover": `url("${game.cover}")` } as React.CSSProperties;
  return <AppShell profile={profile}>
    <section
      className={`slot-stage ${spinning ? "slot-is-spinning" : ""} ${win > 0 ? "slot-has-win" : ""}`}
      aria-labelledby="slot-title"
      style={themeStyle}
    >
      <Image className="slot-backdrop" src={game.cover} alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      <div className="slot-cinematic-rig" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="stage-coin-burst" aria-hidden="true">
        {Array.from({ length: 34 }, (_, index) => <i key={index} style={{ "--coin-index": index } as React.CSSProperties} />)}
      </div>
      {presentationOpen && (
        <div className="slot-presentation" aria-hidden="true">
          <Image className="slot-presentation-art" src={game.cover} alt="" fill priority sizes="100vw" quality={82} />
          <div className="presentation-spotlights"><i /><i /><i /></div>
          <div className="presentation-confetti">
            {Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--confetti-index": index } as React.CSSProperties} />)}
          </div>
          <div className="presentation-card">
            <span className="presentation-kicker">NEW MEGA SLOT</span>
            <strong>{game.name}</strong>
            <small>{game.features}</small>
            <span className="presentation-progress"><i /></span>
          </div>
        </div>
      )}
      {!paytable && (
        <div className="slot-intro" role="status" aria-label={`${game.name} wird geladen`}>
          <span className="slot-intro-emblem" aria-hidden="true" />
          <p className="slot-intro-name">{game.name}</p>
          <span className="slot-intro-bar" aria-hidden="true"><i /></span>
        </div>
      )}
      <header className="slot-header">
        <Link href="/" className="back-link" aria-label="Zurueck zur Lobby"><ArrowLeft weight="bold" /> Lobby</Link>
        <div><span>{game.name}</span><h1 id="slot-title">Grand {grand ? coinNumber(grand.amount) : "â"}</h1></div>
        <div className="slot-actions">
          <button className="icon-button" onClick={() => setInfoOpen(true)} aria-label="Gewinntabelle und Regeln"><Info weight="fill" /></button>
          <button className="icon-button" onClick={() => setSound((value) => !value)} aria-pressed={sound} aria-label={sound ? "Ton aus" : "Ton an"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button>
        </div>
      </header>
      {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => void refresh()}>Erneut versuchen</button></div>}
      <div className="slot-motion-hud" aria-hidden="true">
        <span className="hud-badge">VIP BOOM</span>
        <strong>{game.name}</strong>
        <span className="hud-badge hud-badge-hot">FREE SPINS</span>
      </div>
      <div className="jackpot-strip" aria-label="Progressive Jackpots">
        {jackpotOrder.map((tier) => {
          const entry = jackpots.find((jackpot) => jackpot.tier === tier);
          return <span key={tier}><small>{jackpotLabels[tier]}</small><strong>{entry ? coinNumber(entry.amount) : "â"}</strong></span>;
        })}
      </div>
      <div className="slot-fx-layer" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <span key={index} style={{ "--fx-index": index } as React.CSSProperties} />)}
      </div>
      <div className="premium-cabinet-top" aria-hidden="true">
        <i /><strong>{game.name}</strong><i />
      </div>
      <div className="slot-showcase-rail" aria-hidden="true">
        <span><Image src={game.cover} alt="" fill sizes="150px" quality={72} /></span>
        <em>SUPER FEATURE</em>
        <strong>FREE SPINS</strong>
      </div>
      <aside className="slot-reward-ladder" aria-hidden="true">
        <strong>REWARDS</strong>
        {[...jackpotOrder].reverse().map((tier, index) => {
          const entry = jackpots.find((jackpot) => jackpot.tier === tier);
          return <span key={tier} style={{ "--ladder-index": index } as React.CSSProperties}>
            <small>{jackpotLabels[tier]}</small>
            <em>{entry ? coinNumber(entry.amount) : "—"}</em>
          </span>;
        })}
      </aside>
      <div className={`reel-frame ${spinning ? "is-spinning" : ""} ${win > 0 ? "has-win" : ""} ${turbo ? "is-turbo" : ""}`} aria-label="Slot-Raster" aria-busy={spinning}>
        <div className="cabinet-bulbs" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
        {reels.map(({ column, reel }) => <div className="reel" key={reel} style={{ "--reel-delay": `${reel * 140}ms` } as React.CSSProperties}>
          {/* Laufende Walze: rein dekorativ. Das Ergebnis steht serverseitig
              fest, bevor sich hier etwas bewegt â die Drehung erzaehlt es nur nach. */}
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
          return <div className={`symbol ${winCells.has(`${reel}:${row}`) ? "winning" : ""}`} key={`${reel}-${row}`}>{hasSymbolArt(game.symbolSet, symbol) ? <SlotSymbol set={game.symbolSet} code={symbol} winning={winCells.has(`${reel}:${row}`)} /> : asset
              ? <Image src={asset} alt={`Symbol ${symbol}`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} />
              : <span className="low-symbol" aria-label={`Symbol ${lowSymbolLabels[symbol] ?? symbol}`}>{lowSymbolLabels[symbol] ?? symbol}</span>}</div>;
        })}</div>)}
      </div>
      <div className="feature-tease-panel" aria-hidden="true">
        <span>Pick a Vault</span>
        <strong>{win > 0 ? "Reward unlocked!" : spinning ? "Hold for feature!" : "3 bonus symbols unlock"}</strong>
        <i />
      </div>
      <div className="win-panel" aria-live="polite"><span>{message}</span>{win > 0 && <strong>GEWINN {coinNumber(win)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Einsatz verringern"><Minus weight="bold" /></button><span><small>Einsatz</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex >= bets.length - 1} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Einsatz erhoehen"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile} aria-label={spinning ? "Walzen drehen" : `Fuer ${coinNumber(bet)} Coins drehen`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? "Dreht" : "Spin"}</span></button>
        <button
            className={autoRemaining > 0 ? "auto-button running" : "auto-button"}
            onClick={() => (autoRemaining > 0 ? setAutoRemaining(0) : setAutoRemaining(10))}
            disabled={!profile}
            aria-label={autoRemaining > 0 ? "Autoplay stoppen" : "10 Runden automatisch drehen"}
          ><ArrowsClockwise weight="bold" /><span>Auto<em>{autoRemaining > 0 ? autoRemaining : "10x"}</em></span></button>
      </div>
      {celebration?.tier && <WinCelebration
        tier={celebration.tier}
        amount={celebration.amount}
        primary={game.primary}
        secondary={game.secondary}
        onDone={() => setCelebration(null)}
      />}
      {featurePresentation && <FeatureOverlay
        presentation={featurePresentation}
        primary={game.primary}
        secondary={game.secondary}
        onDone={() => setFeaturePresentation(null)}
      />}
      <p className="play-money-notice">Nur zur Unterhaltung Â· Virtuelle Coins haben keinen Geldwert Â· Ergebnisse kommen vom Server</p>

      {infoOpen && <div className="paytable-overlay" role="dialog" aria-modal="true" aria-label="Gewinntabelle" onClick={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}>
        <div className="paytable-panel">
          <header><h2>{game.name}</h2><button onClick={() => setInfoOpen(false)} aria-label="Schliessen"><X weight="bold" /></button></header>
          {paytable ? <>
            <dl className="paytable-facts">
              <div><dt>RTP (Ziel)</dt><dd>{(paytable.targetRtp * 100).toFixed(2)} %</dd></div>
              <div><dt>Volatilitaet</dt><dd>{paytable.volatility ?? "â"}</dd></div>
              <div><dt>Gewinnlinien</dt><dd>{paytable.paylines ?? "â"}</dd></div>
              <div><dt>Max. Gewinn</dt><dd>{paytable.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}Ã` : "â"}</dd></div>
            </dl>
            <table className="paytable-table">
              <thead><tr><th scope="col">Symbol</th><th scope="col">Auszahlung (Ã Einsatz)</th></tr></thead>
              <tbody>{Object.entries(paytable.symbols ?? {}).map(([symbol, definition]) => {
                const asset = symbolAsset(game.symbolSet, symbol);
                const payouts = Object.entries(definition.payouts ?? {}).filter(([, value]) => value > 0);
                if (payouts.length === 0) return null;
                return <tr key={symbol}>
                  <th scope="row">{asset ? <Image src={asset} alt="" width={34} height={34} quality={72} /> : <span>{lowSymbolLabels[symbol] ?? symbol}</span>}<em>{definition.kind === "scatter" ? "Scatter" : definition.kind === "wild" ? "Wild" : symbol}</em></th>
                  <td>{payouts.map(([count, value]) => `${count}Ã = ${value}`).join(" Â· ")}</td>
                </tr>;
              })}</tbody>
            </table>
          </> : <p className="section-empty">Gewinntabelle wird geladen â¦</p>}
          <p className="paytable-note">Alle Ergebnisse werden serverseitig ermittelt. Die veroeffentlichten RTP-Werte werden regelmaessig durch deterministische Simulationen geprueft.</p>
        </div>
      </div>}
    </section>
  </AppShell>;
}

function FeatureOverlay({
  presentation, primary, secondary, onDone,
}: Readonly<{
  presentation: FeaturePresentation;
  primary: string;
  secondary: string;
  onDone: () => void;
}>) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, presentation.mode === "wheel" ? 4200 : 3600);
    return () => window.clearTimeout(timer);
  }, [onDone, presentation.mode]);

  const wheelSegments = [2, 3, 5, 8, 10, 15, 20, presentation.multiplier ?? 25];
  const picks = Array.from({ length: 9 }, (_, index) => index);
  return <div
    className={`feature-overlay feature-${presentation.mode}`}
    style={{ "--slot-primary": primary, "--slot-secondary": secondary } as React.CSSProperties}
    role="dialog"
    aria-modal="true"
    aria-label={presentation.title}
    onClick={onDone}
  >
    <div className="feature-orbit" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} style={{ "--orbit-index": index } as React.CSSProperties} />)}</div>
    <div className="feature-stage-card" onClick={(event) => event.stopPropagation()}>
      <span className="feature-ribbon">BONUS FEATURE</span>
      <h2>{presentation.title}</h2>
      <p>{presentation.subtitle}</p>
      {presentation.mode === "wheel" && <div className="bonus-wheel" aria-hidden="true">
        {wheelSegments.map((segment, index) => <span key={`${segment}-${index}`} style={{ "--segment-index": index } as React.CSSProperties}>{segment}×</span>)}
        <strong>{presentation.multiplier ?? 25}×</strong>
      </div>}
      {(presentation.mode === "pick" || presentation.mode === "hold" || presentation.mode === "jackpot" || presentation.mode === "bonus") && <div className="bonus-vault-grid" aria-hidden="true">
        {picks.map((index) => <span key={index} className={index < 3 ? "picked" : ""}><i />{index < 3 ? "WIN" : "?"}</span>)}
      </div>}
      {presentation.mode === "free_spins" && <div className="free-spin-stack" aria-hidden="true">
        {Array.from({ length: Math.min(8, presentation.count ?? 5) }, (_, index) => <span key={index}>FREE<br />SPIN</span>)}
      </div>}
      <strong className="feature-amount">{coinNumber(presentation.amount)}</strong>
      <button type="button" onClick={onDone}>Weiter</button>
    </div>
  </div>;
}
