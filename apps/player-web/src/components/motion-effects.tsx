"use client";

import Link from "next/link";
import { Coins } from "@phosphor-icons/react/dist/csr/Coins";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import { coinNumber } from "@/lib/format";

export function AnimatedCounter({ value, durationMs = 700, className }: Readonly<{ value: number; durationMs?: number; className?: string }>) {
  const previousRef = useRef(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const startValue = previousRef.current;
    previousRef.current = value;
    if (startValue === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return undefined;
    }

    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(startValue + (value - startValue) * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, value]);

  return <span className={className}>{coinNumber(shown)}</span>;
}

export function AmbientParticles({ count = 18, className = "" }: Readonly<{ count?: number; className?: string }>) {
  return <div className={`ls-ambient-particles ${className}`} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => {
      const x = 4 + ((index * 37) % 92);
      const y = 8 + ((index * 61) % 84);
      const delay = -((index * 0.43) % 8);
      const duration = 5.5 + ((index * 13) % 7) * 0.55;
      const size = 3 + (index % 5) * 1.4;
      return <i key={index} style={{ "--particle-x": `${x}%`, "--particle-y": `${y}%`, "--particle-delay": `${delay}s`, "--particle-duration": `${duration}s`, "--particle-size": `${size}px` } as React.CSSProperties} />;
    })}
  </div>;
}

export function CoinBurst({ burstKey, count = 26, className = "" }: Readonly<{ burstKey: number | string; count?: number; className?: string }>) {
  return <div className={`ls-coin-burst ${className}`} key={burstKey} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => {
      const angle = (360 / count) * index;
      const distance = 90 + (index % 7) * 22;
      const delay = (index % 6) * 0.035;
      const size = 12 + (index % 4) * 4;
      return <i key={index} style={{ "--coin-angle": `${angle}deg`, "--coin-distance": `${distance}px`, "--coin-delay": `${delay}s`, "--coin-size": `${size}px` } as React.CSSProperties}><Coins weight="fill" /></i>;
    })}
  </div>;
}

export function RewardTakeover({
  open,
  title,
  eyebrow,
  description,
  value,
  ctaHref,
  ctaLabel,
  onClose,
}: Readonly<{
  open: boolean;
  title: string;
  eyebrow: string;
  description: string;
  value: string;
  ctaHref: string;
  ctaLabel: string;
  onClose: () => void;
}>) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return <div className="ls-takeover-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="ls-reward-takeover">
      <AmbientParticles count={24} className="takeover-particles" />
      <div className="ls-takeover-rays" aria-hidden="true" />
      <button className="ls-takeover-close" onClick={onClose} aria-label="Hinweis schließen"><X weight="bold" /></button>
      <div className="ls-takeover-icon"><Gift weight="fill" /><span><Sparkle weight="fill" /></span></div>
      <small>{eyebrow}</small>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <p>{description}</p>
      <Link href={ctaHref} onClick={onClose}>{ctaLabel}</Link>
      <button className="ls-takeover-later" onClick={onClose}>Später ansehen</button>
    </section>
  </div>;
}
