# Phase 4 work package: durable daily and weekly missions

Completed: 14 July 2026

Implemented four daily metric families: spins, wager, wins and free spins.
Migration `008_missions.sql` adds versioned definitions and period progress.
APIs are `GET /v1/missions` and `POST /v1/missions/{missionId}/claim`.

The Flutter Quest surface consumes these APIs directly. It separates daily and
weekly objectives, displays tier-specific presentation, authoritative progress,
claim eligibility, and ledger-backed reward results. A bundled OFL font and
local CanvasKit build keep the web client independent of runtime CDNs.

Migration `009_mission_tiers.sql` adds localized definition keys, the
`standard`, `pro`, `super`, and `crazy` tiers, and three weekly objectives.
Daily periods use the UTC calendar day; weekly periods start Monday at 00:00
UTC. Settlement advances every active cadence atomically with the spin.

PostgreSQL integration verifies that settled spins advance progress, replay does
not, completed missions pay through the immutable ledger, and a second claim is
rejected. API/Identity/Reward/PostgreSQL suite: 25 passed.

Next: an outbox-driven progress consumer for non-spin metrics such as reward
claims, clans and events.
