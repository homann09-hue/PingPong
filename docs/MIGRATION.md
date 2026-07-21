# Migrationsplan: Produktionsarchitektur

Ziel-Architektur (statt "alles auf Vercel"):

| Komponente | Heute | Ziel | Warum |
|---|---|---|---|
| Frontend (player-web, Next.js) | Vercel | **Cloudflare Pages** (OpenNext) | Globales CDN, unbegrenzte Bandbreite, guenstiger bei Skalierung |
| Backend (apps/api, Fastify) | Vercel Serverless | **Railway** (Container, dieses Repo: `apps/api/Dockerfile` + `railway.json`) | Langlebige Prozesse: Push-Worker, DB-Pools und Rate-Limiter funktionieren serverless nicht zuverlaessig |
| Datenbank | Vercel Postgres/eigene | **Supabase Postgres** | Managed Postgres + Auth (bereits integriert!) + Realtime fuer spaeter |
| Auth | Supabase (bereits eingebaut) | Supabase | `SupabaseIdentityVerifier` existiert schon |
| Assets (Slot-Grafiken ~50MB) | Im Next-Build | **Cloudflare R2** + Custom Domain | Builds werden klein/schnell, Assets global gecacht, keine Egress-Kosten |
| Mobile | Flutter (iOS/Android) | **Flutter bleibt** | Native Runner, StoreKit/Play Billing und komplette Slot-Praesentation existieren; Capacitor um die 1-Slot-Web-App waere ein Rueckschritt. Capacitor-Pfad siehe unten. |

---

## Phase 0 — Voraussetzungen (du, ~15 Min Klickarbeit)

1. **Railway**: Account + neues Projekt `aurora-api`, "Deploy from GitHub repo" -> dieses Repo. Railway erkennt `railway.json` automatisch (Dockerfile-Build, Healthcheck `/health/ready`).
2. **Supabase**: Projekt anlegen (EU-Region). Connection-String (Pooler, "Transaction" Modus, Port 6543) notieren.
3. **Cloudflare**: Account + R2-Bucket `aurora-assets` + Pages-Projekt (siehe Phase 3).

## Phase 1 — Datenbank zu Supabase

1. Im Supabase SQL-Editor die Migrationen aus `infra/postgres/` **in Reihenfolge 001→032** ausfuehren (024_multi_currency vor 024_operations_health, wie in der README dokumentiert).
2. Bestandsdaten (falls vorhanden): `pg_dump --no-owner alte_db | psql supabase_db`.
3. Supabase Auth: Providers Apple/Google/E-Mail aktivieren; Redirect-URLs eintragen: Web-Callback `https://<domain>/auth/callback`, nativ `com.aurora.socialcasino://login-callback`.

## Phase 2 — API zu Railway

1. Railway-Service aus dem Repo erstellen (nutzt `apps/api/Dockerfile`).
2. Environment-Variablen setzen (siehe Matrix unten). **DEMO_MODE nicht setzen** — Produktion erzwingt damit alle Secrets.
3. Deploy abwarten, pruefen: `GET https://<railway-domain>/health/ready` -> ok.
4. player-web (`AURORA_API_URL`) auf die Railway-URL umstellen — erst im Staging, dann Produktion.

### Env-Matrix (apps/api)
| Variable | Quelle |
|---|---|
| DATABASE_URL | Supabase Pooler-URL |
| JWT_SECRET / ADMIN_JWT_SECRET | `openssl rand -base64 48` |
| METRICS_TOKEN / STORE_WEBHOOK_TOKEN | `openssl rand -base64 48` (min. 32 Bytes erzwungen) |
| PUSH_TOKEN_ENCRYPTION_KEY | `openssl rand -base64 32` |
| PUSH_GATEWAY_URL/-TOKEN, STORE_VERIFICATION_URL, STORE_GATEWAY_TOKEN | eure Gateways (bis dahin Staging mit DEMO_MODE) |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | Supabase Project Settings |

## Phase 3 — Frontend zu Cloudflare Pages

Next.js 15 laeuft auf Cloudflare ueber **OpenNext** (einzige Aenderung mit neuer Dependency — lokal ausfuehren, weil die package-lock.json neu geschrieben wird):

```bash
cd apps/player-web
npm i -D @opennextjs/cloudflare wrangler
npx cloudflare create # erzeugt open-next.config.ts + wrangler.jsonc
```

Pages-Projekt: Build-Command `npx opennextjs-cloudflare build`, Output `.open-next/assets`, Env-Vars: `AURORA_API_URL` (Railway), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Hinweis: `next/image`-Optimierung auf Cloudflare ueber Cloudflare Images oder `images.unoptimized` + vor-skalierte R2-Assets.

## Phase 4 — Assets zu R2

1. `apps/player-web/public/assets/` in den R2-Bucket laden: `npx wrangler r2 object put ...` oder Drag&Drop im Dashboard.
2. R2 Custom Domain `assets.<domain>` aktivieren (bekommt automatisch Cloudflare-CDN).
3. In player-web einen `NEXT_PUBLIC_ASSET_BASE` einfuehren und Bildpfade darauf umstellen (kleiner Refactor, ~10 Stellen; bis dahin liefern Pages die Assets aus dem Build — funktioniert auch).

## Phase 5 — DNS-Cutover (ohne Downtime)

1. Staging-Test: Pages-Preview gegen Railway-API + Supabase komplett durchspielen (Spin, Boni, Account-Linking).
2. Domain bei Cloudflare: `app.<domain>` -> Pages, `api.<domain>` -> Railway (CNAME), `assets.<domain>` -> R2.
3. TTL vorher auf 300s senken, umstellen, Vercel-Projekte 1 Woche als Fallback stehen lassen.

**Rollback**: DNS zurueck auf Vercel; DB bleibt Supabase (API-URL ist der einzige Kopplungspunkt).

---

## Skalierung auf 100.000+ Nutzer

- **API**: Railway horizontal (Replicas erhoehen). Achtung: der eingebaute `FixedWindowRateLimiter` ist prozess-lokal — ab >1 Replica zusaetzlich Cloudflare Rate Limiting Rules vor `api.<domain>` (z.B. 100 req/min/IP auf `/v1/*`, strenger auf `/v1/auth/*`).
- **DB**: Supabase Pooler (Transaction Mode); `PostgresSpinStore` nutzt bereits Idempotenz + kurze Transaktionen. Ab ~5k Spins/min: Read-Replicas fuer Profile/Leaderboards.
- **Push-Worker**: laeuft im Railway-Container weiter (war auf Vercel faktisch tot — Serverless beendet den Interval-Worker!). Bei mehreren Replicas: Worker nur auf einem Service laufen lassen (eigener Railway-Service mit gleichem Image und Env `WORKER_ONLY=true` — kleiner Code-Schalter, siehe offene Punkte).
- **Metriken**: `/internal/metrics` (Prometheus) an Grafana Cloud Free anbinden; Railway-Logs -> Logtail/Axiom.
- **Error-Monitoring**: Sentry SDK (`@sentry/node`, `@sentry/nextjs`) — lokal installieren (Lockfile!), DSN als Env. Bis dahin: Fastify-Logger (pino, aktiv) + Vercel/Railway-Logs.

## Capacitor (optional, dokumentiert wie gewuenscht)

Wenn spaeter doch eine Web-Wrapper-App gewollt ist: `cd apps/player-web && npm i @capacitor/core @capacitor/cli && npx cap init "Aurora Casino" com.aurora.casino --web-dir=.next-static-export`. Voraussetzungen: statischer Export oder Remote-URL-Modus (`server.url` auf die Pages-Domain), Push via `@capacitor/push-notifications`, Deep Links via `@capacitor/app` (`appUrlOpen`), Updates via Capgo. **Empfehlung bleibt: Flutter-App ausbauen** — sie kann bereits alle 8 Slots nativ.
```
Store-App = apps/mobile (Flutter) — iOS-Deployment-Target jetzt 15.0, CI gruen.
```
