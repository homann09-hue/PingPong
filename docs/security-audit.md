# Sicherheitsaudit — Aurora Casino

Stand: 22.07.2026 · Methodik: Code-Review am aktuellen `main`, kein externer
Penetrationstest. Jeder Befund unten wurde an der jeweiligen Quelldatei
verifiziert, nicht behauptet.

## Ergebnis in einem Satz

Der wirtschaftlich kritische Pfad — Spin, Einsatz, Wallet — ist server-autoritativ
und mehrfach abgesichert; **im geprüften Pfad wurde kein Exploit gefunden.** Die
offenen Punkte liegen in der Breite (CSP, verteiltes Rate-Limiting, native
Auth-Umstellung), nicht im Kern.

## Verifizierte Absicherungen

### Spin-Pfad (`apps/api/src/http-app.ts`, Route `/v1/slots/:slotId/spins`)

| Kontrolle | Verifiziert |
|---|---|
| Authentifizierung per Bearer-Token, sonst 401 | ja |
| Einsatz wird server-seitig gegen `safeParse` validiert | ja |
| Slot-Verfügbarkeit server-autoritativ erzwungen (503 bei Sperre) | ja |
| Per-Spieler-Rate-Limit `spin:${playerId}`, 120/60s → 429 mit `retry-after` | ja |
| Idempotenz-Schlüssel Pflicht; Wiederholung liefert dasselbe Ergebnis | ja |
| RNG-Seed = `randomBytes(8)` — kryptografisch, rein server-seitig | ja |
| Seed persistiert fürs Audit, aus der Client-Antwort entfernt | ja |
| Config-Version geht in die Abrechnung ein (versionierte Mathematik) | ja |

Damit sind die Angriffe aus Abschnitt 18 des Auftrags im Spin-Pfad abgedeckt:
manipulierter Einsatz (server-validiert), manipulierte Spin-Anfrage (Ergebnis
steht server-seitig fest), Replay (Idempotenz), Rate-Limit-Umgehung (429).

### Wallet-Settlement (`postgres-spin-store.ts`, Migration `004_wallet_ledger_audit.sql`)

- **Transaktion mit `SELECT … FOR UPDATE`** auf die Wallet-Zeile: keine Race
  Condition bei gleichzeitigen Anfragen.
- **Immutable Ledger:** jede Buchung ist eine Insert-Zeile, nichts wird
  ueberschrieben.
- **Datenbank-Invariante, woertlich aus der Migration:**

  ```sql
  CHECK (balance_before >= 0 AND balance_after >= 0
         AND balance_after = balance_before + amount)
  ```

  Die Datenbank selbst weist jede Buchung ab, die nicht arithmetisch aufgeht
  oder ein Konto negativ machen wuerde. Das ist die staerkste Stelle des
  Systems: selbst ein fehlerhafter Anwendungscode kann kein Geld aus dem Nichts
  schaffen und keinen negativen Kontostand hinterlassen.
- **Idempotenter Replay** über den Idempotenz-Schlüssel: doppelte Abrechnung
  ausgeschlossen (deckt "Reward-Duplikation" und "doppelte Auszahlung" ab).

### Transport und Header

- **CORS in Produktion vollstaendig geschlossen:** `origin: false`, ausser im
  `DEMO_MODE`. Der Browser spricht nie direkt mit der API — nur das
  server-seitige BFF (same-origin) tut das. Das schliesst eine ganze Klasse von
  Cross-Origin-Angriffen aus.
- **Security-Header** (aus `next.config.ts`, verifiziert): HSTS,
  X-Content-Type-Options, X-Frame-Options (DENY), Referrer-Policy,
  Permissions-Policy.
- **Keine Service-Role-Keys im Client** — im geprüften Code nicht vorhanden.
- **BFF haelt Tokens in httpOnly-Cookies:** Browser-JavaScript sieht die
  Zugangsdaten nie. Das entschaerft XSS-Token-Diebstahl erheblich.
- **Timing-sichere Token-Vergleiche** (`timingSafeEqual`) in der Admin-Auth.

### Admin

- Rollenbasiert (`liveops_publisher` u.a.), server-seitig erzwungen; die
  Admin-Oberflaeche kann nichts, was die API nicht erlaubt.
- Der BFF-Vertragstest (`player-proxy-contract.test.ts`) stellt sicher, dass
  keine Admin-Route je ueber das Spieler-BFF erreichbar wird.

## Offene Punkte — ehrlich

### Hoch

1. **Keine Content-Security-Policy.** Von den ueblichen Schutz-Headern fehlt CSP
   als einziger. Eine restriktive CSP ist die zweite Verteidigungslinie gegen
   XSS (die erste ist Reacts Auto-Escaping und die httpOnly-Cookies). Sollte vor
   Veroeffentlichung ergaenzt werden.
2. **Native Auth-Umstellung veraendert die Angriffsflaeche.** Beim Wechsel von
   httpOnly-Cookies auf Keychain/Keystore (fuer die Store-App) muss die
   Token-Handhabung neu bewertet werden. Siehe `threat-model.md`.

### Mittel

3. **Rate-Limiter ist prozess-lokal** (`FixedWindow` im Speicher). Bei mehr als
   einer API-Replica greift er pro Instanz, nicht global — die effektive Grenze
   waere dann n-mal so hoch. Fuer eine Instanz korrekt; fuer Skalierung braucht
   es einen geteilten Speicher (Redis) oder Cloudflare-Rate-Rules.
4. **Kein Error-Monitoring** (Sentry o.ae.): Angriffsversuche wuerden aktuell
   nicht auffallen, solange sie nicht durchkommen.

### Nicht geprüft (Umfang / Abhaengigkeit)

- **Rewarded-Ad-Callbacks und Kaufbelege:** noch nicht implementiert, daher kein
  Audit. Beim Bau gilt: Belohnung nur nach server-seitig verifiziertem Callback
  bzw. Store-Beleg — nie clientseitig.
- **Supabase RLS:** die produktive DB-Schicht laeuft ueber die eigene API, nicht
  direkt ueber Supabase-Client. Falls je ein direkter Supabase-Zugriff dazukommt,
  muss RLS separat auditiert werden.
- **Kein externer Penetrationstest.** Dieses Dokument ist ein Code-Review und
  ersetzt keine unabhaengige Pruefung vor Veroeffentlichung.

## Empfohlene Reihenfolge

1. CSP-Header ergaenzen (kleiner Aufwand, hoher Wert).
2. Sentry o.ae. anschliessen.
3. Bei Multi-Replica: geteiltes Rate-Limiting.
4. Vor Store-Release: Auth-Umstellung sicher gestalten, dann externen Pentest.
