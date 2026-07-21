# Infrastruktur-Entscheidung — Aurora Casino

Stand: 22.07.2026

Dieses Dokument begruendet die **Wahl** der Zielarchitektur. Das *Wie* der
Umsetzung steht in `docs/MIGRATION.md`, die reproduzierbaren Deploy-Schritte in
`docs/deployment-guide.md`.

## Die eine Randbedingung, die alles bestimmt

Die Web-App laeuft als `output: "standalone"` — ein **Node-Server**, kein
statischer Export. Das ist keine Stil-Frage, sondern folgt aus der Architektur:

- Das **Player-BFF** (`/api/player/[...path]`) laeuft server-seitig und haelt die
  httpOnly-Cookies mit den Zugangsdaten.
- Ein **Intervall-Worker** liefert Push-Nachrichten aus.
- Der **Rate-Limiter** braucht einen langlebigen Prozess.

Jede Zielplattform muss also einen langlebigen Node-Prozess betreiben koennen.
Reines Static-Hosting scheidet damit aus — es wuerde genau die Schicht
entfernen, die die Anmeldung sicher macht.

## Bewertung der Optionen

| Plattform | Rolle | Bewertung |
|---|---|---|
| **Vercel** | Frontend + BFF | Funktioniert heute, aber: Serverless-Funktionen sind kurzlebig — der Push-Worker ist dort faktisch tot, und der In-Memory-Rate-Limiter verliert bei jedem Cold Start seinen Zustand. Hobby-Kontingent limitiert Builds. **Uebergangsloesung, nicht Ziel.** |
| **Railway** | API/Worker | Langlebige Container, Healthcheck, Restart-Policy. Passt exakt zum Bedarf (Worker + Pools + Limiter). **Gewaehlt fuer das Backend.** |
| **Cloudflare Pages** | Frontend | Guenstig, schnell, globales CDN. Fuer das Next-Frontend via OpenNext. **Gewaehlt fuers Frontend.** |
| **Cloudflare Workers** | API-Alternative | Verlockend, aber das V8-Isolate-Modell passt schlecht zum langlebigen Worker + Postgres-Pool. Mehr Umbau als Nutzen. **Verworfen fuers Backend.** |
| **Supabase** | DB + Auth | Managed Postgres, Backups, RLS verfuegbar. Die App spricht heute ueber die eigene API mit der DB, nicht ueber den Supabase-Client — Supabase ist also primaer der Postgres-Anbieter. **Gewaehlt.** |
| **Cloudflare R2** | Assets | S3-kompatibel, kein Egress-Preis. Fuer Slot-Cover, Symbole, spaeter Audio. **Gewaehlt.** |
| **Sentry o.ae.** | Monitoring | Noch nicht angeschlossen — dokumentierte Luecke. |

## Gewaehlte Zielarchitektur

```
Frontend  : Cloudflare Pages (Next via OpenNext)
API/Worker: Railway (langlebiger Node-Container)
DB/Auth   : Supabase (managed Postgres, RLS)
Assets    : Cloudflare R2
Mobile    : Capacitor-Huelle (siehe docs/mobile-capacitor.md)
Monitoring: Sentry (offen)
```

## Leitgedanke

Die Vorgabe war die **einfachste stabile** Architektur — nicht die modernste.
Cloudflare Workers fuers Backend waere moderner, brauchte aber einen Umbau des
Worker- und Pool-Modells, ohne dass der Nutzen den Aufwand traegt. Railway loest
dasselbe Problem mit weniger Reibung. "Boring" ist hier ein Feature.

## Was diese Entscheidung offen laesst

- Der Wechsel weg von Vercel ist ein **eigener Schritt** mit deinen Zugaengen
  (Phase 0 in MIGRATION.md, ~15 Min Klickarbeit). Bis dahin laeuft die App
  weiter auf Vercel — der aktuelle Betrieb ist davon nicht blockiert.
- **Kein blinder Umzug.** Der Wechsel bringt erst dann Nutzen, wenn Push-Worker
  und geteiltes Rate-Limiting wirklich gebraucht werden (Skalierung). Fuer den
  jetzigen Stand ist Vercel tragbar.
