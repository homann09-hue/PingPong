# ADR 0034: Transactional achievement persistence

## Status

Accepted.

## Context

The API already had a useful in-process achievement catalogue and prerequisite evaluator. Achievement views were derived from the latest player profile, while claims were routed through the generic reward claim path after an out-of-transaction eligibility check.

That design was adequate for a prototype but not for a live-service economy:

- catalogue history was not durable or versioned in PostgreSQL;
- completion evidence could not be audited or replayed;
- progress was not projected by server-owned events;
- the eligibility check and wallet credit were separated by a race window;
- generic reward claims did not bind the reward to the exact achievement version;
- retries had no achievement-specific request fingerprint;
- existing players had no controlled backfill mechanism.

The supplied Achievement Engine v1 prototype is not adopted because it would replace existing functionality with a second, weaker architecture.

## Decision

Extend the existing achievement catalogue and evaluator with a dedicated `AchievementStore` port.

### Definition history

Achievement definitions are stored as immutable `(achievement_id, version)` rows. Exactly one active version may exist for an achievement ID. Prerequisites reference an exact definition version.

The current TypeScript catalogue and the initial PostgreSQL catalogue are both version 1 and must remain semantically aligned.

### Progress projection

Server-owned progression snapshots are projected into `player_achievement_progress`.

- successful spin inserts project progress through a PostgreSQL trigger;
- profile reads and claims perform an idempotent read-through backfill;
- operations can backfill all players in bounded, cursor-based batches;
- current `players.level`, `players.xp`, and `players.vip_points` override stale spin snapshots;
- cumulative spin metrics come from the latest persisted spin progression evidence;
- progress is monotonic and cannot decrease.

### Completion evidence

The first snapshot that reaches a target becomes the completion evidence. Its payload records source type, source ID, occurrence time, metric, progress, and the complete progression snapshot.

Once completion evidence exists, database triggers reject attempts to change its payload or completion timestamp.

### Claims

Achievement claims use a dedicated transaction and a per-player lock.

The transaction:

1. resolves idempotent replay or conflict;
2. refreshes the player's achievement projection;
3. resolves the active definition version;
4. locks and validates the matching progress row;
5. verifies the exact prerequisite claim;
6. locks the coin wallet;
7. validates safe-integer settlement boundaries;
8. updates the wallet;
9. appends the wallet ledger entry;
10. persists the versioned claim and completion evidence;
11. emits `achievement.claimed` through the outbox;
12. commits all effects together.

A failure rolls back every effect. Achievement claim rows are append-only.

### Idempotency

Clients must supply an idempotency key for achievement claims. The key is unique per player and is bound to a SHA-256 fingerprint of the semantic request.

- an identical retry returns the stored result with `replayed: true`;
- reuse for another achievement fails with an idempotency conflict;
- a new key for an already claimed achievement fails as already claimed;
- concurrent identical claims settle once.

### Claim identity across versions

A player can claim an achievement ID only once across all definition versions. A later definition version may refine audit metadata or future progression behavior, but it does not silently create a second economic entitlement for the same achievement identity.

A deliberately new entitlement requires a new achievement ID.

### Runtime composition

Production uses `PostgresAchievementStore`. Demo mode uses `InMemoryAchievementStore`, which preserves the same API contract and serializes claims per player while reusing the demo spin wallet.

The generic reward claim path remains available for daily and legacy rewards. Achievement IDs are routed through the dedicated achievement store whenever it is configured.

## Consequences

- achievement rewards are now auditable and exactly-once;
- prerequisites and completion are checked inside the settlement transaction;
- existing players can be migrated without an unbounded startup job;
- non-spin VIP or level updates become visible through authoritative backfill;
- achievement API claims now require an idempotency key;
- schema migrations 038 through 040 are required before enabling the production store;
- future catalogue changes must update both definition history and catalogue tests deliberately.
