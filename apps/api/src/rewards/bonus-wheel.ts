export type WheelCurrency = "coin" | "gem";
export interface WheelSegment { readonly id: string; readonly currency: WheelCurrency; readonly amount: number; readonly weight: number }

export const standardWheel = {
  type: "standard" as const,
  version: 1,
  segments: [
    { id: "coins-50k", currency: "coin", amount: 50_000, weight: 30 },
    { id: "coins-100k", currency: "coin", amount: 100_000, weight: 25 },
    { id: "coins-250k", currency: "coin", amount: 250_000, weight: 18 },
    { id: "coins-500k", currency: "coin", amount: 500_000, weight: 10 },
    { id: "gems-25", currency: "gem", amount: 25, weight: 10 },
    { id: "gems-50", currency: "gem", amount: 50, weight: 5 },
    { id: "coins-1m", currency: "coin", amount: 1_000_000, weight: 2 },
  ] satisfies readonly WheelSegment[],
};

export function selectWheelSegment(randomUnit: number): WheelSegment {
  if (!(randomUnit >= 0 && randomUnit < 1)) throw new Error("randomUnit must be in [0, 1)");
  const total = standardWheel.segments.reduce((sum, segment) => sum + segment.weight, 0);
  let cursor = randomUnit * total;
  for (const segment of standardWheel.segments) {
    cursor -= segment.weight;
    if (cursor < 0) return segment;
  }
  return standardWheel.segments[standardWheel.segments.length - 1]!;
}
