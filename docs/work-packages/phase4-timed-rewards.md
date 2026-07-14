# Phase 4 work package: timed rewards

Completed: 14 July 2026

## Implemented

- Server-timed hourly and daily status/claim APIs.
- One-hour cooldown, seven-day daily cycle and consecutive-day streak.
- Level-scaled hourly coins and four-claim bonus-wheel progress.
- Atomic PostgreSQL state, wallet, claim and immutable-ledger transaction.
- Deterministic domain functions with injectable time for tests.

## Database

Migration `006_timed_rewards.sql` adds `timed_reward_states` with bounded cycle,
streak, wheel progress and optimistic version fields.

## Verification

- API/Identity/PostgreSQL tests: 22 passed.
- Slot engine/math regression: 22 passed.
- Typecheck and production Node build passed.

## Risks and next step

The wheel unlock is currently an entitlement signal, not yet a separately
claimable weighted reward. Next implement the server-authoritative wheel state
and reward table, followed by durable mission definitions/progress.
