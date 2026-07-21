# Ist-Analyse (Current State Audit)

Stand: 21.07.2026 · Nach PR #1 (Web-Fixes) und PR #2 (Production Hardening). CI: **gruen** (node/flutter/ios).

Status-Legende: ✅ funktionsfaehig · 🟡 teilweise · 🔴 fehlerhaft · ⚪ nicht implementiert · ⚠️ unsicher/ungeprueft · 🔧 dringend ueberarbeiten

## Architektur-Ueberblick
Monorepo (npm workspaces): apps/api (Fastify, 80 Dateien), apps/player-web (Next.js 15), apps/mobile (Flutter, iOS/Android/Web), apps/admin (statisches Staff-Console-Frontend), apps/control-center, packages/slot-engine (deterministischer Kernel), packages/design-tokens, infra/postgres (32 Migrationen), scripts (Math-CLI).

## Bewertung pro Bereich

| Bereich | Status | Befund |
|---|---|---|
| Slot-Engine (Kernel) | ✅ | Deterministisch, seeded, 42 Tests inkl. RTP-Guardrails; Features: Lines/Ways/beide Richtungen, Wilds (sticky/expanding/walking/stacked/multiplier), Scatter, Free Spins + Retrigger + Ladder, Cascades, Respins, Hold&Win, Wheel, Pick, Mystery, Symbol-Upgrade, variable Rows, Jackpot-Tiers, Max-Win-Cap, Bonus-Buy. **Fehlt**: Cluster Pays, Scatter-Pays-Modus, Avalanche-Multiplikator-Varianten |
| RNG | ✅ | SplitMix64, Server-Seed (crypto), Seed nie im Client-Response, persistiert fuer Replay |
| Slot-Konfigurationen | ✅ | 8 Themes deklarativ (themed-configs), versioniert, Stake-Steps, RTP-Ziel 93,3–94,4 %, Paytable-API |
| Math-Simulation | ✅ | CLI vorhanden (100k–10M Spins, seeded, JSON-Report) — ab jetzt als CI-Workflow + reports/slot-math/ |
| API/Backend | ✅ | Server-authoritativ, Idempotenz, Ledger mit DB-Invarianten, Rate-Limits (prozess-lokal), CSP/Security-Header, Timing-safe Auth, 14-Waehrungs-Wallet, Missionen/Events/Turnier/Jackpots/Rewards/Shop/Social/Moderation/LiveOps/Push/Store-APIs |
| Datenbank | ✅ | 32 Migrationen, Append-only-Audit, CHECK-Invarianten (balance_after = before + amount), Unique-Claims. 🟡 Kein Migrations-Runner (Reihenfolge manuell dokumentiert) |
| Auth | ✅ | Gast + Refresh-Rotation (SHA-256-Hashes), Supabase-Federation (Apple/Google/E-Mail), Sessions/Geraete-API, BFF haelt Tokens in httpOnly-Cookies |
| Web-Lobby (player-web) | ✅ | Deutsch, echte API-Daten (Missionen/Events/Turnier/Erfolge/Jackpots), Shop-Sektion mit funktionierenden Gratis-Claims, Suche, PWA-Manifest, SEO (robots/sitemap/metadataBase), Security-Header |
| Web-Slots | 🟡 | **1 von 8 spielbar** (Pharaoh Oasis, ohne Animationen/Audio-Assets); 7 zeigen Coming-soon. Groesstes Produkt-Delta |
| Web-Animationen/Audio | 🟡 | Nur synthetische WebAudio-Toene + CSS-Basisanimationen; kein Partikel-/Big-Win-System (Flutter-Client hat all das bereits) |
| Flutter-App | ✅ | Alle 8 Slots mit kompletter Praesentation (Kaskaden, Paylines, Anticipation, Big-Win-Tiers, Feature-Stages), StoreKit/Play-Billing-Lifecycle, 52 Widget-Tests; baut fuer Web/APK/iOS-Simulator (Deployment-Target jetzt 15.0). ⚠️ 8 Lint-Infos offen; Push-Zertifikate/Signing fehlen naturgemaess |
| Admin-Dashboard | 🟡 | Staff-Console (apps/admin): Kampagnen-Registry mit Vier-Augen-Publish, Moderation-Queue, Economy-Grants (Vier-Augen), Operations-Health, strikte CSP. **Fehlt**: Slot-Aktivierung/Wartungsmodus, Lobby-Reihenfolge, Shop-Paket-Verwaltung, Feature-Flags, A/B-Tests, Promo-Codes |
| Shop/Monetarisierung | 🟡 | Play-Money-Shop + Store-Boundary (Receipt-Verifikation, Refund-Reconciliation, Hash-only) implementiert; **Gateways nicht provisioniert** (STORE_VERIFICATION_URL), Web-Coin-Pakete als "Bald" markiert. Rewarded Ads: ⚪ nicht implementiert (Adapter noetig) |
| Push | 🟡 | Durable Worker (APNs/FCM/WebPush ueber Gateway), Token-Verschluesselung; Gateway nicht provisioniert. Auf Vercel war Worker wirkungslos → Railway-Migration noetig |
| Deployment | ✅/🟡 | Vercel produktiv (3 Projekte, grün); Railway/Cloudflare/R2 vorbereitet (Dockerfile, railway.json, docs/MIGRATION.md), Provisioning offen |
| Monitoring | 🟡 | Prometheus-Metriken + strukturierte Logs vorhanden; kein Sentry (Lockfile-Restriktion — lokaler Install noetig) |
| Sicherheit | ✅ | Audit 21.07.: keine Exploits im Spin-/Wallet-Pfad gefunden; CORS zu, Header gesetzt. Offen: Spin-Route ohne Per-Player-Limit, Limiter prozess-lokal (Multi-Replica), kein WAF |
| Rechtliches | 🟡 | Play-Money-Hinweis + 18+-Kontext vorhanden (Slot-Footer); **fehlt**: Datenschutzerklaerung, AGB, Impressum, Altersabfrage-Flow, Consent-Management, ATT, Play-Data-Safety-Formular, Responsible-Play-Seite. ⚠️ Vor Launch juristisch pruefen lassen — wird hier nicht "erfunden" |
| Tests | ✅ | Engine 42, player-web 30, api Unit+Integration (Postgres-Service), Flutter 52; CI gruen. ⚪ E2E (Playwright), Visual Regression, Load |
| Performance | 🟡 | Immutable-Asset-Caching, AVIF/WebP, kein Bundle-Budget/Lighthouse-Gate; Flutter-Web-Bundle gross; Memory-Leak-Test (500 Spins) offen |

## Kritische Luecken (Kurzliste)
1. Web spielt nur 1/8 Slots — Praesentations-Schicht fehlt (Flutter hat sie)
2. Rechtstexte/Consent fehlen komplett (Launch-Blocker Stores!)
3. Rewarded-Ads-System nicht vorhanden
4. Admin: Slot-/Shop-/Flag-Verwaltung fehlt
5. Monitoring (Sentry) + Provisioning (Railway/Supabase/R2/Gateways) offen
6. E2E-/Visual-/Load-Tests fehlen

## Priorisierter Umsetzungsplan
| # | Arbeitspaket | Prio | Aufwand (grob) |
|---|---|---|---|
| 1 | Math-Report-Pipeline in CI (reports/slot-math/) | P0 | heute (diese Session) |
| 2 | Rechtstexte-Geruest + Responsible-Play-Seite + Altersabfrage (Web), juristische Pruefung markiert | P0 | 2–3 Tage |
| 3 | Infrastruktur-Provisioning nach docs/MIGRATION.md (Railway/Supabase), Sentry lokal | P0 | 1–2 Tage |
| 4 | Web-Slot-Runtime v1: gemeinsame Reel-Stage (Canvas/PixiJS), Slots 2–4 portieren | P1 | 2–3 Wochen |
| 5 | Spin-Rate-Limit + WORKER_ONLY-Schalter | P1 | 2 h |
| 6 | Admin-Ausbau: Slot-Toggle/Wartung, Lobby-Reihenfolge, Shop-Pakete, Flags (+ Audit-Log) | P1 | 1–2 Wochen |
| 7 | Rewarded-Ads-Adapter (Mock + AdMob-SSV-Callback serverseitig, Limits/Cooldowns) | P1 | 1 Woche |
| 8 | Slots 5–8 Web + Audio-/Partikel-System, Autoplay/Responsible-Limits | P2 | 3–4 Wochen |
| 9 | E2E (Playwright) + Visual Regression + 500-Spin-Leak-Test | P2 | 1 Woche |
| 10 | Phase-2-Content: Slots 9–25 ueber Config-Pipeline (2 neue Engine-Modi: Cluster/Scatter-Pays) | P3 | fortlaufend |

Details Infrastruktur: docs/MIGRATION.md · Benchmark: docs/competitor-analysis-lotsa-slots.md · Sicherheitsbefunde: Abschlussbericht 21.07. (produktionsreife-bericht)
