# ADR 0036: Achievement claims as a trusted loot entitlement producer

## Status

Accepted.

## Context

ADR 0035 requires every externally reachable loot opening to consume a server-issued entitlement. It intentionally does not permit clients to choose loot tables, versions, sources, references, metadata, or reward contents.

Achievements are the first reward system to produce these entitlements. Achievement claims already settle exactly once under a player transaction lock and atomically update the coin wallet, wallet ledger, claim evidence, and outbox. Issuing loot after that transaction would create two invalid partial states:

- a completed claim without its promised loot entitlement;
- an entitlement whose Achievement claim did not commit.

## Decision

Each published Achievement definition version may bind an optional loot reward consisting of:

- exact loot table ID;
- exact loot table version;
- entitlement lifetime in seconds.

All current Achievement definitions bind a version-1 reward table by tier:

- Bronze → `achievement-bronze-reward` version 1;
- Silver → `achievement-silver-reward` version 1;
- Gold → `achievement-gold-reward` version 1.

Current entitlements expire seven days after the successful claim transaction timestamp.

## Transaction boundary

`PostgresAchievementStore.claim` keeps the existing player row lock and performs the following work in one PostgreSQL transaction:

1. replay and semantic idempotency checks;
2. authoritative progress backfill;
3. active published definition lookup;
4. completion and prerequisite validation;
5. coin wallet overflow validation;
6. transaction-bound entitlement issuance for the exact configured table version;
7. coin wallet update;
8. wallet ledger insertion;
9. Achievement claim insertion with the entitlement foreign key;
10. `loot.entitlement.issued` outbox insertion;
11. `achievement.claimed` outbox insertion;
12. commit.

Any error rolls back every effect, including the entitlement.

## Trusted issuer contract

The shared transaction-bound issuer accepts an exact table ID and version. It does not resolve a client-selected table and does not open a second database transaction.

The caller must already hold the player row lock. This serializes Achievement issuance with normal entitlement issuance and other trusted reward producers.

Achievement entitlement identity is deterministic per player and definition version:

- source: `achievement`;
- source reference: `<achievement-id>:v<version>`;
- entitlement idempotency key: `achievement-entitlement:<achievement-id>:v<version>`.

Changing the HTTP retry key cannot create another entitlement.

## Claim response

Production `AchievementClaimResult` contains the persisted `LootEntitlementResult`. A replay returns the stored claim result and marks the outer claim as replayed; it does not issue or mutate the nested entitlement again.

The in-memory demo store returns `lootEntitlement: null` because it has no PostgreSQL Loot/Inventory persistence. This distinction is explicit rather than fabricating a non-openable entitlement.

## Reward content

Migration 043 publishes three versioned Achievement loot tables and four non-tradable Inventory items:

- Achievement Spin Ticket;
- Achievement XP Booster;
- Achievement Lucky Key;
- Achievement Legend Token.

Each table has guaranteed and weighted entries appropriate to its tier. Loot evaluation, cryptographic evidence, pity handling, Inventory grants, ledgers, and opening outbox events continue to use the existing server-authoritative Loot foundation.

## Database invariants

PostgreSQL enforces:

- all-or-none Achievement loot reward configuration;
- bounded entitlement TTL;
- foreign-key binding from Achievement definition to exact loot table version;
- unique claim-to-entitlement reference;
- immutable semantics for every published Achievement definition version, except the operational `active` flag;
- a configured Achievement claim must reference an available, unexpired entitlement for the same player;
- entitlement source, reference, table ID, table version, claim ID, Achievement ID, and Achievement version must match;
- an Achievement without a loot reward cannot reference an entitlement;
- Achievement claims remain append-only.

These checks apply even to direct SQL writes that bypass application code.

## Consequences

- A successful production Achievement claim always has its promised chest entitlement.
- A failed claim cannot leave a usable chest behind.
- Concurrent retries produce one claim, one coin ledger entry, and one entitlement.
- Reward balancing changes require a new Achievement definition version and/or a new loot table version.
- Deactivating a loot table does not rewrite already published Achievement reward semantics.
- No public entitlement issuance route is introduced.
- Public loot opening remains a separate authenticated API task and accepts only an entitlement UUID.
