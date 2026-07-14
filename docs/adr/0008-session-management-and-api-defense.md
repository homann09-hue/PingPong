# ADR 0008: Server-side session management and layered API defense

Status: Accepted

## Decision

Players can list and revoke their active sessions, revoke every session, and
delete their account. Account deletion marks the player deleted, revokes all
sessions, removes login identities and replaces installation identifiers while
retaining financial/game audit records under the internal player UUID.

The API adds restrictive content, referrer and permissions headers. Auth routes
also use a bounded process-local fixed-window limiter. This limiter is defense
in depth for a single process; production ingress or Redis must enforce the
authoritative distributed limit across replicas.

## Consequences

- Lost devices can be disconnected without changing wallet or spin history.
- Deleted accounts cannot authenticate with previously issued access tokens.
- Refresh endpoints are non-cacheable.
- Horizontal deployments must not rely solely on process-local counters.
