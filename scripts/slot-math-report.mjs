import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Liest den JSON-Output von scripts/simulate-slots.mjs (stdin-Datei als argv[2])
 * und schreibt pro Slot reports/slot-math/<slot-id>.json + .md.
 * Reproduzierbar: Seeds = Spin-Index (deterministisch, siehe simulate-slots.mjs).
 */
const inputPath = process.argv[2];
if (!inputPath) throw new Error("usage: node scripts/slot-math-report.mjs <simulation.json>");
const { generatedAt, reports } = JSON.parse(readFileSync(inputPath, "utf8"));
mkdirSync("reports/slot-math", { recursive: true });

const pct = (value) => (value * 100).toFixed(3) + " %";
const tolerance = 0.02; // +/- 2 Prozentpunkte Toleranz gegen Ziel-RTP

let failures = 0;
for (const report of reports) {
  writeFileSync(`reports/slot-math/${report.slotId}.json`, JSON.stringify({ generatedAt, ...report }, null, 2) + "\n");
  const withinTolerance = Math.abs(report.rtpDeviation) <= tolerance;
  if (!withinTolerance) failures++;
  const md = [
    `# Slot-Math-Report: ${report.slotId}`,
    "",
    `Erzeugt: ${generatedAt} · Version ${report.slotVersion} · Math-Modell ${report.mathModelVersion}`,
    `Stichprobe: **${report.samples.toLocaleString("de-DE")} Spins** · Einsatz ${report.bet} · deterministisch (Seed = Spin-Index)`,
    "",
    "| Kennzahl | Wert |",
    "|---|---|",
    `| Ziel-RTP | ${pct(report.configuredTargetRtp)} |`,
    `| Simulierter RTP | ${pct(report.simulatedRtp)} |`,
    `| Abweichung | ${pct(report.rtpDeviation)} ${withinTolerance ? "✅ innerhalb ±2 pp" : "⚠️ AUSSERHALB ±2 pp"} |`,
    `| 95%-Konfidenzintervall | ${pct(report.rtp95ConfidenceInterval[0])} – ${pct(report.rtp95ConfidenceInterval[1])} |`,
    `| Standardabweichung (Multiplikator) | ${report.standardDeviation.toFixed(3)} |`,
    `| Hit-Frequenz | ${pct(report.hitFrequency)} |`,
    `| Profitable Spins (> Einsatz) | ${pct(report.profitableSpinFrequency)} |`,
    `| Free-Spin-Trigger | ${pct(report.freeSpinTriggerFrequency)} |`,
    `| Bonus-Trigger | ${pct(report.bonusTriggerFrequency)} |`,
    `| Respin-Trigger | ${pct(report.respinTriggerFrequency)} |`,
    `| Jackpot-Frequenz | ${pct(report.jackpotHitFrequency)} |`,
    `| Max-Win-Frequenz | ${pct(report.maxWinFrequency)} |`,
    `| Groesster beobachteter Gewinn | ${report.maximumObservedWinMultiplier.toFixed(1)}x |`,
    `| Laengste Verluststrecke | ${report.maximumLossStreak} Spins |`,
    "",
    "## RTP-Beitrag nach Phase",
    "",
    "| Phase | Beitrag |",
    "|---|---|",
    ...Object.entries(report.rtpBreakdown).map(([phase, value]) => `| ${phase} | ${pct(value)} |`),
    "",
    "## Gewinnverteilung",
    "",
    "| Klasse | Anteil |",
    "|---|---|",
    ...Object.entries(report.distribution).map(([bucket, value]) => `| ${bucket} | ${pct(value)} |`),
    "",
  ].join("\n");
  writeFileSync(`reports/slot-math/${report.slotId}.md`, md);
  console.log(`${withinTolerance ? "OK " : "WARN"} ${report.slotId}: RTP ${pct(report.simulatedRtp)} (Ziel ${pct(report.configuredTargetRtp)})`);
}

const index = [
  "# Slot-Math-Reports",
  "",
  `Erzeugt: ${generatedAt} · ${reports[0]?.samples.toLocaleString("de-DE")} Spins pro Slot · deterministisch reproduzierbar`,
  "",
  "| Slot | Ziel-RTP | Simuliert | Abweichung | Hit-Freq | Max-Win |",
  "|---|---|---|---|---|---|",
  ...reports.map((r) => `| ${r.slotId} | ${pct(r.configuredTargetRtp)} | ${pct(r.simulatedRtp)} | ${pct(r.rtpDeviation)} | ${pct(r.hitFrequency)} | ${r.maximumObservedWinMultiplier.toFixed(0)}x |`),
  "",
].join("\n");
writeFileSync("reports/slot-math/README.md", index);

if (failures > 0) {
  console.error(`${failures} Slot(s) ausserhalb der RTP-Toleranz`);
  process.exitCode = 1;
}
