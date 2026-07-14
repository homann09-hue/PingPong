# Phase 1 work package: auditable wallet ledger

Completed: 14 July 2026

## Implemented functions

- Immutable coin-ledger entries for wagers, wins and reward claims.
- Explicit balance-before and balance-after arithmetic invariants.
- Transaction-specific idempotency keys and structured source metadata.
- Replay-safe settlement without duplicate wallet transactions.
- Authenticated wallet balance and bounded transaction-history endpoints.
- Correlation response header (`x-request-id`) on API requests.
- Backward migration that reconstructs existing ledger balance transitions.

## Changed files

- `infra/postgres/001_core.sql`
- `infra/postgres/004_wallet_ledger_audit.sql`
- `apps/api/src/app.ts`
- `apps/api/src/app.test.ts`
- `apps/api/src/spins/spin-store.ts`
- `apps/api/src/spins/in-memory-spin-store.ts`
- `apps/api/src/spins/postgres-spin-store.ts`
- `apps/api/src/spins/postgres-spin-store.integration.test.ts`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/PHASE_1_STATUS.md`
- `docs/adr/0006-immutable-wallet-ledger.md`

## Database changes

No parallel wallet table was introduced. `wallet_ledger` gained `source`,
`idempotency_key`, `balance_before`, `balance_after`, `metadata` and
`admin_reason`, plus transition, idempotency and reference indexes.

## Executed tests

- API typecheck: passed.
- API unit/contract tests: 13 passed.
- PostgreSQL integration test: passed against PostgreSQL 17.
- Combined API result with database enabled: 14 passed.
- Production Node build: passed.

## Known risks

- Only coin transactions are used by current gameplay; the schema already
  permits gems, but gem grant/spend use cases are not exposed yet.
- Admin corrections require the future four-eyes approval workflow before an
  endpoint may be added.
- Transaction history is limit-bounded but needs cursor pagination before
  accounts accumulate production-scale histories.

## Next work package

Implement the Phase 1 identity foundation: guest-account creation, short-lived
access tokens, refresh-session rotation, device/session persistence and account
revocation tests. Demo authentication must remain isolated from production.
