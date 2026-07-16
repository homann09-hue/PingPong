# Aurora Social Casino

Production-oriented foundation for a server-authoritative, free-to-play social casino.

## Repository layout

- `apps/api` — public HTTP API and composition root
- `apps/mobile` — Flutter client shell (iOS, Android, Web)
- `packages/slot-engine` — deterministic, framework-independent slot domain
- `infra/postgres` — PostgreSQL schema and invariants
- `docs` — architecture, decisions, security, and delivery roadmap

## Quick start

Requires Node.js 22+.

```sh
npm install
npm test
npm run build
npm run dev
```

The API listens on `http://localhost:8080`. Server-authoritative spin endpoints
are available for `pharaoh-oasis`, `dragon-peak`, `candy-carnival`,
`pirate-bay`, `neon-nights`, `frozen-kingdom`, `jungle-temple`, `vegas-gold`,
and the engine reference games. Use an `Idempotency-Key` header.

## Play locally

After the project-local Flutter SDK has been installed in `.tools/flutter`, run:

```sh
npm run play
```

Native iOS and Android runners are included. Their pinned toolchain, StoreKit /
Google Play Billing lifecycle, simulator endpoints, product configuration, and
release gates are documented in `docs/work-packages/phase10-native-store.md`.

Open `http://localhost:8080`. The playable world-tour lobby contains eight
config-driven slot themes with jackpots, progression, free spins, expanding
wilds, sticky wilds, walking wilds, bounded respins, cascades, treasure picks,
a deterministic bonus wheel, hold-and-win,
respin/bonus presentation, and server-authoritative balances. This uses an
explicitly isolated demo identity and in-memory wallet. Production mode never
enables these adapters.

Each theme now ships with its own background, reel treatment, jackpot values,
and six optimized transparent symbols (48 bespoke symbols total). Spin results
are animated round by round so base wins, cascades, and awarded free spins are
visible instead of being collapsed into one final result. Pirate Bay contains a
server-authoritative treasure-pick bonus, Jungle Temple a wheel bonus, and Vegas
Gold a deterministic hold-and-win sequence with persistent coin positions,
three visible respin lives, reset-on-hit behavior and server-assigned values.
Neon Nights now walks wilds across deterministic respin rounds, Frozen Kingdom
retains sticky wild positions through its free-spin sequence, and Pharaoh Oasis
awards two bounded scatter-triggered respins.
Dragon Peak applies a capped 2× multiplier for every winning wild on a payline
(up to 32×). Candy Carnival now uses the advertised sticky-wild state throughout
its free-spin sequence instead of an expanding-wild approximation.
Jungle Temple v3 promotes every visible J→Q, Q→K and K→A when three temple
bonus symbols land, before the server evaluates the upgraded grid.
Frozen Kingdom v3 uses contiguous wild blocks embedded directly in all five
reel strips. Visible stacks are reported by the engine and highlighted by the
client before sticky-wild persistence continues through free spins.
Neon Nights v3 adds visible ×2 symbols that combine additively up to ×8 and
multiply the complete authoritative round win. The engine returns their exact
positions and applied factor for client animation and settlement audit.
Dragon Peak v3 replaces its fixed free-spin multiplier with an Ultimate Free
Spins ladder: spins 1–3 use ×2, spins 4–7 use ×3, and spin 8 onward uses ×5.
Every free-spin round reports its index and active ladder factor.

All eight games use a server-authoritative local jackpot ladder. Three, four,
or five scatters award MINI (5×), MINOR (25×), or GRAND (500×) respectively.
The in-game meters show the exact payout for the selected bet, and jackpot wins
are returned as auditable bonus rounds with their tier and scatter count.

Pirate Bay, Jungle Temple, and Vegas Gold expose a play-money-only Bonus Buy.
The API validates eligibility, charges the configured 50× wager atomically, and
forces the selected server-authoritative bonus state. The result records base
bet, actual wallet debit, and purchase mode for replay and audit.

Direct game links are available for visual and gameplay QA:

- `http://localhost:8080/?game=pharaoh-oasis`
- `http://localhost:8080/?game=dragon-peak`
- `http://localhost:8080/?game=candy-carnival`
- `http://localhost:8080/?game=pirate-bay`
- `http://localhost:8080/?game=neon-nights`
- `http://localhost:8080/?game=frozen-kingdom`
- `http://localhost:8080/?game=jungle-temple`
- `http://localhost:8080/?game=vegas-gold`

## Slot math model

The eight themes now publish math version 2. Each uses 20 paylines and treats
the wallet debit as total bet, not bet per line. The evaluator divides total
bet across active lines, pays leading and all-wild combinations, supports
optional both-ways evaluation, and keeps scatter awards based on total bet.
Cascades use gravity/refill behavior and bounded multiplier ladders; free-spin
multipliers are settled by the engine. Bonus and free-spin scatters are separate
symbols, preventing an ordinary free-spin trigger from silently awarding every
other feature at once.

Every theme has a distinct versioned reel model and its own paytable/feature
profile. A deterministic 100,000-spin calibration sample per theme currently
measures approximately 92.3–96.0% return and 32.1–52.5% spin hit frequency.
These samples are regression evidence, not a substitute for exact combinatorial
certification. The in-game info button reads the published server paytable,
RTP target, volatility, and line count.

Published themes accept only the server-advertised stake steps from 100 to
10,000 coins and enforce a configured max-win multiplier. Win classes and
max-win state are returned by the authoritative engine. Production seeds remain
in the settlement audit record but are removed from every client response.

Run the deterministic math CLI with:

```sh
npm run math:simulate -- --spins=100000 --bet=100
npm run math:simulate -- --spins=10000000 --slot=pharaoh-oasis --bet=100
```

The JSON report includes RTP contribution by phase, deviation from target,
95% confidence interval, variance, standard deviation, hit/profit frequency,
feature and jackpot frequency, win distribution, observed max win, and streaks.

The bottom navigation now opens working Quest, Club, Event, and Shop surfaces.
Spins update server-calculated XP, level, spin count, total won, and free-spin
progress. The VIP badge opens a five-tier progression model, the Quest surface
includes server-calculated achievements, and Events contains a live tournament
score plus leaderboard. Daily, quest, and achievement rewards are credited through
`POST /v1/rewards/:rewardId/claims`; duplicate grants are rejected by the store
and unmet objectives are rejected before settlement. PostgreSQL also enforces a
unique database constraint. Apply
`infra/postgres/002_spin_progression.sql` and
`infra/postgres/003_spin_audit.sql` and
`infra/postgres/004_wallet_ledger_audit.sql` and
`infra/postgres/005_identity_sessions.sql` and
`infra/postgres/006_timed_rewards.sql` and
`infra/postgres/007_bonus_wheels.sql` and
`infra/postgres/008_missions.sql` and
`infra/postgres/009_mission_tiers.sql` when upgrading an existing database.

The Club surface is backed by the authenticated social API rather than local
widget state. It supports durable friend requests, accepted friendships, clan
creation, clan discovery, membership and leave operations. PostgreSQL enforces
one clan per player, canonical friendship pairs, unique pending requests and
unique clan names/tags. Apply `infra/postgres/014_social.sql` for this slice.
Owners and officers can now issue durable clan invitations, while members share
a cursor-paginated, rate-limited feed with author and role-based moderation.
Apply `infra/postgres/020_clan_community.sql` and see
`docs/work-packages/phase13-clan-community.md`.
Players can report active messages by policy reason. A dedicated
`social_moderator` workforce role reviews the aggregated queue, removes or
dismisses each case exactly once, and records an immutable staff action without
exposing reporter identities to other players. Apply
`infra/postgres/021_clan_moderation.sql` after the community migration. The
staff workflow is available from the Moderation tab at `/admin/`; demo mode
uses the isolated `local-admin-moderator` identity.
Clan owners can promote up to five officers, demote them, remove members and
transfer ownership without creating an ownerless committed state. Officers may
remove ordinary members but cannot change roles or act on other officers. Apply
`infra/postgres/022_clan_member_management.sql`; every role, removal and
ownership mutation creates an immutable action record.

Player support now has a searchable player/economy view and a four-eyes grant
workflow. Support operators can request bounded positive coin or gem grants, but
only a different approver can book them. Approval atomically updates the wallet,
adds an `admin_grant` ledger entry and appends the workforce audit record; there
is no direct balance setter. Apply `infra/postgres/023_economy_admin.sql` after
the core and LiveOps admin migrations. Demo mode provides separate support and
approver buttons in `/admin/`.

The lobby promotion is backed by the LiveOps campaign API. Workforce tokens use
a dedicated issuer/audience and secret, with separate editor, publisher and
auditor roles. Campaigns remain invisible to players until a different operator
publishes them; creation and publication are written to an append-only audit
log. Level/VIP targeting and active UTC windows are evaluated by the server.
Apply `infra/postgres/015_liveops_admin.sql` and configure a separate
`ADMIN_JWT_SECRET` before starting production mode.

The staff console is served at `http://localhost:8080/admin/`. It provides a
responsive campaign registry, draft form, role-separated publication action and
immutable audit view. Published campaigns can be queued as idempotent push
dispatches for eligible, opted-in installations. In demo mode use the explicit editor/publisher buttons;
production operators supply a short-lived workforce JWT. The console never
persists that token and is served with a strict CSP and `no-store` caching.

The Operations tab provides a curated read-only health snapshot for the
dedicated `operations_viewer` workforce role. It combines database readiness,
process counters and durable queue aggregates for economy approvals, moderation,
push, analytics and staff audit activity without exposing player identifiers or
provider secrets. See `docs/work-packages/phase14-operations-health.md`.
Apply `infra/postgres/024_operations_health_indexes.sql` after migrations 16,
17, 21 and 23 before enabling the production console.

Operational probes are available at `GET /health` and `GET /health/ready`.
Prometheus-format runtime metrics are exposed at `GET /internal/metrics` only
with `Authorization: Bearer <METRICS_TOKEN>`; production requires a token of at
least 32 bytes. Authenticated clients can submit the constrained, idempotent
analytics taxonomy through `POST /v1/analytics/events`. Analytics delivery is
best-effort and never participates in gameplay settlement. Apply
`infra/postgres/016_observability_analytics.sql`, schedule its retention function,
and see `docs/work-packages/phase7-observability-analytics.md` for the privacy and
operations boundary.

Notification preferences and provider installation registrations are available
under `/v1/messaging`. Marketing starts disabled, quiet hours use the player's
IANA time zone, and provider tokens are encrypted at rest. The durable worker
supports APNs, FCM and Web Push through a normalized HTTPS gateway, bounded retries
and invalid-token retirement. Apply `infra/postgres/017_push_messaging.sql` and
configure `PUSH_TOKEN_ENCRYPTION_KEY`, `PUSH_GATEWAY_URL` and
`PUSH_GATEWAY_TOKEN`. See
`docs/work-packages/phase8-push-messaging.md` for the native provisioning boundary.

Virtual coin bundles use the separate `/v1/store` purchase boundary. The server
verifies account-bound provider transactions before an atomic wallet grant,
deduplicates transaction IDs globally, stores only proof hashes, and idempotently
reconciles refunds without allowing negative balances. Apply
`infra/postgres/018_store_monetization.sql` and
`infra/postgres/019_native_store_semantics.sql` in order, then configure
`STORE_VERIFICATION_URL`, `STORE_GATEWAY_TOKEN`, and `STORE_WEBHOOK_TOKEN`.
Localized prices always come from StoreKit or Google Play. See
`docs/work-packages/phase9-store-monetization.md`.

Authenticated wallet reads are available through `GET /v1/wallet` and
`GET /v1/wallet/transactions?limit=50`. Ledger rows are immutable, use a
transaction-specific idempotency key, include balances before and after, and
are constrained by PostgreSQL to form a valid arithmetic transition.

Identity endpoints are `POST /v1/auth/guest`, `POST /v1/auth/refresh` and
`POST /v1/auth/logout`. Access tokens expire after 15 minutes and are accepted
only while their server session remains active. Opaque refresh tokens rotate on
every use; only their SHA-256 hashes are stored. Flutter keeps access tokens in
memory, stores refresh credentials in platform secure storage, serializes token
rotation, and retries an authenticated request at most once after `401`. See
`docs/work-packages/phase11-client-session.md`.

Authenticated account management is available through `GET /v1/auth/sessions`,
`DELETE /v1/auth/sessions/{sessionId}`, `POST /v1/auth/logout-all`, and
`DELETE /v1/profile`. Auth responses are non-cacheable and protected by a
single-process defense-in-depth limiter; production replicas additionally need
an ingress- or Redis-backed distributed limit.

Timed rewards use `GET /v1/rewards/hourly`, `POST /v1/rewards/hourly/claim`,
`GET /v1/rewards/daily`, and `POST /v1/rewards/daily/claim`. Availability,
streaks and values use server UTC time and settle through the immutable ledger.

The Standard Wheel is available through `GET /v1/rewards/wheels/standard` and
`POST /v1/rewards/wheels/standard/spin`. A spin requires a UUID idempotency key
and a persisted entitlement earned from four hourly claims.

Daily missions are read through `GET /v1/missions` and claimed through
`POST /v1/missions/{missionId}/claim`. Progress comes only from authoritative
settled spins and is partitioned by UTC day.

Generated production assets are grouped by theme under
`apps/mobile/assets/symbols/`; the player portrait is under
`apps/mobile/assets/ui/`. Flutter declares these folders explicitly so missing
assets fail during the release build rather than at runtime.

For local persistence, start PostgreSQL with `docker compose up -d postgres`,
apply `infra/postgres/001_core.sql`, and provide the variables from `.env.example`.

## Scope

This repository is a tested vertical slice rather than claiming that a
multi-year live game is complete. The implementation includes the deterministic
slot kernel, configuration validation, a server-authoritative API boundary, and
database invariants. The staged production plan is in
[`docs/ROADMAP.md`](docs/ROADMAP.md).
