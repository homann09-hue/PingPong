# Phase 14: Workforce operations health

## Scope

The admin console exposes a read-only operational snapshot to the dedicated
`operations_viewer` role. Player identities, provider tokens, request paths with
identifiers and raw error messages are deliberately excluded.

The snapshot combines three evidence sources:

- the database readiness probe;
- process-local low-cardinality HTTP, spin, analytics, push and runtime metrics;
- one bounded PostgreSQL aggregate query over player, spin, analytics, economy,
  moderation, push and workforce-audit tables.

## Health policy

Readiness failure is `critical`. Stale push leases, at least 100 failed push
deliveries in 24 hours, at least 100 pending economy approvals or at least 500
open moderation cases produce `warning`. Otherwise the snapshot is `healthy`.
These are operational defaults and must become environment-governed SLO policy
before a multi-region launch.

## Interfaces

- `GET /admin/v1/operations/health`
- Operations tab at `/admin/`
- demo-only identity `local-admin-operations`

The endpoint remains separate from the bearer-protected Prometheus scrape
surface. The console receives a curated aggregate snapshot, not raw metrics.

Apply `infra/postgres/024_operations_health_indexes.sql` after the feature
migrations. It adds the leading status/time indexes required to keep the global
snapshot bounded as spin, push and audit history grows.

## Verification

Contract tests cover RBAC, aggregation, warning classification and the absence
of player identifiers. Adapter tests cover live demo queue counts. The optional
PostgreSQL integration test validates every aggregate against the migrated
schema when `TEST_DATABASE_URL` is available.
