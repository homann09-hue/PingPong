"use client";

import { Confetti } from "@phosphor-icons/react/dist/csr/Confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { coinNumber } from "@/lib/format";

interface WheelSegment {
  readonly id: string;
  readonly currency: "coin" | "gem";
  readonly amount: number;
}

interface WheelStatus {
  readonly availableSpins: number;
  readonly segments: readonly WheelSegment[];
}

interface WheelSpinResult {
  readonly segmentId: string;
  readonly rewardCurrency: "coin" | "gem";
  readonly rewardAmount: number;
  readonly availableSpins: number;
}

const palette = ["#7b2cff", "#35e8ff", "#ff35dc", "#94ff4d", "#ffc72c", "#ff7a35", "#3f7bff"];

function segmentLabel(segment: WheelSegment): string {
  return segment.currency === "gem" ? `${segment.amount} Gems` : coinNumber(segment.amount);
}

export function LuckyWheel({ onRewardGranted }: Readonly<{ onRewardGranted: () => void }>) {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelSpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/player/rewards/wheels/standard", { cache: "no-store" });
      if (response.ok) setStatus(await response.json() as WheelStatus);
    } catch {
      // The wheel remains visible but disabled when its server status is unavailable.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function spin() {
    if (spinning || !status || status.availableSpins < 1) return;
    setSpinning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/player/rewards/wheels/standard/spin", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        setError(body?.code === "WHEEL_NOT_AVAILABLE"
          ? "Gerade kein Dreh verfügbar — hol dir erst deine Zeitbelohnungen ab."
          : "Das hat gerade nicht geklappt.");
        setSpinning(false);
        return;
      }
      const spinResult = await response.json() as WheelSpinResult;
      const index = status.segments.findIndex((segment) => segment.id === spinResult.segmentId);
      const slice = 360 / status.segments.length;
      const target = 360 - (index * slice + slice / 2);
      const turns = reducedMotion.current ? 0 : 5;
      setAngle((previous) => previous + turns * 360 + ((target - (previous % 360)) + 360) % 360);
      const settle = reducedMotion.current ? 120 : 4200;
      window.setTimeout(() => {
        setResult(spinResult);
        setStatus((previous) => previous ? { ...previous, availableSpins: spinResult.availableSpins } : previous);
        setSpinning(false);
        onRewardGranted();
      }, settle);
    } catch {
      setError("Verbindung unterbrochen.");
      setSpinning(false);
    }
  }

  const segments = status?.segments ?? [];
  const slice = segments.length > 0 ? 360 / segments.length : 0;
  const gradient = segments.length > 0
    ? `conic-gradient(${segments.map((segment, index) => `${palette[index % palette.length]} ${index * slice}deg ${(index + 1) * slice}deg`).join(", ")})`
    : "none";
  const live = spinning || result !== null;

  return <section className="fl-system-section fl-wheel-system" id="lucky-wheel" aria-labelledby="lucky-wheel-title">
    <header className="fl-system-heading">
      <div><span><Confetti weight="fill" /> Bonus Feature</span><h2 id="lucky-wheel-title">Lucky Wheel</h2></div>
      <strong>{status ? `${status.availableSpins} FREE SPIN${status.availableSpins === 1 ? "" : "S"}` : "LOADING"}</strong>
    </header>

    <div className={live ? "wheel-card fl-wheel-card is-live" : "wheel-card fl-wheel-card"}>
      <div className="fl-wheel-copy">
        <small>SPIN & WIN</small>
        <strong>Daily Fortune</strong>
        <p>Das Ergebnis und alle Gewichte werden ausschließlich vom Server bestimmt.</p>
        {result && <p className="wheel-result" role="status">{result.rewardCurrency === "gem"
          ? `${result.rewardAmount} Gems gewonnen`
          : `${coinNumber(result.rewardAmount)} Coins gewonnen`}</p>}
        {error && <p className="wheel-error" role="status">{error}</p>}
      </div>

      <div className="wheel-stage fl-wheel-stage">
        <span className="wheel-pointer" aria-hidden="true" />
        <div className="wheel-disc" style={{ background: gradient, transform: `rotate(${angle}deg)` }}>
          {segments.map((segment, index) => <span
            key={segment.id}
            className={segment.currency === "gem" ? "wheel-label gem" : "wheel-label"}
            style={{ transform: `rotate(${index * slice + slice / 2}deg) translateY(-38%)` }}
          >{segmentLabel(segment)}</span>)}
        </div>
        <span className="wheel-hub" aria-hidden="true" />
      </div>

      <button className="claim-button wheel-button fl-gold-action" disabled={spinning || !status || status.availableSpins < 1} onClick={() => void spin()}>
        {spinning ? "SPINNING …" : status && status.availableSpins > 0 ? "SPIN NOW" : "NO SPIN READY"}
      </button>
    </div>
  </section>;
}
