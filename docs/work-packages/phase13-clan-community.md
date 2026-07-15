# Phase 13 — Clan community

## Scope

This slice turns clans from a membership list into an authenticated community
boundary. Owner and officer roles can invite players. Recipients see durable,
seven-day invitations and accept them transactionally subject to the one-clan
and member-capacity invariants.

Clan members share a cursor-paginated feed. Messages are limited to 280 visible
characters, reject control characters, and are throttled to five posts per
player per minute. Authors may remove their own posts; owners and officers may
moderate every post in their clan. Removed posts remain as tombstones so page
ordering and moderation outcomes cannot silently disappear from the client.

## API

- `POST /v1/clans/invitations`
- `POST /v1/clans/invitations/{invitationId}/accept`
- `GET /v1/clans/feed?limit=30&cursor=...`
- `POST /v1/clans/feed`
- `DELETE /v1/clans/feed/{messageId}`

All routes derive the actor from the authenticated session. Clan IDs, roles and
authors are never accepted from request bodies. Feed cursors are opaque,
validated base64url values containing a stable `(createdAt, id)` keyset.

## Persistence and operations

Apply `infra/postgres/020_clan_community.sql` after migration 014. Invitation
acceptance locks the invitation, recipient membership and clan capacity in one
transaction. Message posting locks the member row, making the store-level rate
limit deterministic for concurrent requests from the same player.

Provider-independent API tests cover invitation conflicts, recipient inboxes,
acceptance, keyset pagination, author/role moderation, invalid content, invalid
cursors and throttling. The PostgreSQL integration suite additionally covers
durability and transactional role enforcement when `TEST_DATABASE_URL` is set.

## Remaining launch work

Production moderation still needs automated trust-and-safety classification,
player reporting, staff review queues, sanctions, legal retention policy,
regional consent review and abuse dashboards. Large deployments should move
the posting throttle to a shared limiter while retaining the database invariant
as defense in depth.
