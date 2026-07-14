# Phase 4 work package: standard bonus wheel

Completed: 14 July 2026

## Implemented

- Persisted 30-day standard-wheel entitlement after four hourly claims.
- Versioned weighted segments for coin and gem rewards.
- Cryptographic server selection and deterministic selector tests.
- Atomic entitlement consumption, result persistence, wallet credit and ledger.
- Idempotent network replay without duplicate payout.

## Database and API

Migration `007_bonus_wheels.sql` adds `wheel_entitlements` and `wheel_spins`.
Endpoints: `GET /v1/rewards/wheels/standard` and
`POST /v1/rewards/wheels/standard/spin`.

## Verification and risk

API/Identity/Reward/PostgreSQL: 24 tests passed. A future Golden Wheel needs its
own entitlement sources, versioned weights and economy approval; it must not
reuse the Standard Wheel table implicitly.
