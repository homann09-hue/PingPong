# Phase 4: Authoritative Reward Center

## Ergebnis

Die Flutter-Lobby nutzt die bereits vorhandenen serverautoritativen Reward-Endpunkte
jetzt als zusammenhängenden Reward Center Flow. Clientseitige Zeit- oder
Auszahlungsentscheidungen werden nicht getroffen.

## Enthalten

- Stundenbonus mit serverseitigem Cooldown und Live-Countdown
- Siebentägiger Daily-Streak mit Zyklus- und Streak-Anzeige
- Fortschritt bis zur nächsten Glücksrad-Berechtigung
- Standard-Glücksrad mit serverseitiger Segmentauswahl
- Idempotenter Spin-Request und aktualisierte Coin-Balance
- Coin- und Gem-Segmente in der Gewinnanzeige
- Offline-tolerante Initialwerte für Widget-Tests und kalten Start
- Automatisierter Widget-Test für Statusanzeige und Claim-Ablauf

## Sicherheitsgrenzen

- `availableAt`, `claimable`, Streak und Auszahlung kommen ausschließlich vom API.
- Claims werden vom Server gegen den aktuellen Reward-Zustand geprüft.
- Glücksrad-Spins verwenden einen neuen Idempotency-Key je Nutzeraktion.
- Das Ergebnis des Glücksrads wird ausschließlich aus der Serverantwort gerendert.

## Verifikation

- Flutter Widget Tests: 5/5 erfolgreich
- Live API Status geprüft: `GET /v1/rewards/hourly`
- Flutter Web Release-Build erfolgreich erzeugt
- Reward Center im lokalen Browser visuell geprüft

## Lokale Build-Infrastruktur

Das Flutter SDK und sein Paketcache liegen für reproduzierbare Builds außerhalb
des iCloud-synchronisierten Projektordners unter `~/Developer`. Dadurch werden
Compilerabbrüche durch ausgelagerte SDK-Dateien vermieden.
