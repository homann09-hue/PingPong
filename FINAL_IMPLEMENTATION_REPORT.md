# Abschlussbericht — Aurora Casino

Stand: 22.07.2026 · 21 gemergte PRs · CI (node, flutter, ios) durchgehend grün

Dieser Bericht misst den Ist-Stand ehrlich gegen die Definition of Done aus dem
Auftrag. Wo etwas fehlt, steht das hier so deutlich wie das, was fertig ist —
ein Bericht, der nur Erfolge listet, ist als Entscheidungsgrundlage wertlos.

## Kurzfassung

Die **Web-App ist der reife Client** und traegt die gesamte Funktionalitaet.
Sie ist spielbar, server-autoritativ und mobil-tauglich. Der Weg in die Stores
ist **vorbereitet, aber nicht abgeschlossen**: die native Auth-Umstellung, echte
In-App-Kaeufe und Rewarded Ads fehlen und sind kein CSS-Nachmittag.

## Definition of Done — Punkt für Punkt

| Kriterium | Stand |
|---|---|
| Web-App startet | **Ja** — lokal via `DEMO_MODE`, API + BFF laufen |
| iOS-App baubar | **Vorbereitet** — Capacitor-Config liegt, Projekt via Skript zu erzeugen (braucht npm+Xcode) |
| Android-App baubar | **Vorbereitet** — wie iOS |
| ≥ 10 Slots spielbar | **8 von 10** — ehrliche Lücke, siehe unten |
| Jeder Slot eigene Features | **Ja** — 22 ADRs dokumentieren die Feature-Vielfalt je Slot |
| Animationen laufen | **Ja** — Walzen, Gewinn-Inszenierung, Jackpot, Glücksrad |
| Sound | **Teilweise** — synthetische Töne, kein produziertes Audio |
| Spin-Mathematik korrekt | **Ja** — 1M-Spin-Sims je Slot, RTP 93,2–94,8 % |
| Wallet-Transaktionen sicher | **Ja** — immutable Ledger, Idempotenz, `FOR UPDATE`, DB-CHECK |
| Freispiele | **Ja** — konfiguriert und simuliert (ADR 0017) |
| Bonusspiele | **Ja** — Pick, Hold-and-Win, Coin-Collect (ADR 0013) |
| Paytables vollständig | **Ja** — pro Slot, mit RTP/Volatilität/Max-Win aus der API |
| Lobby und Navigation | **Ja** — mobil-tauglich, Kategorien, Bottom-Nav |
| Tägliche Belohnungen | **Ja** — server-getimt (ADR 0009) |
| Missionen | **Ja** — server-abgeleitet (ADR 0011) |
| Shop technisch | **Teilweise** — Gems→Coins funktioniert, echte IAP fehlen |
| Rewarded Ads | **Nein** — Backend-Routen frei, keine Ad-Integration |
_(Turniere sind doch fertig: die Lobby rendert Name, Preispool, Rangliste und eigenen Rang aus `profile.tournament` — meine urspruengliche Aussage hier war falsch.)_

| Adminpanel | **Teilweise** — Slot-Verfügbarkeit/Wartung; nicht der volle Umfang aus Abschnitt 13 |
| Keine kritischen Sicherheitslücken | **Kein Exploit im Spin/Wallet-Pfad gefunden** — aber kein formales security-audit.md |
| Keine TypeScript-/Buildfehler | **Ja** — CI grün |
| Automatisierte Tests bestehen | **Ja** — Engine-, BFF-, Integrationstests |
| Mobile-Layouts geprüft | **Ja** — auf 402px gemessen, nicht geschätzt |
| Deployment dokumentiert | **Ja** — `docs/deployment-guide.md`, `docs/MIGRATION.md` |
| Restprobleme transparent | **Ja** — dieser Bericht |

## Die 8 Slots und ihre Mathematik

Alle Werte aus reproduzierbaren 1.000.000-Spin-Simulationen mit festen Seeds,
committet unter `reports/slot-math/`. Ziel-RTP 94 %, gemessene Abweichung im
Rahmen der Social-Casino-Toleranz.

| Slot | Sim-RTP | Trefferquote |
|---|---|---|
| Neon Nights | 94,56 % | 48,5 % |
| Dragon Peak | 94,80 % | 32,2 % |
| Frozen Kingdom | 94,38 % | 46,5 % |
| Vegas Gold | 93,72 % | 52,3 % |
| Pharaoh Oasis | 93,53 % | 38,9 % |
| Jungle Temple | 93,49 % | 32,3 % |
| Pirate Bay | 93,36 % | 30,0 % |
| Candy Carnival | 93,21 % | 63,3 % |

Die Spanne der Trefferquoten (30–63 %) spiegelt bewusst unterschiedliche
Volatilitäten: Candy Carnival zahlt oft klein, Pirate Bay selten gross.

## Was umgesetzt wurde (Auswahl der 21 PRs)

- **Spielbarkeit:** alle 8 Slots im Web, server-autoritativ, mit Paytable-Transparenz
- **Meta:** Boost-Center (Check&Win, Booster, Loyalität, High Roller), Shop, Glücksrad, Event-Meilensteine, Missionen, Wallet-Historie
- **Optik:** drehende Walzen mit Kabinett, Vollbild-Gewinn-Inszenierung, senkrechte Jackpot-Leiter, bewegter Hintergrund, Vollbild-Bonusrad
- **Mobil:** Spielen ohne Scrollen, Safe-Areas, 44px-Tippziele — auf Gerätebreite gemessen
- **Sicherheit:** BFF-Allowlist mit Vertragstest, der jede neue API-Route erzwingt; Datenleck im öffentlichen Slot-Endpunkt geschlossen
- **Recht:** Altersabfrage 18+, Consent, 4 Rechtstexte, Verantwortungsvoll-Spielen-Hinweis, überall "virtuelles Spielgeld ohne realen Gegenwert"

## Ehrlich offen — und warum

### Store-Reife (der grösste Block)

1. **Native Auth-Umstellung.** Die Anmeldung liegt in httpOnly-Cookies, gehalten
   vom server-seitigen BFF. In einer Capacitor-Hülle unter `capacitor://localhost`
   sind das Drittanbieter-Cookies und werden von ITP blockiert. Ohne Umzug auf
   Keychain/Keystore ist die App entweder eine reine Webansicht (Apple 4.2:
   Ablehnungsrisiko) oder nicht anmeldbar. Mehrere Tage Arbeit. Details:
   `docs/mobile-capacitor.md`.
2. **iOS/Android-Projekte** sind nicht erzeugt — das braucht npm+Xcode/Studio,
   nicht ausführbar in dieser Umgebung. Skript liegt bereit.
3. **Echte In-App-Käufe** (StoreKit/Play Billing) fehlen. Der Shop tauscht heute
   nur Gems gegen Coins.
4. **Rewarded Ads** fehlen komplett.
5. **App-Icons und Splash** in Store-Grössen fehlen.

### Funktional

- **2 Slots bis zum DoD-Ziel** von 10. Die Produktionspipeline (Config +
  Feature-Module) steht, es fehlt die inhaltliche Ausarbeitung zweier Themen.
- **Clans:** Backend-Routen freigeschaltet, keine Oberfläche. Clans
  sind mit 13 Routen der grösste UI-Rest.
- **Audio:** nur synthetische Töne, kein produziertes Sounddesign.
- **Admin-Dashboard:** nur Slot-Verfügbarkeit. Der Vollumfang aus Abschnitt 13
  (RTP-Versionierung, Events, Promo-Codes, Telemetrie …) ist offen.

### Dokumente, die der Auftrag nennt und die noch fehlen

- `docs/security-audit.md` und `docs/threat-model.md` — der Spin/Wallet-Pfad
  wurde geprüft (kein Exploit), aber nicht in dieser Form verschriftlicht.
- `docs/infrastructure-decision.md` — die Entscheidung ist in `MIGRATION.md`
  getroffen, aber nicht unter diesem Namen.

### Betrieb

- **Produktions-Deploy hängt** einen Stand zurück: Vercel-Kontingent (Hobby-Tarif)
  war erschöpft. Die API ist aktuell, die Web-App nicht. Läuft nach Ablauf der
  24h-Sperre beim nächsten Push automatisch nach.
- **Kein Error-Monitoring** (Sentry o.ä.) angeschlossen.

## Veröffentlichungs-Voraussetzungen (nur du/Rechtsberatung)

- **Impressum-Daten** — harter Store-Blocker, `TODO_LEGAL` im Repo. Nur du.
- **Juristische Prüfung** der Social-Casino-Einstufung, Altersfreigabe und
  Glücksspiel-Abgrenzung. Die Grundlage liegt in `docs/legal-compliance.md`,
  ersetzt die Prüfung aber nicht. **Ich erfinde keine rechtliche Freigabe.**
- **Apple-Developer- und Google-Play-Zugänge** für Signierung und Store-Einträge.

## Konkrete nächste Schritte (nach Nutzen)

1. Impressum-Daten liefern → Rechtstexte finalisieren.
2. Native Auth-Umstellung (Stufe 2) — der eigentliche Store-Blocker.
3. `Capacitor einrichten.command` ausführen → Gerätebuild → TestFlight.
4. Slots 9 und 10 ausarbeiten.
5. Clan-Oberfläche (Turniere sind bereits in der Lobby umgesetzt).
6. IAP- und Rewarded-Ads-Brücken.
7. security-audit.md / threat-model.md verschriftlichen, Sentry anschliessen.

## Benötigte externe Zugangsdaten (Zusammenfassung)

| Variable / Zugang | Wofür | Status |
|---|---|---|
| Impressum-Daten | Rechtstexte, Store | fehlt (nur du) |
| Apple Developer | Signierung, TestFlight | fehlt (nur du) |
| Google Play Console | Signierung, Store | fehlt (nur du) |
| `AURORA_MOBILE_SERVER_URL` | Capacitor Stufe 1 | dokumentiert, Standardwert gesetzt |
| StoreKit/Play Billing Keys | echte IAP | fehlt |
| Ad-Network SDK-Keys | Rewarded Ads | fehlt |
| Sentry DSN | Error-Monitoring | fehlt |
