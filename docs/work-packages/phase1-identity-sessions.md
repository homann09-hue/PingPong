# Phase 1 work package: identity and rotating sessions

Completed: 14 July 2026

## Implemented functions

- Idempotent guest identity per installation.
- Device persistence for iOS, Android and Web.
- Fifteen-minute signed access tokens bound to server sessions.
- Thirty-day opaque refresh tokens stored only as SHA-256 hashes.
- Atomic one-time refresh rotation and refresh-token replay detection.
- Immediate logout/session revocation.
- Production PostgreSQL adapter and isolated in-memory demo/test adapter.
- Versioned guest, refresh and logout API endpoints.

## Database changes

Migration `005_identity_sessions.sql` adds `auth_identities`, `devices` and
`sessions`, including uniqueness, expiry and active-session indexes.

## Executed tests

- API typecheck: passed.
- Identity/API tests without database: 16 passed, 2 integration tests skipped.
- Full API run against PostgreSQL 17: 18 passed, none skipped.
- Refresh rotation, old-access invalidation, replay-family revocation, logout,
  device persistence and guest-account reuse are covered.

## Known risks

- Apple, Google and email identity linking are represented in the schema but
  provider verification flows are not implemented yet.
- Production key rotation and KMS-backed asymmetric signing remain required.
- Session list, logout-all-devices and account recovery endpoints are the next
  identity increment.

## Next work package

Add session/device management and account lifecycle operations, then implement
API rate limiting and security headers before exposing identity publicly.
