# Bedrohungsmodell — Aurora Casino

Stand: 22.07.2026

Ein Social Casino mit virtuellem Spielgeld. Es geht **nicht** um Echtgeld — aber
Coins und Gems haben Spielwert, und wer sie faelschen oder vervielfachen kann,
zerstoert die Oekonomie und die Fairness fuer alle anderen. Das ist das
Schutzgut.

## Werte (was geschuetzt wird)

| Wert | Warum |
|---|---|
| Wallet-Kontostand | Kern der Oekonomie; Faelschung entwertet das Spiel |
| Spin-Ergebnis | Muss server-bestimmt sein, sonst "Gewinn nach Wunsch" |
| Belohnungs-Claims | Taeglich, Missionen, Rad — doppeltes Einloesen = Inflation |
| Sitzungs-Token | Zugang zum Konto |
| Admin-Funktionen | Wallet-Korrektur, Slot-Sperre — Eskalation waere gravierend |
| Spielerdaten | Datenschutz, Store-Anforderung |

## Angreifer

- **Manipulierter Client:** modifiziertes JS, gefaelschte Requests. Haupt-Angreifer.
- **Automatisierung / Bots:** Massen-Spins, Massen-Claims.
- **Netzwerk-Beobachter:** liest oder wiederholt Requests.
- **Boeswilliger Insider / kompromittiertes Admin-Konto.**
- **Betrug bei Monetarisierung** (spaeter): gefaelschte Ad-Callbacks, Kaufbelege.

## Bedrohungen und Gegenmassnahmen (STRIDE-nah)

### Spoofing — fremde Identitaet

- Bearer-Token pro Anfrage; 401 ohne. Token im httpOnly-Cookie, fuer
  Browser-JS unsichtbar. Timing-sichere Vergleiche in der Admin-Auth.
- **Rest-Risiko:** gestohlenes Geraet mit aktiver Sitzung. Gegenmassnahme:
  Sitzungsrotation und Geraeteverwaltung sind vorhanden (ADR 0007/0008).

### Tampering — Manipulation von Einsatz, Ergebnis, Wallet

- **Einsatz:** server-seitig gegen konfigurierte Stufen validiert.
- **Ergebnis:** steht server-seitig fest, bevor der Client etwas zeichnet. Der
  RNG-Seed ist kryptografisch und rein server-seitig. Ein manipulierter Client
  kann die Animation aendern, nie das Ergebnis.
- **Wallet:** die DB-Invariante `balance_after = balance_before + amount` und
  `>= 0` macht Faelschung auf Datenbankebene unmoeglich — unabhaengig vom
  Anwendungscode.

### Repudiation — Abstreitbarkeit

- Immutable Ledger mit Zeitstempel, Grund, Referenz und Seed. Jede Buchung ist
  nachvollziehbar und reproduzierbar. Admin-Aenderungen sind protokolliert.

### Information Disclosure — Datenabfluss

- CORS in Produktion geschlossen; Tokens im httpOnly-Cookie; keine
  Service-Keys im Client. Der oeffentliche Slot-Endpunkt gab frueher den Namen
  des sperrenden Mitarbeiters preis — in PR #10 geschlossen, durch Test
  abgesichert.
- **Rest-Risiko / offen:** keine CSP (siehe security-audit.md).

### Denial of Service

- Per-Spieler-Rate-Limit auf dem Spin- und den Claim-Pfaden. **Offen:
  prozess-lokal**, bei Multi-Replica global unwirksam — dann Cloudflare-Rules
  oder geteilter Speicher noetig.

### Elevation of Privilege — Rechteausweitung

- Admin-Rollen server-seitig erzwungen. Das Spieler-BFF laesst per Allowlist
  **keine** `admin/*`-Route durch; ein Vertragstest bricht den Build, falls das
  je passiert. Damit ist der naheliegendste Eskalationsweg (Admin-Route ueber
  das Spieler-BFF) strukturell verschlossen.

## Bot- und Automatisierungsschutz

- Rate-Limits bremsen Massen-Spins/Claims. Idempotenz verhindert, dass ein
  wiederholter Claim doppelt zahlt.
- **Offen:** keine Verhaltens-Heuristik, kein Geraete-Fingerprinting, kein
  CAPTCHA. Fuer die aktuelle Phase vertretbar (kein Echtgeld), vor Skalierung zu
  ueberdenken.

## Monetarisierung (noch nicht gebaut — Vorgaben fuer den Bau)

Sobald IAP und Rewarded Ads dazukommen, gelten diese Regeln als bindend:

- **Rewarded Ad:** Coins erst nach server-seitig verifiziertem Completion-
  Callback. Tageslimit, Cooldown, Anti-Replay ueber Idempotenz.
- **IAP:** Beleg server-seitig gegen StoreKit/Play verifizieren, bevor Coins
  gutgeschrieben werden. Nie dem Client glauben.

## Auswirkung der nativen Auth-Umstellung

Heute schuetzt der httpOnly-Cookie den Token vor Browser-JS. In der Store-App
wandern Tokens in Keychain/Keystore. Dabei ist zu beachten:

- Sicherer Speicher nur mit Geraete-Verschluesselung wirksam.
- Die Allowlist-Logik wandert in einen Client-Adapter und ist dann
  **Selbstbeschraenkung, keine Sicherheitsgrenze mehr** — die Grenze liegt
  vollstaendig in der API. Vertretbar, weil die API ohnehin jede Anfrage
  authentifiziert und autorisiert, aber es muss bewusst so entworfen werden.

## Zusammenfassung der offenen Punkte

| Punkt | Prioritaet |
|---|---|
| CSP-Header | hoch |
| Geteiltes Rate-Limiting (Multi-Replica) | mittel (bei Skalierung) |
| Error-Monitoring | mittel |
| Bot-Heuristik / Fingerprinting | niedrig (aktuelle Phase) |
| Sichere Monetarisierungs-Callbacks | bei Bau bindend |
| Externer Penetrationstest | vor Veroeffentlichung |
