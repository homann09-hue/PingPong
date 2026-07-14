# ADR 0007: Short-lived access tokens and rotating refresh sessions

Status: Accepted

## Context

Stateless long-lived JWTs cannot be revoked after logout, device loss or token
theft. Guest accounts also require a stable server identity without trusting a
client-supplied player ID.

## Decision

- Access tokens are HS256 JWTs with issuer, audience, player subject, session
  ID and a 15-minute lifetime.
- Authentication requires both a valid signature and an active server session.
- Refresh tokens are opaque 256-bit random values with a 30-day lifetime.
- Only SHA-256 refresh-token hashes are persisted.
- Every refresh atomically revokes the old session and creates a successor.
- Reuse of a revoked refresh token revokes all active sessions for that player.
- Guest identity is stable per installation UUID and is created together with
  its device, coin/gem wallets and first session in one PostgreSQL transaction.
- Demo authentication remains an explicit local adapter and is never selected
  outside `DEMO_MODE=true`.

## Consequences

Logout and refresh rotation invalidate access immediately because each API
request checks session state. Production will later replace the shared HS256
secret with managed asymmetric keys without changing the session contract.
