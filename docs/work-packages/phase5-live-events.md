# Phase 5: Server-authoritative live events

## Outcome

The lobby now exposes recurring daily and weekly events backed by authoritative
server progress. Event definitions, active UTC windows, milestone targets and
coin rewards are controlled by the API rather than the Flutter client.

## Architecture

- `events/live-events.ts` owns versioned event definitions and deterministic
  UTC period calculation.
- Spin settlement advances event metrics in the same server-side flow that
  persists wallet and player progression.
- `GET /v1/events` returns the active event window, current progress and the
  claim state of every milestone.
- `POST /v1/events/:eventId/milestones/:milestoneId/claim` validates the active
  period and target before crediting a reward.
- PostgreSQL stores progress per player, event version and period. A unique
  claim constraint makes milestone rewards idempotent.
- The in-memory demo store mirrors the production contract for local play and
  automated API tests.

## Security and economy integrity

- Clients cannot submit event progress or reward amounts.
- Claims are authenticated and validated against server-owned definitions.
- PostgreSQL claims lock the relevant progress row, insert the unique claim,
  update the wallet and append the wallet ledger entry in one transaction.
- Repeated or premature claims return HTTP 409 and cannot duplicate coins.

## Database rollout

Apply `infra/postgres/010_live_events.sql` before deploying the API version that
serves live events. The migration adds `live_event_progress` and
`live_event_claims` with lookup indexes and the uniqueness boundary used by the
claim transaction.

## Verification

- API TypeScript compilation succeeds.
- API suite: 23 tests pass, including progress and duplicate-claim coverage.
- Flutter analyzer reports no issues.
- Flutter widget suite: 6 tests pass, including milestone rendering and claim
  callback behavior.
- Flutter release web build succeeds.
- Local end-to-end verification confirms both `WORLD FORTUNE` and `SPIN SPRINT`
  are loaded from the API and rendered with live progress, expiry and milestone
  states.
