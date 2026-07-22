import { describe, expect, it } from "vitest";
import { SlotEngine } from "./engine.js";
import { parseSlotConfig } from "./config.js";

/**
 * Cluster Pays deterministisch pruefen.
 *
 * Trick: jede Walze ist ein Streifen aus nur einem Symbol. Damit steht das
 * Raster fest, egal welchen Stop der RNG zieht — der Test haengt nicht an
 * RNG-Interna. Drei A-Walzen ergeben einen zusammenhaengenden 15er-Cluster,
 * zwei B-Walzen einen 10er-Cluster.
 */
const uniform = (symbol: string): string[] => Array.from({ length: 8 }, () => symbol);

const clusterConfig = parseSlotConfig({
  id: "cluster-test",
  version: 1,
  name: "Cluster Test",
  rows: 5,
  reels: [uniform("A"), uniform("A"), uniform("A"), uniform("B"), uniform("B")],
  // Cluster-Modus ignoriert Paylines; das Schema verlangt aber mindestens eine.
  paylines: [[0, 0, 0, 0, 0]],
  symbols: {
    A: { kind: "regular", payouts: { 5: 2, 8: 5, 12: 20 } },
    B: { kind: "regular", payouts: { 5: 1, 8: 3 } },
  },
  math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 0.5 },
  features: { cluster: { minimumCluster: 5, betDivisor: 1 } },
});

describe("Cluster Pays", () => {
  it("zahlt zusammenhaengende Gruppen nach Groesse", () => {
    const engine = new SlotEngine(clusterConfig);
    const result = engine.spin({ bet: 10, seed: 1n });

    const clusters = result.wins.filter((win) => win.kind === "cluster");
    const bySymbol = new Map(clusters.map((win) => [win.symbol, win]));

    // A: 3 Walzen x 5 Reihen = 15 Zellen. Groesste Stufe <= 15 ist 12 -> Auszahlung 20.
    const a = bySymbol.get("A");
    expect(a, "A-Cluster erwartet").toBeDefined();
    expect(a?.count).toBe(15);
    expect(a?.amount).toBe(200);

    // B: 2 Walzen x 5 Reihen = 10 Zellen. Groesste Stufe <= 10 ist 8 -> Auszahlung 3.
    const b = bySymbol.get("B");
    expect(b, "B-Cluster erwartet").toBeDefined();
    expect(b?.count).toBe(10);
    expect(b?.amount).toBe(30);
  });

  it("zahlt nichts unterhalb der Mindestgroesse", () => {
    const strict = parseSlotConfig({
      id: "cluster-strict",
      version: 1,
      name: "Cluster Strict",
      rows: 5,
      reels: [uniform("A"), uniform("A"), uniform("A"), uniform("B"), uniform("B")],
      paylines: [[0, 0, 0, 0, 0]],
      symbols: {
        A: { kind: "regular", payouts: { 5: 2, 8: 5, 12: 20 } },
        B: { kind: "regular", payouts: { 5: 1, 8: 3 } },
      },
      math: { targetRtp: 0.9, volatility: "medium", expectedHitFrequency: 0.5 },
      // Mindestgroesse groesser als jeder moegliche Cluster.
      features: { cluster: { minimumCluster: 20, betDivisor: 1 } },
    });
    const result = new SlotEngine(strict).spin({ bet: 10, seed: 1n });
    expect(result.wins.filter((win) => win.kind === "cluster")).toHaveLength(0);
  });
});
