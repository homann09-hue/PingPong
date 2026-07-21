"use client";

import { Confetti } from "@phosphor-icons/react/dist/csr/Confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { coinNumber } from "@/lib/format";

/**
 * Glucksrad. Die Segmente und das Ergebnis kommen komplett vom Server — der
 * Client kennt weder die Gewichte noch entscheidet er, wo das Rad stehenbleibt.
 * Die Animation dreht lediglich auf das bereits feststehende Segment zu.
 *
 * Das ist wichtig: waere die Zielposition clientseitig, koennte ein manipulierter
 * Client sich den Jackpot herbeidrehen. So ist die Drehung reine Inszenierung.
 */

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
  return segment.currency === "gem"
    ? `${segment.amount} Gems`
    : coinNumber(segment.amount);
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
      // Ohne Status bleibt das Rad sichtbar, aber der Knopf inaktiv.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function spin() {
    if (spinning || !status || status.availableSpins < 1) return;
    setSpinning(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/player/rewards/wheels/standard/spin", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        setError(body?.code === "WHEEL_NOT_AVAILABLE"
          ? "Gerade kein Dreh verfuegbar — hol dir erst deine Zeitbelohnungen ab."
          : "Das hat gerade nicht geklappt.");
        setSpinning(false);
        return;
      }
      const spinResult = await response.json() as WheelSpinResult;
      const index = status.segments.findIndex((segment) => segment.id === spinResult.segmentId);
      const slice = 360 / status.segments.length;
      // Zielwinkel so waehlen, dass die Mitte des Segments oben unter dem Zeiger steht.
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

  // Waehrend der Drehung und solange das Ergebnis steht, uebernimmt das Rad
    // den Bildschirm. Danach faellt es wieder in die Lobby zurueck.
    const live = spinning || result !== null;
  
    return <div className={live ? "wheel-card is-live" : "wheel-card"}>
    <div className="wheel-head">
      <span className="eyebrow"><Confetti weight="fill" /> Glucksrad</span>
      <strong>{status ? `${status.availableSpins} Dreh${status.availableSpins === 1 ? "" : "s"} frei` : "Laedt …"}</strong>
    </div>

    <div className="wheel-stage">
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

    {result && <p className="wheel-result" role="status">
      {result.rewardCurrency === "gem"
        ? `${result.rewardAmount} Gems gewonnen`
        : `${coinNumber(result.rewardAmount)} Coins gewonnen`}
    </p>}
    {error && <p className="wheel-error" role="status">{error}</p>}

    <button
      className="claim-button wheel-button"
      disabled={spinning || !status || status.availableSpins < 1}
      onClick={() => void spin()}
    >{spinning ? "Dreht …" : status && status.availableSpins > 0 ? "Drehen" : "Kein Dreh frei"}</button>
  </div>;
}
