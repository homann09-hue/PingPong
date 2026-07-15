# Phase 7 work package: observability and analytics foundation

## Delivered scope

The API now exposes separate liveness and readiness signals. `GET /health`
confirms that the process is running; `GET /health/ready` verifies PostgreSQL in
production and returns `503` while that dependency is unavailable. The readiness
probe uses its own small connection pool and strict two-second timeouts so a
blocked application pool cannot make the probe wait indefinitely.

`GET /internal/metrics` publishes a dependency-free Prometheus text endpoint.
It is hidden with `404` unless the configured bearer token matches. The fixed,
low-cardinality metric set covers HTTP counts and duration, returned/rejected
spin requests, accepted/duplicate client events, process memory and uptime.
Player, session and request identifiers are deliberately excluded from labels.

The authenticated `POST /v1/analytics/events` endpoint accepts at most 50 events
per batch and an allow-listed schema only. The current taxonomy is:

- `screen.viewed`
- `offer.impression`
- `slot.presentation_completed`
- `ui.error`

Unknown properties are rejected. Events contain no free-form payload, email,
display name, device advertising identifier or wallet value. Client event UUIDs
make retries idempotent. The Flutter client submits screen views and completed
slot presentations on a best-effort basis; analytics failure can never block a
spin or navigation.

## Storage and retention

Migration `infra/postgres/016_observability_analytics.sql` creates the constrained
analytics table and indexes. Database checks enforce the event taxonomy,
platform values and a narrow timestamp window. The
`purge_client_analytics_events(interval)` function supplies bounded retention;
production operations must schedule it, normally with a 30-day interval.

## Security and privacy boundary

- Metrics require `METRICS_TOKEN`; production startup rejects a token shorter
  than 32 bytes.
- Metrics authentication uses constant-time comparison and unauthorized calls
  reveal no endpoint configuration.
- Analytics require the normal authenticated player session and have an
  in-process batch limiter.
- The event table is pseudonymous, not anonymous, because it references the
  player account. The current account-delete operation disables the account but
  does not yet erase analytics rows; the production erasure/anonymization job is
  therefore an explicit launch blocker.
- Collection must be connected to the product's approved consent or other legal
  basis before production launch. That policy UI and regional decision engine
  are intentionally not claimed by this package.

## Verification

Unit and HTTP contract tests cover readiness, hidden/authenticated metrics,
strict analytics validation and duplicate ingestion. A PostgreSQL integration
test applies the migration and verifies idempotent persistence. The complete API
PostgreSQL suite, Flutter analyzer, widget suite, TypeScript build and Flutter
release-web build are release gates for this slice.

## Remaining production work

Prometheus scraping, dashboards and alerts still require deployment-specific
configuration. Distributed rate limiting, OpenTelemetry traces, structured log
shipping, a crash-reporting provider, consent enforcement, automated retention
scheduling, deletion/anonymization automation and incident runbooks remain
launch-readiness work.
