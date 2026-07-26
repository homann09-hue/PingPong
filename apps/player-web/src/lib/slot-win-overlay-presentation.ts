import type { SpinWin } from "./contracts";

export type SlotWinOverlayKind = "path" | "ways" | "cluster" | "scatter" | "cells";

export interface SlotWinPoint {
  readonly reel: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

export interface SlotWinEdge {
  readonly from: SlotWinPoint;
  readonly to: SlotWinPoint;
}

export interface SlotWinTrace {
  readonly id: string;
  readonly kind: SlotWinOverlayKind;
  readonly amount: number;
  readonly symbol?: string;
  readonly count: number;
  readonly points: readonly SlotWinPoint[];
  readonly edges: readonly SlotWinEdge[];
  readonly badge: Readonly<{ x: number; y: number }>;
}

const viewBoxWidth = 1_000;
const viewBoxHeight = 600;
const maximumTraces = 10;

function normalizedKind(kind: string | undefined, distinctReels: number): SlotWinOverlayKind {
  if (kind === "line" && distinctReels > 1) return "path";
  if (kind === "ways") return "ways";
  if (kind === "cluster") return "cluster";
  if (kind === "scatter") return "scatter";
  return "cells";
}

function pointFor(grid: readonly (readonly string[])[], reel: number, row: number): SlotWinPoint | null {
  const rowCount = grid[reel]?.length ?? 0;
  if (!Number.isInteger(reel) || !Number.isInteger(row) || reel < 0 || row < 0 || row >= rowCount || grid.length === 0) return null;
  return {
    reel,
    row,
    x: ((reel + 0.5) / grid.length) * viewBoxWidth,
    y: ((row + 0.5) / rowCount) * viewBoxHeight,
  };
}

function uniquePoints(win: SpinWin, grid: readonly (readonly string[])[]): SlotWinPoint[] {
  const seen = new Set<string>();
  const points: SlotWinPoint[] = [];
  for (const [reel, row] of win.cells) {
    const key = `${reel}:${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const point = pointFor(grid, reel, row);
    if (point) points.push(point);
  }
  return points;
}

function clusterEdges(points: readonly SlotWinPoint[]): SlotWinEdge[] {
  const byCell = new Map(points.map((point) => [`${point.reel}:${point.row}`, point]));
  const edges: SlotWinEdge[] = [];
  for (const point of points) {
    const right = byCell.get(`${point.reel + 1}:${point.row}`);
    const below = byCell.get(`${point.reel}:${point.row + 1}`);
    if (right) edges.push({ from: point, to: right });
    if (below) edges.push({ from: point, to: below });
  }
  return edges;
}

function badgePosition(kind: SlotWinOverlayKind, points: readonly SlotWinPoint[], direction: SpinWin["direction"]): { x: number; y: number } {
  if (kind === "path") {
    const sorted = [...points].sort((left, right) => direction === "right" ? right.reel - left.reel : left.reel - right.reel);
    const terminal = sorted.at(-1) ?? points[0]!;
    return { x: Math.max(70, Math.min(930, terminal.x)), y: Math.max(34, terminal.y - 58) };
  }
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = Math.min(...points.map((point) => point.y));
  return { x: Math.max(70, Math.min(930, x)), y: Math.max(34, y - 58) };
}

function orderedPath(points: readonly SlotWinPoint[], direction: SpinWin["direction"]): SlotWinPoint[] {
  return [...points].sort((left, right) => {
    const reelOrder = direction === "right" ? right.reel - left.reel : left.reel - right.reel;
    return reelOrder || left.row - right.row;
  });
}

export function presentSlotWinOverlay(
  wins: readonly SpinWin[],
  grid: readonly (readonly string[])[],
): readonly SlotWinTrace[] {
  if (grid.length === 0) return [];

  return wins.slice(0, maximumTraces).flatMap((win, index) => {
    const points = uniquePoints(win, grid);
    if (points.length === 0 || !Number.isFinite(win.amount) || win.amount <= 0) return [];
    const distinctReels = new Set(points.map((point) => point.reel)).size;
    const kind = normalizedKind(win.kind, distinctReels);
    const ordered = kind === "path" ? orderedPath(points, win.direction) : points;
    return [{
      id: `${index}-${win.kind ?? "win"}-${ordered.map((point) => `${point.reel}:${point.row}`).join("-")}`,
      kind,
      amount: Math.round(win.amount),
      symbol: win.symbol,
      count: Math.max(ordered.length, win.count ?? 0),
      points: ordered,
      edges: kind === "cluster" ? clusterEdges(ordered) : [],
      badge: badgePosition(kind, ordered, win.direction),
    }];
  });
}

export const slotWinOverlayViewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;
