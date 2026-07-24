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

interface ThemeProfile {
  readonly kicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly mechanics: readonly string[];
}

const themeProfiles: Readonly<Record<string, ThemeProfile>> = {
  pharaoh: { kicker: "CURSE OF THE SUN", title: "Pharaoh Oasis", subtitle: "Öffne die goldenen Kammern des Wüstenkönigs.", mechanics: ["EXPANDING WILDS", "MYSTERY REVEALS", "2× FREE SPINS"] },
  dragon: { kicker: "FIRE MOUNTAIN", title: "Dragon Peak", subtitle: "Steig zum Hort über den glühenden Gipfeln auf.", mechanics: ["CASCADES", "DRAGON WILDS", "MULTIPLIER LADDER"] },
  candy: { kicker: "SUGAR RUSH", title: "Candy Carnival", subtitle: "Kaskaden und klebrige Wilds in einer knalligen Süßigkeitenwelt.", mechanics: ["VARIABLE WAYS", "STICKY WILDS", "CANDY CASCADES"] },
  pirate: { kicker: "TREASURE HUNT", title: "Pirate Bay", subtitle: "Folge der Schatzkarte und sammle die Beute der sieben Meere.", mechanics: ["PICK BONUS", "COIN COLLECT", "TREASURE RESPINS"] },
  neon: { kicker: "MIDNIGHT JACKPOT", title: "Neon Nights", subtitle: "High-Roller-Action zwischen Supercars, Licht und Großstadtglanz.", mechanics: ["WALKING WILDS", "2× SYMBOLS", "VIP FREE SPINS"] },
  frozen: { kicker: "ICE QUEEN'S REALM", title: "Frozen Kingdom", subtitle: "Brich das Eis und entfessle besondere Freispielwalzen.", mechanics: ["ICE WILDS", "SPECIAL REELS", "FREE SPIN RETRIGGER"] },
  jungle: { kicker: "LOST TEMPLE", title: "Jungle Temple", subtitle: "Entdecke Idole, Jaguare und das verborgene Tempelrad.", mechanics: ["12× CASCADES", "SYMBOL UPGRADES", "TEMPLE WHEEL"] },
  vegas: { kicker: "CLASSIC JACKPOT", title: "Vegas Gold", subtitle: "Rote Teppiche, goldene Siebener und vier progressive Jackpots.", mechanics: ["BOTH WAYS", "HOLD & WIN", "4 JACKPOTS"] },
  saloon: { kicker: "WANTED DEAD OR WILD", title: "Midnight Saloon", subtitle: "Ein düsterer Wild-West-Slot mit Respins und expandierenden Wilds.", mechanics: ["EXPANDING WILDS", "RESPINS", "2× FREE SPINS"] },
  cosmic: { kicker: "GALACTIC EXPEDITION", title: "Cosmic Voyage", subtitle: "Spring durch Sternentore und sammle kosmische Multiplikatoren.", mechanics: ["WALKING WILDS", "2× MULTIPLIERS", "GALAXY FREE SPINS"] },
};

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
  const [autoRemaining, setAutoRemaining] = useState(0);
  const bets = paytable?.betSteps?.length ? paytable.betSteps : fallbackBets;
  const bet = bets[Math.min(betIndex, bets.length - 1)] ?? bets[0]!;
  const reels = useMemo(() => grid.map((column, reel) => ({ column, reel })), [grid]);
  const grand = jackpots.find((entry) => entry.tier === "GRAND");
  const presentation = themeProfiles[game.symbolSet] ?? { kicker: game.category.toUpperCase(), title: game.name, subtitle: "Ein eigenständiger Themen-Slot.", mechanics: ["WILDS", "BONUS", "FREE SPINS"] };

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
      setAutoRemaining((remaining) => remaining - 1);
    }, turbo ? 320 : 780);
    return () => clearTimeout(timer);
  }, [autoRemaining, spinning, turbo]);

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
      } else setMessage("Versuch den nächsten Spin");
      if (profile) setProfile({ ...profile, coinBalance: body.coinBalance });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SPIN_FAILED";
      if (code === "INSUFFICIENT_FUNDS") setMessage("Nicht genug Coins für diesen Einsatz – öffne den Shop oder Bonusbereich.");
      else if (code === "HIGH_ROLLER_MEMBERSHIP_REQUIRED") setMessage("Dieser Slot ist dem High Roller Club vorbehalten.");
      else if (code === "RATE_LIMITED") setMessage("Zu viele Spins in kurzer Zeit. Kurz durchatmen und weiterspielen.");
      else setMessage("Der Spin konnte nicht abgeschlossen werden. Dein Guthaben ist sicher.");
    } finally { setSpinning(false); }
  }

  const themeStyle = { "--slot-primary": game.primary, "--slot-secondary": game.secondary, "--slot-cover": `url("${game.cover}")` } as React.CSSProperties;
  return <AppShell profile={profile}>
    <section className={`slot-stage ls-slot-machine ls-theme-${game.symbolSet}`} aria-labelledby="slot-title" style={themeStyle}>
      <Image className="slot-backdrop" src={game.cover} alt="" fill priority sizes="100vw" quality={55} />
      <div className="slot-overlay" />
      {!paytable && <div className="slot-intro" role="status" aria-label={`${game.name} wird geladen`}><span className="slot-intro-emblem" aria-hidden="true" /><p className="slot-intro-name">{game.name}</p><span className="slot-intro-bar" aria-hidden="true"><i /></span></div>}

      <header className="slot-header ls-game-toolbar">
        <Link href="/" className="back-link" aria-label="Zurück zur Lobby"><ArrowLeft weight="bold" /> Lobby</Link>
        <div className="ls-slot-wallet"><small>GRAND JACKPOT</small><strong>{grand ? coinNumber(grand.amount) : "—"}</strong></div>
        <div className="slot-actions"><button className="icon-button" onClick={() => setInfoOpen(true)} aria-label="Gewinntabelle und Regeln"><Info weight="fill" /></button><button className="icon-button" onClick={() => setSound((value) => !value)} aria-pressed={sound} aria-label={sound ? "Ton aus" : "Ton an"}>{sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}</button></div>
      </header>

      <div className="ls-theme-marquee"><small>{presentation.kicker}</small><h1 id="slot-title">{presentation.title}</h1><p>{presentation.subtitle}</p><div>{presentation.mechanics.map((mechanic) => <span key={mechanic}>{mechanic}</span>)}</div></div>
      {error && <div className="service-alert" role="status">{error} <button className="alert-retry" onClick={() => void refresh()}>Erneut versuchen</button></div>}

      <div className="jackpot-strip" aria-label="Progressive Jackpots">{jackpotOrder.map((tier) => { const entry = jackpots.find((jackpot) => jackpot.tier === tier); return <span key={tier}><small>{jackpotLabels[tier]}</small><strong>{entry ? coinNumber(entry.amount) : "—"}</strong></span>; })}</div>

      <div className="ls-cabinet-frame">
        <div className="ls-payline-rail left"><i>1</i><i>3</i><i>5</i></div>
        <div className={`reel-frame ${spinning ? "is-spinning" : ""}`} aria-label="Slot-Raster" aria-busy={spinning}>
          {reels.map(({ column, reel }) => <div className="reel" key={reel} style={{ "--reel-delay": `${reel * 140}ms` } as React.CSSProperties}>
            <div className="reel-strip" aria-hidden="true">{[...column, ...column, ...column].map((symbol, index) => { const stripAsset = symbolAsset(game.symbolSet, symbol); return <div className="symbol strip-symbol" key={`strip-${reel}-${index}`}>{stripAsset ? <Image src={stripAsset} alt="" fill sizes="(max-width: 600px) 18vw, 120px" quality={55} /> : <span className="low-symbol">{lowSymbolLabels[symbol] ?? symbol}</span>}</div>; })}</div>
            {column.map((symbol, row) => { const asset = symbolAsset(game.symbolSet, symbol); const winning = winCells.has(`${reel}:${row}`); return <div className={`symbol ${winning ? "winning" : ""}`} key={`${reel}-${row}`}>{hasSymbolArt(game.symbolSet, symbol) ? <SlotSymbol set={game.symbolSet} code={symbol} winning={winning} /> : asset ? <Image src={asset} alt={`Symbol ${symbol}`} fill sizes="(max-width: 600px) 18vw, 120px" quality={72} /> : <span className="low-symbol" aria-label={`Symbol ${lowSymbolLabels[symbol] ?? symbol}`}>{lowSymbolLabels[symbol] ?? symbol}</span>}</div>; })}
          </div>)}
        </div>
        <div className="ls-payline-rail right"><i>2</i><i>4</i><i>6</i></div>
      </div>

      <div className="win-panel" aria-live="polite"><span>{message}</span>{win > 0 && <strong>WIN {coinNumber(win)}</strong>}</div>
      <div className="slot-controls">
        <div className="bet-control"><button disabled={spinning || betIndex === 0} onClick={() => setBetIndex((value) => Math.max(0, value - 1))} aria-label="Einsatz verringern"><Minus weight="bold" /></button><span><small>TOTAL BET</small><strong>{coinNumber(bet)}</strong></span><button disabled={spinning || betIndex >= bets.length - 1} onClick={() => setBetIndex((value) => Math.min(bets.length - 1, value + 1))} aria-label="Einsatz erhöhen"><Plus weight="bold" /></button></div>
        <button className={`turbo-button ${turbo ? "selected" : ""}`} onClick={() => setTurbo((value) => !value)} aria-pressed={turbo}><Lightning weight="fill" /><span>Turbo</span></button>
        <button className="spin-button" onClick={spin} disabled={spinning || !profile} aria-label={spinning ? "Walzen drehen" : `Für ${coinNumber(bet)} Coins drehen`}>{spinning ? <ArrowsClockwise className="spin-icon" weight="bold" /> : <Play weight="fill" />}<span>{spinning ? "DREHT" : "SPIN"}</span></button>
        <button className={autoRemaining > 0 ? "auto-button running" : "auto-button"} onClick={() => (autoRemaining > 0 ? setAutoRemaining(0) : setAutoRemaining(10))} disabled={!profile} aria-label={autoRemaining > 0 ? "Autoplay stoppen" : "10 Runden automatisch drehen"}><ArrowsClockwise weight="bold" /><span>Auto<em>{autoRemaining > 0 ? autoRemaining : "10x"}</em></span></button>
      </div>

      {celebration?.tier && <WinCelebration tier={celebration.tier} amount={celebration.amount} primary={game.primary} secondary={game.secondary} onDone={() => setCelebration(null)} />}
      <p className="play-money-notice">Nur zur Unterhaltung · Virtuelle Coins haben keinen Geldwert · Ergebnisse kommen vom Server</p>

      {infoOpen && <div className="paytable-overlay" role="dialog" aria-modal="true" aria-label="Gewinntabelle" onClick={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}><div className="paytable-panel"><header><h2>{game.name}</h2><button onClick={() => setInfoOpen(false)} aria-label="Schließen"><X weight="bold" /></button></header>{paytable ? <><dl className="paytable-facts"><div><dt>RTP (Ziel)</dt><dd>{(paytable.targetRtp * 100).toFixed(2)} %</dd></div><div><dt>Volatilität</dt><dd>{paytable.volatility ?? "—"}</dd></div><div><dt>Gewinnlinien</dt><dd>{paytable.paylines ?? "—"}</dd></div><div><dt>Max. Gewinn</dt><dd>{paytable.maxWinMultiplier ? `${coinNumber(paytable.maxWinMultiplier)}×` : "—"}</dd></div></dl><table className="paytable-table"><thead><tr><th scope="col">Symbol</th><th scope="col">Auszahlung (× Einsatz)</th></tr></thead><tbody>{Object.entries(paytable.symbols ?? {}).map(([symbol, definition]) => { const asset = symbolAsset(game.symbolSet, symbol); const payouts = Object.entries(definition.payouts ?? {}).filter(([, value]) => value > 0); if (payouts.length === 0) return null; return <tr key={symbol}><th scope="row">{asset ? <Image src={asset} alt="" width={34} height={34} quality={72} /> : <span>{lowSymbolLabels[symbol] ?? symbol}</span>}<em>{definition.kind === "scatter" ? "Scatter" : definition.kind === "wild" ? "Wild" : symbol}</em></th><td>{payouts.map(([count, value]) => `${count}× = ${value}`).join(" · ")}</td></tr>; })}</tbody></table></> : <p className="section-empty">Gewinntabelle wird geladen …</p>}<p className="paytable-note">Alle Ergebnisse werden serverseitig ermittelt. Die veröffentlichten RTP-Werte werden durch deterministische Simulationen geprüft.</p></div></div>}
    </section>
  </AppShell>;
}
