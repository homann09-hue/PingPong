"use client";

import { useEffect, useRef, useState } from "react";
import { coinNumber } from "@/lib/format";

/**
 * Gewinn-Inszenierung: Muenzregen, Funken und Konfetti auf einem Canvas,
 * dazu eine gestufte Einblendung der Gewinnklasse mit hochzaehlendem Betrag.
 *
 * Grundsaetze (bewusst anders als beim Wettbewerb):
 * - Die Inszenierung veraendert niemals den Spielzustand. Das Ergebnis steht vorher fest.
 * - Jede Sequenz ist per Tippen sofort abbrechbar und endet spaetestens nach einer festen Zeit.
 * - Bei "prefers-reduced-motion" laeuft nur eine ruhige Einblendung ohne Partikel.
 * - Die Partikelzahl richtet sich nach Geraeteklasse und Gewinnstufe.
 */

type WinTier = "nice" | "big" | "mega" | "epic" | "max";

interface TierStyle {
  readonly label: string;
  readonly particles: number;
  readonly durationMs: number;
  readonly shake: number;
}

const tiers: Readonly<Record<WinTier, TierStyle>> = {
  nice: { label: "SCHOENER GEWINN", particles: 40, durationMs: 1400, shake: 0 },
  big: { label: "BIG WIN", particles: 90, durationMs: 2200, shake: 3 },
  mega: { label: "MEGA WIN", particles: 150, durationMs: 3000, shake: 6 },
  epic: { label: "EPIC WIN", particles: 220, durationMs: 3600, shake: 9 },
  max: { label: "MAX WIN", particles: 300, durationMs: 4200, shake: 12 },
};

/** Ordnet die vom Server gelieferte Gewinnklasse einer Inszenierungsstufe zu. */
export function winTierFor(winClass: string | undefined, multiplier: number): WinTier | null {
  const normalized = (winClass ?? "").toUpperCase();
  if (normalized === "MAX") return "max";
  if (normalized === "EPIC" || multiplier >= 100) return "epic";
  if (normalized === "MEGA" || multiplier >= 50) return "mega";
  if (normalized === "BIG" || multiplier >= 15) return "big";
  if (multiplier >= 5) return "nice";
  return null;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; spin: number; spinSpeed: number;
  kind: 0 | 1 | 2; hue: number; life: number;
}

export function WinCelebration({
  tier, amount, primary, secondary, onDone,
}: Readonly<{
  tier: WinTier | null;
  amount: number;
  primary: string;
  secondary: string;
  onDone: () => void;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!tier) return;
    const style = tiers[tier];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    let finished = false;

    // Betrag hochzaehlen — rein visuell, der Wert steht bereits fest.
    const countMs = Math.min(style.durationMs * 0.6, 1800);
    const countTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / countMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(amount * eased));
      if (progress >= 1) window.clearInterval(countTimer);
    }, 40);

    function finish() {
      if (finished) return;
      finished = true;
      window.clearInterval(countTimer);
      window.cancelAnimationFrame(raf);
      setShown(amount);
      onDone();
    }

    const stopTimer = window.setTimeout(finish, style.durationMs);
    const canvas = canvasRef.current;
    if (!canvas || reduced) {
      return () => { window.clearTimeout(stopTimer); window.clearInterval(countTimer); };
    }

    const context = canvas.getContext("2d");
    if (!context) return () => { window.clearTimeout(stopTimer); window.clearInterval(countTimer); };

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.scale(ratio, ratio);

    // Schwaechere Geraete bekommen weniger Partikel.
    const budget = (navigator.hardwareConcurrency ?? 4) < 4 ? 0.5 : 1;
    const count = Math.round(style.particles * budget);
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: width * (0.15 + Math.random() * 0.7),
      y: height * (0.35 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 320,
      vy: -180 - Math.random() * 380,
      size: 7 + Math.random() * 11,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 9,
      kind: (Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2) as 0 | 1 | 2,
      hue: 38 + Math.random() * 18,
      life: 1,
    }));

    let previous = start;
    function frame(now: number) {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      context!.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.vy += 900 * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.spin += particle.spinSpeed * delta;
        particle.life -= delta / (style.durationMs / 1000);
        if (particle.life <= 0) continue;
        context!.save();
        context!.globalAlpha = Math.max(0, Math.min(1, particle.life * 1.6));
        context!.translate(particle.x, particle.y);
        context!.rotate(particle.spin);
        if (particle.kind === 0) {
          // Muenze: Breite pulsiert, damit sie sich zu drehen scheint.
          const flip = Math.abs(Math.cos(particle.spin));
          const gradient = context!.createLinearGradient(-particle.size, 0, particle.size, 0);
          gradient.addColorStop(0, `hsl(${particle.hue}, 95%, 52%)`);
          gradient.addColorStop(0.5, `hsl(${particle.hue + 12}, 100%, 76%)`);
          gradient.addColorStop(1, `hsl(${particle.hue}, 95%, 46%)`);
          context!.fillStyle = gradient;
          context!.beginPath();
          context!.ellipse(0, 0, Math.max(1.5, particle.size * flip), particle.size, 0, 0, Math.PI * 2);
          context!.fill();
        } else if (particle.kind === 1) {
          // Konfetti in den Themenfarben.
          context!.fillStyle = Math.random() < 0.5 ? primary : secondary;
          context!.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
        } else {
          // Funke.
          context!.strokeStyle = "rgba(255,255,255,0.9)";
          context!.lineWidth = 2;
          context!.beginPath();
          context!.moveTo(-particle.size / 2, 0);
          context!.lineTo(particle.size / 2, 0);
          context!.stroke();
        }
        context!.restore();
      }
      raf = window.requestAnimationFrame(frame);
    }
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.clearTimeout(stopTimer);
      window.clearInterval(countTimer);
      window.cancelAnimationFrame(raf);
    };
  }, [tier, amount, primary, secondary, onDone]);

  if (!tier) return null;
  const style = tiers[tier];
  return <div
    className={`win-celebration tier-${tier}`}
    style={{ "--shake": `${style.shake}px`, "--slot-primary": primary, "--slot-secondary": secondary } as React.CSSProperties}
    onClick={onDone}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onDone(); }}
    aria-label="Gewinnanzeige schliessen"
  >
    <canvas ref={canvasRef} className="win-canvas" aria-hidden="true" />
    <div className="win-burst" aria-hidden="true" />
    <div className="win-content">
      <p className="win-tier-label">{style.label}</p>
      <p className="win-amount">{coinNumber(shown)}</p>
      <p className="win-hint">Tippen zum Fortfahren</p>
    </div>
  </div>;
}
