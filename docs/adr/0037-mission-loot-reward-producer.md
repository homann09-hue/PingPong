# ADR 0037: Mission claims as trusted Loot entitlement producers

- Status: Accepted
- Date: 2026-07-24
- Depends on: ADR 0035 and ADR 0036

## Context

Mission progress was previously represented by a mutable current definition and a `claimed_at` timestamp on `mission_progress`. Claiming updated six wallet currencies and the weekly mission bar, but there was no durable claim row, request fingerprint, semantic replay record, immutable reward snapshot, outbox event, or one-time Loot entitlement.

That model was sufficient for a local reward prototype but not for an externally reachable production claim. A network retry could not be distinguished from a second claim attempt, the active mission definition could change after progress was earned, and the database could not prove that a claimed mission had received the exact reward promised by its version.

## Decision

### Immutable mission versions

`mission_definition_versions` stores the complete settlement contract for each mission version:

- cadence and tier;
- translation and metric identity;
- target and unlock requirements;
- all six direct wallet rewards;
- exact Loot table ID and version;
- entitlement lifetime;
- publication and event window metadata.

Rows are append-only. `mission_definitions` remains the active catalogue pointer, but PostgreSQL requires that every pointer exactly matches an immutable published version.

`mission_progress` pins `mission_version` when progress is first created. Later catalogue publication cannot change the target or reward semantics of an in-flight period.

### Durable, idempotent claims

Every production claim requires a client retry key. `mission_claims_v1` stores:

- claim ID;
- player, mission, mission version, and period;
- retry key and SHA-256 semantic fingerprint;
- progress at claim;
- reward and balance snapshots;
- linked Loot entitlement;
- complete response and claim timestamp.

The semantic identity is player + mission + period. Identical retries replay the persisted response. A different retry key for the same semantic claim also replays the same claim. Reusing one retry key for another mission or period is rejected.

Claims are append-only. `mission_progress.claimed_at` is terminal and must have matching durable claim evidence before transaction commit.

### Atomic reward settlement

The PostgreSQL mission claim transaction:

1. locks the player;
2. locks the pinned mission progress row;
3. checks retry and semantic replay;
4. validates server-counted unlock and completion evidence;
5. locks all affected wallet rows;
6. validates every resulting balance as a non-negative safe integer;
7. issues the exact versioned Loot entitlement inside the same transaction;
8. inserts the durable claim response;
9. marks progress claimed;
10. updates wallets and immutable ledger rows;
11. advances the weekly bar using its pinned definition version;
12. writes `mission.claimed` and `loot.entitlement.issued` outbox events;
13. commits everything together.

Any failure rolls back the claim, wallet changes, ledger rows, weekly progress, entitlement, and outbox evidence.

### Loot contracts

Published version-3 mission definitions use these exact table contracts:

- Standard: `mission-standard-reward` version 1;
- Pro: `mission-pro-reward` version 1;
- Super: `mission-super-reward` version 1;
- Crazy: `mission-crazy-reward` version 1.

Entitlements expire seven days after the successful claim timestamp. Their authoritative source is `mission`, and their reference is `<mission-id>:v<mission-version>:<period-key>`.

The claim request never accepts a table ID, table version, expiry, source, reference, item, quantity, weight, or metadata field from the client.

### Database enforcement

PostgreSQL rejects:

- edits or deletion of versioned definitions;
- active catalogue pointers that do not match a published snapshot;
- changes to a progress row's pinned mission version;
- reversal or mutation of `claimed_at`;
- claims without matching completed progress;
- claims without their promised entitlement;
- entitlements with the wrong player, table, version, source, reference, lifetime, status, claim ID, mission ID, version, or period;
- mutation or deletion of claim rows;
- a `claimed_at` timestamp without durable claim evidence.

### Adapters and clients

The in-memory adapter implements the same retry and semantic replay behavior but returns `lootEntitlement: null`, because it has no PostgreSQL Loot persistence.

The HTTP endpoint requires an `idempotency-key`, applies a player-specific claim rate limit, and maps semantic key conflicts to HTTP 409. The Flutter client generates a retry key for every new claim operation.

No public entitlement issuance endpoint and no client-selected Loot opening contract are introduced by this decision.

## Consequences

Mission rewards can now be retried safely and audited from progress through claim, wallet ledger, entitlement, Loot opening, Inventory grant, and outbox delivery.

Publishing a changed target or reward requires a new mission version. Existing progress continues against its pinned version.

The migration preserves historical `claimed_at` values without fabricating claim rows. New or modified claims after the invariant migration must satisfy the durable evidence contract.
