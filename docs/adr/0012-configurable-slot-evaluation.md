# ADR 0012: Konfigurierbare Slot-Auswertung und Feature-Modifikatoren

Status: Accepted
Datum: 2026-07-16

## Kontext

Die Plattform benötigt Payline- und Ways-Spiele sowie reproduzierbare Mystery- und Freispielmodifikatoren. Diese Regeln dürfen weder im Flutter-Client berechnet noch als reine Animation simuliert werden.

## Entscheidung

- Die Auswertungsart bleibt Teil der unveränderlichen, versionierten Slotkonfiguration.
- `features.ways` aktiviert eine links beginnende All-Ways-Auswertung. `minimumReels` definiert die Mindestlänge, `betDivisor` normalisiert den Gesamteinsatz gegen die Kombinationen.
- Ways-Gewinne enthalten Symbol, Walzenanzahl, Kombinationenzahl, Betrag und alle beteiligten Zellen.
- Mystery-Symbole werden deterministisch aus demselben Spin-RNG vor der Gewinnauswertung transformiert.
- Freispiele können eigene Reelstrips und eine begrenzte Anzahl zusätzlicher Wilds verwenden.
- Jede Transformation erzeugt ein Engine-Event. API und Client präsentieren diese Events, berechnen aber keine Ergebnisse neu.
- Änderungen an einer veröffentlichten Auszahlungslogik erfordern eine neue Konfigurations- und Math-Modell-Version sowie eine erneute deterministische Simulation.

## Konsequenzen

- Replays bleiben anhand von Seed, Konfigurationsversion und Math-Modell reproduzierbar.
- Der Client kann Paylines und Ways über denselben Spinvertrag darstellen.
- Neue Mechaniken benötigen Schema-Invarianten, Engine-Referenztests und RTP-/Trefferfrequenz-/Volatilitäts-Guardrails, bevor sie einem veröffentlichten Slot zugewiesen werden.
- Cluster Pays und dynamische Megaways-Höhen bleiben separate künftige Evaluatoren; sie werden nicht als Ways-Auswertung ausgegeben.
