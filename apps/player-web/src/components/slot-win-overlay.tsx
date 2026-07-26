"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { SlotCabinetMode } from "@/lib/catalog";
import type { SpinWin } from "@/lib/contracts";
import { compactNumber } from "@/lib/format";
import { presentSlotWinOverlay, slotWinOverlayViewBox } from "@/lib/slot-win-overlay-presentation";
import { buildSlotWinSequence, nextSlotWinStep } from "@/lib/slot-win-sequence";

export interface SlotWinOverlayProps {
  readonly wins: readonly SpinWin[];
  readonly grid: readonly (readonly string[])[];
  readonly active: boolean;
  readonly cabinet: SlotCabinetMode;
}

const traceStyle = (index: number) => ({ "--win-index": index } as CSSProperties);
const pointStyle = (index: number) => ({ "--point-index": index } as CSSProperties);

export function SlotWinOverlay({ wins, grid, active, cabinet }: Readonly<SlotWinOverlayProps>) {
  const traces = useMemo(() => presentSlotWinOverlay(wins, grid), [grid, wins]);
  const sequence = useMemo(() => buildSlotWinSequence(traces), [traces]);
  const signature = useMemo(() => traces.map((trace) => `${trace.id}:${trace.amount}`).join("|"), [traces]);
  const [activeStep, setActiveStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => setActiveStep(0), [signature]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion || sequence.length <= 1) return undefined;
    const normalizedStep = Math.min(activeStep, sequence.length - 1);
    const timer = window.setTimeout(
      () => setActiveStep((current) => nextSlotWinStep(current, sequence.length)),
      sequence[normalizedStep]?.durationMs ?? 1_350,
    );
    return () => window.clearTimeout(timer);
  }, [active, activeStep, reducedMotion, sequence]);

  if (!active || traces.length === 0) return null;

  const normalizedStep = Math.min(activeStep, sequence.length - 1);
  const activeTraceIndex = sequence[normalizedStep]?.traceIndex ?? 0;
  const pagerStart = 500 - ((sequence.length - 1) * 11);

  return <svg
    className="slot-win-overlay"
    data-cabinet={cabinet}
    data-sequence={`${normalizedStep + 1}/${sequence.length}`}
    viewBox={slotWinOverlayViewBox}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {traces.map((trace, index) => {
      const polyline = trace.points.map((point) => `${point.x},${point.y}`).join(" ");
      const selected = index === activeTraceIndex;
      return <g
        key={`${trace.id}-${selected ? "active" : "idle"}`}
        className="slot-win-trace"
        data-active={selected ? "true" : "false"}
        data-kind={trace.kind}
        style={traceStyle(index)}
      >
        {trace.kind === "path" && <>
          <polyline className="slot-win-path-glow" points={polyline} />
          <polyline className="slot-win-path-core" points={polyline} />
        </>}

        {trace.edges.map((edge, edgeIndex) => <line
          key={`${trace.id}-edge-${edgeIndex}`}
          className="slot-win-cluster-edge"
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
        />)}

        {trace.points.map((point, pointIndex) => <g
          key={`${trace.id}-${point.reel}:${point.row}`}
          className="slot-win-node"
          data-point={pointIndex}
          style={pointStyle(pointIndex)}
          transform={`translate(${point.x} ${point.y})`}
        >
          <circle className="slot-win-node-halo" r={trace.kind === "cluster" ? 48 : trace.kind === "scatter" ? 44 : 38} />
          <circle className="slot-win-node-ring" r={trace.kind === "cluster" ? 31 : 26} />
          {trace.kind === "scatter" && <path className="slot-win-scatter-star" d="M0-26 7-8 26-8 11 4 17 23 0 12-17 23-11 4-26-8-7-8Z" />}
        </g>)}

        <g className="slot-win-amount" transform={`translate(${trace.badge.x} ${trace.badge.y})`}>
          <rect x="-58" y="-18" width="116" height="36" rx="18" />
          <text x="0" y="6">+{compactNumber(trace.amount)}</text>
        </g>
      </g>;
    })}

    {!reducedMotion && sequence.length > 1 && <g className="slot-win-sequence-pager" transform={`translate(${pagerStart} 570)`}>
      {sequence.map((step, index) => <circle
        key={`win-step-${step.traceIndex}`}
        cx={index * 22}
        cy="0"
        r={index === normalizedStep ? 5 : 3}
        data-active={index === normalizedStep ? "true" : "false"}
      />)}
    </g>}
  </svg>;
}
