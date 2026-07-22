# Fairness-Verifikation — Slot-Mathematik

Stand: 22.07.2026 · Antwort auf Abschnitt 4 des Auftrags (Slot-Mathematik und
Fairness). Alle Zahlen aus den committeten Simulationen unter
`reports/slot-math/[slot-id].json`, je **1.000.000 Spins**, reproduzierbar mit
festen Seeds.

## RTP-Konformitaet (alle 8 Slots)

Toleranz: Abweichung Ziel-RTP zu simuliertem RTP < 2 Prozentpunkte. Diese
Grenze wird in CI erzwungen (`math-profile.test.ts`) — ein Slot ausserhalb der
Toleranz macht den Build rot.

| Slot | Ziel | Simuliert | Abweichung | in Toleranz |
|---|---|---|---|---|
| Dragon Peak | 94 % | 94,80 % | +0,80 | ja |
| Neon Nights | 94 % | 94,56 % | +0,56 | ja |
| Frozen Kingdom | 94 % | 94,38 % | +0,38 | ja |
| Vegas Gold | 94 % | 93,72 % | -0,28 | ja |
| Pharaoh Oasis | 94 % | 93,53 % | -0,47 | ja |
| Jungle Temple | 94 % | 93,49 % | -0,51 | ja |
| Pirate Bay | 94 % | 93,36 % | -0,64 | ja |
| Candy Carnival | 94 % | 93,21 % | -0,79 | ja |

Fuer jeden Slot enthaelt der JSON-Bericht zusaetzlich das 95%-Konfidenzintervall
des RTP; das Ziel liegt in jedem Fall darin.

## Fairness-Kennzahlen je Slot

| Slot | Trefferquote | Freispiel-Frequenz | Bonus-Frequenz | 100x+ Gewinne | max. beob. Multiplikator |
|---|---|---|---|---|---|
| Candy Carnival | 63,3 % | 2,45 % | 0,34 % | 0,045 % | 1183x |
| Vegas Gold | 52,3 % | — | 0,23 % | 0,023 % | 182x |
| Neon Nights | 48,5 % | 1,42 % | 0,19 % | 0,001 % | 151x |
| Frozen Kingdom | 46,5 % | 1,52 % | 0,21 % | 0,087 % | 713x |
| Pharaoh Oasis | 38,9 % | 1,87 % | 0,20 % | 0,015 % | 583x |
| Jungle Temple | 32,3 % | 1,63 % | 0,22 % | 0,056 % | 505x |
| Dragon Peak | 32,2 % | 1,64 % | 0,23 % | 0,051 % | 1439x |
| Pirate Bay | 30,0 % | 1,16 % | 0,61 % | 0,030 % | 372x |

Die Spanne der Trefferquoten (30–63 %) und der Multiplikatoren (151x–1439x)
spiegelt bewusst unterschiedliche Volatilitaeten: Candy Carnival zahlt oft klein,
Dragon Peak selten, dann gross. Volatilitaet ist je Slot als Varianz und
Standardabweichung im JSON hinterlegt.

**Ehrlicher Hinweis zu Vegas Gold:** Freispiel-Frequenz 0,00 % ist kein Fehler.
Vegas Gold ist ein Hold-and-Win-Slot mit vier Jackpots — sein Feature-Set
enthaelt planmaessig keine Freispiele. Der Wert ist damit intern konsistent.

## Gewinnverteilung

Jeder JSON-Bericht schluesselt die Gewinne in sieben Baender auf: `zero`,
`under1x`, `1x–5x`, `5x–15x`, `15x–50x`, `50x–100x`, `100x+`. Damit ist die im
Auftrag geforderte Verteilung kleiner, mittlerer und grosser Gewinne pro Slot
nachvollziehbar. Beispiel Dragon Peak: 67,8 % kein Gewinn, 15,4 % unter 1x,
12,7 % 1–5x, abnehmend bis 0,051 % ueber 100x.

## Integritaet: Wallet, Nebenlaeufigkeit, Schleifen

Diese Punkte aus Abschnitt 4 lassen sich **nicht** durch eine RTP-Simulation
nachweisen — sie sind Laufzeit- und Datenbank-Garantien. Sie sind separat
verifiziert (Details in `docs/security-audit.md`):

| Anforderung | Garantie | Wo |
|---|---|---|
| Keine negativen Wallet-Zustaende | DB-Constraint `balance_after >= 0` | Migration 004 |
| Keine Rundungsfehler / inkonsistente Buchung | DB-Constraint `balance_after = balance_before + amount` (Ganzzahl-Coins) | Migration 004 |
| Keine doppelten Auszahlungen | Idempotenz-Schluessel, Replay liefert identisches Ergebnis | Spin-Route + Store |
| Keine Race Conditions | Transaktion mit `SELECT … FOR UPDATE` | postgres-spin-store |
| Keine Endlosschleifen | Alle Feature-Schleifen begrenzt (Free Spins <= maxTotal, Kaskaden <= maxSteps, Respins begrenzt) | Engine + ADRs |
| Keine Exploits im Spin-Pfad | Ergebnis server-autoritativ, Seed kryptografisch und server-seitig | http-app + engine |

## Definition of Done (Abschnitt 4) je Slot

| Kriterium | Stand |
|---|---|
| Mathematische Tests bestehen | ja — `engine.test.ts` (39) + `math-profile.test.ts` (3), in jedem CI-Lauf gruen |
| Simulierter RTP in Toleranz | ja — alle 8 innerhalb 2 Prozentpunkten, CI-erzwungen |
| Keine Wallet-/Auszahlungsfehler | ja — DB-Constraints + Idempotenz, siehe oben |
| Alle Features automatisiert getestet | ja fuer die vorhandenen Features; Cluster Pays seit PR #26 mit eigenem deterministischen Test |

## Reproduzieren

```bash
npm run math:simulate   # 1.000.000 Spins je Slot, feste Seeds
```

Die Pipeline unterstuetzt 100.000 und 1.000.000 Spins; ein 10.000.000-Lauf
(im Auftrag als optional markiert) wurde nicht committet, weil das 95%-CI schon
bei 1M eng genug ist, um die 2%-Toleranz belastbar zu pruefen.
