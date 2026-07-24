# ADR 0035: One-time loot entitlements

## Status

Accepted.

## Context

The server-authoritative Loot foundation resolves versioned tables, cryptographic seeds, pity state, inventory grants, evidence, and outbox events transactionally. That foundation must not be exposed through an API that lets a player choose a loot table, source, source reference, metadata, or table version.

A retry key alone is not authorization. A caller could otherwise repeatedly submit valid-looking opening requests against rewards it was never awarded.

## Decision

Every externally reachable loot opening must consume a server-issued entitlement.

An entitlement binds all authorization-relevant facts before the opening request exists:

- player UUID;
- exact loot table ID and version;
- authoritative source and source reference;
- server metadata;
- issue and expiry timestamps;
- lifecycle status;
- semantic SHA-256 request fingerprint.

The opening command contains only:

- player UUID from authenticated server context;
- idempotency key;
- entitlement UUID.

Table ID, table version, source, reference, metadata, pity state, seed, and rewards are never selected by the opening caller.

## Issuance

Only trusted server-side systems may call `PostgresLootStore.issue`.

Issuance:

1. locks the player row;
2. validates the active published loot table;
3. binds its exact current version;
4. deduplicates both the idempotency key and `(player, source, reference)`;
5. stores an immutable issuance receipt;
6. emits `loot.entitlement.issued` in the same transaction.

Changing a retry key cannot duplicate an authoritative source reward.

## Consumption

Opening:

1. locks the player row;
2. replays a previously stored opening when the retry fingerprint matches;
3. locks the player-owned entitlement;
4. rejects missing, expired, consumed, revoked, or wrong-player entitlements;
5. loads the exact version bound at issuance, even if publication later moves to another version;
6. evaluates server-authoritative loot and pity;
7. grants inventory through the existing transactional Inventory store;
8. stores the opening, reward references, cryptographic evidence, and updated pity state;
9. transitions the entitlement from `available` to `consumed` exactly once;
10. emits entitlement-consumed and loot-opened outbox events;
11. commits all effects together.

Any failure rolls back the opening, entitlement transition, pity state, inventory operations, ledgers, rewards, and outbox events.

## Lifecycle

Supported states are:

- `available`;
- `consumed`;
- `expired`;
- `revoked`.

Only an `available` entitlement can transition to a terminal state. Terminal states cannot return to `available` or change to another terminal state.

Expired entitlements are rejected at opening time regardless of whether the cleanup worker has projected the `expired` status. `expireDue` uses row locks with `SKIP LOCKED` so multiple cleanup workers cannot process the same row concurrently.

## Persistence invariants

PostgreSQL enforces:

- one entitlement per player and idempotency key;
- one entitlement per authoritative `(player, source, reference)`;
- one opening per entitlement;
- exact foreign-key binding to loot table version and opening;
- immutable player, source, reference, metadata, table version, request hash, issue time, expiry, and issuance result;
- append-only entitlement rows;
- consistent consumed timestamps and opening references;
- deferred foreign keys for the atomic entitlement/opening relationship.

Historical openings created before this migration may have a null entitlement reference. New application code never creates an unbound opening.

## Security consequences

- A client cannot mint loot by guessing a table ID.
- A client cannot select an older, richer, or unpublished table version.
- A client cannot forge reward provenance or metadata.
- A retry cannot produce a second opening or second Inventory grant.
- A different retry key cannot consume the same entitlement twice.
- Deactivating a table does not silently alter an already-issued reward; the issued version remains auditable.
- Raw server seeds remain database-only.

## Operational consequences

Entitlement issuance must be integrated separately into trusted reward producers such as achievements, missions, events, verified purchases, or support grants. No public issuance route is introduced by this change.

Public loot endpoints remain disabled until authentication, rate limiting, response shaping, and producer-specific issuance policies are implemented and tested.
