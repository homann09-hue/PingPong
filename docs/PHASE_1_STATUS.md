# Phase 1 – belastbare Slot-Mathematik

Stand: 14. Juli 2026

## Implementiert

- Serverautoritative, deterministische Spin-Auflösung mit reproduzierbaren Seeds.
- Versionierte Mathematikmodelle und Slot-Konfigurationen.
- Gesamteinsatz-Modell mit festen, serverseitig validierten Einsatzstufen.
- Gewinnlinien, Wilds, Scatter, Freispiele, Respins, Cascades, Multiplikatoren, Bonusspiele und Jackpots als konfigurierbare Engine-Features.
- Gewinnklassen von `SMALL` bis `MAX` und ein harter, deterministischer Max-Win-Cap.
- Acht unterschiedliche Slot-Profile mit getrennten Reel-Strips, Paytables und Feature-Kombinationen.
- Serverseitige Wallet-Abrechnung mit Idempotenzschutz und unveränderbaren,
  arithmetisch validierten Ledger-Übergängen.
- Auditierbare Spin-Persistenz einschließlich Math-Version, Kontostand vorher/nachher und normalisierten Engine-Events.
- Öffentliche API ohne Offenlegung des internen RNG-Seeds.
- Gastidentitäten, Gerätebindung, kurzlebige Access Tokens sowie rotierende und
  widerrufbare Refresh Sessions.
- Sessionverwaltung, Logout auf allen Geräten, Account-Löschung, Security
  Headers und Auth-Rate-Limiting.
- Dauerhafte stündliche und tägliche Rewards mit Serverzeit, Streak,
  Sieben-Tage-Zyklus und Bonusrad-Fortschritt.
- Persistierte Standard-Bonusrad-Berechtigungen, gewichtete serverseitige
  Auswahl sowie atomare Coin-/Gem-Auszahlung.
- Versionierte tägliche Missionen mit serverabgeleitetem Spin-, Einsatz-,
  Gewinn- und Freispiel-Fortschritt sowie atomaren Claims.
- Flutter-Anbindung für serverseitige Runden, Gewinnzellen, Feature-Phasen, Paytable, Einsatzstufen und Max-Win.
- Reproduzierbarer Mathematik-Simulator mit RTP-Zerlegung, Konfidenzintervall, Varianz, Trefferfrequenzen, Feature-Frequenzen, Streaks und Gewinnverteilung.

## Verifikation

- 22 Engine- und Mathematiktests bestanden.
- 28 API-/Identity-/Reward-Tests und vier PostgreSQL-Integrationstests
  bestanden (32 API-Tests insgesamt).
- Die Release-Guardrails simulieren 100.000 Spins je veröffentlichtem Thema.
- Zusätzlicher vollständiger Simulatorlauf: 800.000 Spins über acht Themen.
- Stichproben-RTP der acht Themen: 92,62 % bis 96,01 % bei 94 % Ziel-RTP; alle 95-%-Konfidenzintervalle enthalten das Ziel.
- Gemessene Varianzreihenfolge: `low < medium < high < very_high`.

## Noch offene Produktionsrisiken

- Die aktuelle Auswertung ist eine deterministische Monte-Carlo-Freigabe, noch keine unabhängige mathematische Zertifizierung.
- Für eine finale Economy-Freigabe sind Läufe mit mindestens 10 Millionen Spins pro Slot sowie feste Warn-/Blockiergrenzen in CI erforderlich.
- Der PostgreSQL-Integrationstest benötigt `TEST_DATABASE_URL`; CI stellt dafür
  PostgreSQL 17 bereit und lokal wurde er erfolgreich gegen Docker ausgeführt.
- Das Flutter-SDK im iCloud-Projekt ist teilweise ausgelagert und sein Tool-Snapshot muss vollständig neu materialisiert werden. Xcode 27 Beta ist unter `~/Downloads/Xcode-beta.app` vorhanden, die Lizenz ist bereits akzeptiert und die iOS-27-Simulatoren sind verfügbar.
- Ways-, Cluster- und echtes dynamisches Megaways-Scoring sind Erweiterungspunkte, aber noch keine freigegebenen Produktionsmodelle.

## Nächste professionelle Ausbaustufe

1. Eigene Ways-/Cluster-Resolver mit exakten Referenztests und separaten Math-Versionen.
2. 10-Millionen-Spin-Release-Gates und automatisch archivierte Math-Reports pro Slot-Version.
3. Vollständige PostgreSQL-Testumgebung und End-to-End-Wallettests unter Parallelität.
4. Slot-spezifische Bonus-State-Machines statt ausschließlich generischer Feature-Komposition.
5. Telemetrie für Spin-Latenz, Feature-Frequenz, Economy-Sinks/Sources und Client-Abbrüche.
