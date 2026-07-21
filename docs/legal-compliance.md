# Rechts- und Store-Compliance

Stand: 21.07.2026. Dieses Dokument beschreibt den **technischen Umsetzungsstand** und listet alle Punkte,
die vor einer Veroeffentlichung **durch eine qualifizierte Rechtsberatung** geprueft werden muessen.

> **Wichtig:** Hier wird keine rechtliche Freigabe erteilt oder behauptet. Die Texte in
> `apps/player-web/src/lib/legal-content.ts` sind ein fachlich vorbereitetes Geruest mit
> `TODO_LEGAL`-Markierungen an allen Stellen, die echte Unternehmensdaten oder eine anwaltliche
> Pruefung erfordern.

## Umgesetzt (technisch)

| Anforderung | Status | Umsetzung |
|---|---|---|
| Social-Casino-Hinweis | ✅ | Persistenter Footer auf jeder Seite (`LegalFooter`), Hinweis im Slot-Screen, Hinweis in der Altersabfrage |
| Hinweis "nur virtuelle Waehrung" | ✅ | Footer + Nutzungsbedingungen + Responsible-Play-Seite |
| Hinweis "keine Echtgeldgewinne" | ✅ | ebenda, inkl. Uebungserfolg-Disclaimer |
| Altersabfrage 18+ | ✅ | `AgeGate` blockiert die App bis zur Bestaetigung; Entscheidung wird lokal gespeichert |
| Zustimmung zu Nutzungsbedingungen | ✅ | Teil der Altersabfrage, mit Links auf die Volltexte |
| Consent-Management (Analyse) | 🟡 | Granulare Opt-in-Checkbox in der Altersabfrage; **noch nicht** an ein Analytics-SDK gekoppelt (es ist noch keines aktiv) |
| Datenschutzerklaerung | 🟡 | Volltext-Geruest unter `/legal/datenschutz`; Auftragsverarbeiter erst nach Infrastruktur-Migration final |
| Nutzungsbedingungen | 🟡 | Volltext-Geruest unter `/legal/nutzungsbedingungen` |
| Impressum | 🔴 | Struktur vorhanden, **Unternehmensdaten fehlen** (`TODO_LEGAL`) — Launch-Blocker |
| Verantwortungsvolles Spielen | ✅ | `/legal/verantwortungsvolles-spielen` inkl. Hilfsangeboten DE/AT/CH |
| Account-Loeschung | ✅ | Konto → Deine Daten → Konto loeschen (server-seitig, mit Bestaetigung) |
| Datenexport (DSGVO Art. 20) | ✅ | Konto → Datenexport herunterladen (JSON) |
| Support-Kontakt | 🟡 | Platzhalter-Adressen, echte Postfaecher noch einzurichten |
| Robots/Indexierung | ✅ | `/account`, `/auth/`, `/api/` von der Indexierung ausgeschlossen |

## Vor Store-Einreichung erforderlich

### Apple App Store
1. **Alterseinstufung 18+** setzen; Kategorie Casino. Vergleichswert: Wettbewerber sind mit 18+ / "Simulated Gambling" gelistet.
2. **App Tracking Transparency**: Nur erforderlich, wenn ein Werbe-SDK geraeteuebergreifend trackt. Aktuell kein Tracking-SDK aktiv → ATT-Prompt erst mit Einfuehrung von Rewarded Ads implementieren (`NSUserTrackingUsageDescription` in Info.plist).
3. **App-Privacy-Formular**: Zu deklarieren sind derzeit Identifikatoren (Nutzer-/Geraete-ID), Kaeufe, Nutzungsdaten und Diagnosen — jeweils "App-Funktionalitaet" bzw. "Analyse".
4. **Guideline 3.1.1**: Virtuelle Waehrungen ausschliesslich ueber In-App-Purchase verkaufen.
5. **Guideline 5.3**: Nachweis, dass kein Echtgeld-Gluecksspiel vorliegt — unser Disclaimer-Set adressiert das.
6. Support-URL, Datenschutz-URL und Marketing-Text muessen auf erreichbare Seiten zeigen.

### Google Play
1. **Content Rating** (IARC-Fragebogen): "Simulated Gambling" wahrheitsgemaess angeben.
2. **Data-Safety-Formular**: Erhobene Datentypen, Verschluesselung bei der Uebertragung (erfuellt: HTTPS/HSTS), Loeschmoeglichkeit (erfuellt: In-App-Loeschung).
3. **Play-Richtlinie "Gambling, Games, and Contests"**: Social-Casino ohne Echtgeldpreise ist zulaessig; Preise/Gewinne duerfen keinen realen Wert haben.
4. Ziel-API-Level und Datenschutz-Link im Store-Eintrag.

### Beide Plattformen
- **Wiederherstellung von Kaeufen** muss erreichbar sein (StoreKit/Play-Billing-Lifecycle ist in der Flutter-App vorhanden; UI-Einstiegspunkt pruefen).
- **Jugendschutz**: Keine Bewerbung gegenueber Minderjaehrigen; Werbe-Zielgruppen entsprechend einschraenken.

## Offene Punkte fuer die Rechtsberatung (Launch-Blocker)

1. **Impressumsdaten** und zustaendige Rechtsordnung (Sitz des Anbieters) festlegen.
2. **Datenschutzerklaerung**: Auftragsverarbeiter final benennen (nach Migration: Hosting, Datenbank/Auth, CDN, Fehlerueberwachung, Werbepartner), Drittlandtransfers und Rechtsgrundlagen pruefen lassen.
3. **Nutzungsbedingungen**: Haftungsklausel, Regelung zu nicht verbrauchten virtuellen Waehrungen bei Diensteinstellung und Widerrufsrecht im Zielmarkt pruefen lassen.
4. **Gluecksspielrechtliche Einordnung** je Zielmarkt bestaetigen lassen (Social Casino ohne Auszahlung ist in vielen, aber nicht allen Maerkten unproblematisch).
5. **Loot-Box-/Zufallsmechaniken**: Pruefen, ob Offenlegungspflichten fuer Wahrscheinlichkeiten bestehen (relevant fuer Truhen/Rad). Unsere Paytables und RTP-Ziele sind bereits offenlegbar — siehe `reports/slot-math/`.
6. **Werbung/Marketing**: Formulierungen ohne Verwechslungsgefahr mit Echtgeld-Gluecksspiel abstimmen.
7. **Aufbewahrungsfristen** fuer Kauf- und Ledger-Daten festlegen.

## Zusammenhang mit anderen Dokumenten
- Ist-Analyse: `docs/current-state-audit.md`
- Infrastruktur/Migration: `docs/MIGRATION.md`
- Wettbewerbs-Benchmark: `docs/competitor-analysis-lotsa-slots.md`
- Mathematik-Transparenz: `reports/slot-math/`
