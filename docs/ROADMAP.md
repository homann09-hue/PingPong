# Delivery roadmap

## Phase 0 — foundation (current)

Deterministic base engine, versioned config validation, API contract, idempotency,
wallet schema, architecture decisions, CI quality gates, Flutter shell, reusable
simulation CLI, max-win settlement, validated stake steps, and private production
seed handling.

## Phase 1 — playable vertical slice (in progress)

Transactional PostgreSQL adapters, authentication/session rotation, device risk,
outbox, 5x3 rendering at 60 FPS, asset bundles, audio/haptics hooks, telemetry,
exact RTP tooling, load tests, and one production-quality slot.

The telemetry foundation now includes dependency-aware readiness, authenticated
low-cardinality Prometheus metrics, constrained pseudonymous client-event
ingestion, PostgreSQL idempotency and a bounded-retention function. Deployment
dashboards/alerts, OpenTelemetry tracing, crash reporting, consent enforcement
and automated retention scheduling remain launch requirements.

## Phase 2 — engine breadth and economy (started)

Feature state machines for wild variants, scatters, free spins, respins, cascades,
bonus rounds, progressive/local jackpots and play-money bonus buy. Add economy,
XP/levels, VIP, missions, achievements, daily rewards, catalog and receipt-verified
mobile purchases. Remote kill switches accompany every feature.

Implemented vertical slices: server-calculated XP/levels and activity counters,
three claimable quests, a once-per-UTC-day reward, eight theme-specific slots,
free-spin/cascade presentation, a pick bonus, deterministic wheel bonus, and
hold-and-win flow. Sticky wilds, walking wild respins, and symbol-triggered
respins are implemented as bounded deterministic feature states. The current
Dragon multiplier is evaluated per winning payline with a configuration cap;
feature events expose the applied factor to presentation and analytics. The current
meta slice also includes five VIP tiers, three
claimable achievements, an authoritative tournament score, and a leaderboard.
Play-money Bonus Buy is enabled for three bonus-capable games with an
authoritative 50× price, explicit confirmation, and auditable wager metadata.
Every current theme also has a deterministic three-tier local jackpot ladder
with bet-derived meters and server-settled MINI, MINOR, and GRAND awards.
Receipt-verified purchases, remote mission definitions, scheduled tournament
settlement, shared progressive jackpot pools, and full feature breadth remain
planned work.

Math version 2 is implemented for all eight themes: distinct reel definitions,
20-line total-bet settlement, all-wild and both-ways evaluation, gravity cascades,
free-spin/cascade multiplier ladders, a public server paytable, and deterministic
sampled RTP/hit-frequency regression gates. Exact combinatorial proofs and formal
external math certification remain Phase 1 launch requirements.

Fast math validation now runs 100,000 deterministic spins per published theme
inside CI and asserts that measured variance ordering agrees with low, medium,
high, and very-high labels. The CLI supports 10-million-spin release runs; those
long reports are not yet a substitute for exact theoretical enumeration.

## Phase 3 — LiveOps and social (started)

Segmentation, offers, events, tournaments, leaderboards, friends, clans, inbox and
push. Build an RBAC admin application with four-eyes approvals for economy grants,
config publishing, targeting previews, audit export and live health dashboards.

Implemented vertical slice: authenticated social overview, durable friend
requests/friendships and persistent clan creation/discovery/membership with
PostgreSQL constraints and a functional Flutter surface. LiveOps campaigns now
support UTC scheduling, level/VIP targeting, separate workforce JWTs, editor /
publisher / auditor RBAC, mandatory second-actor publication, an append-only
PostgreSQL audit trail and a server-driven Flutter lobby banner. Clan roles
beyond owner and member, chat, invitations, moderation, inbox, push, targeting
previews, enterprise SSO and the broader player/economy/health admin modules
remain planned. A responsive LiveOps console for campaign drafts, publication
and audit review is implemented at `/admin/`.

Push messaging now includes explicit per-category preferences, quiet hours,
encrypted APNs/FCM/Web Push token registration, idempotent audience fan-out from
published campaigns, an audited publisher action, durable multi-worker leasing,
bounded retries, invalid-token retirement and delivery metrics. Native provider
permission/token bootstraps, production gateway provisioning, deep-link routing,
receipt reconciliation and push capacity tests remain launch work.

## Phase 4 — scale and launch readiness

Multi-region read strategy, capacity tests, disaster recovery exercises, abuse
controls, privacy/age-gating, accessibility/localization, app-store compliance,
SLOs/on-call runbooks, experiment governance and staged rollouts.

Every phase requires unit, integration, contract, migration, math, performance,
security and rollback evidence in CI. Features are not complete without dashboards,
alerts, runbooks, ownership, data classification and deletion behavior.
