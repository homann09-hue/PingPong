# Prepared prototype engine review

This review records the disposition of the early engine packages supplied for the
core-systems integration branch. The prototypes are reference material only and
must not be copied into production unchanged.

## Inventory Engine v2

### Useful concepts

- explicit item categories and rarities
- per-item stack limits
- optional expiry and event ownership
- a starting point for an inventory item schema

### Blocking defects

- `add` fills at most one existing stack and silently discards overflow instead
  of splitting it into additional stacks
- `remove` searches only one row and cannot consume atomically across stacks
- mutations are in-memory and have no transaction, lock, version, or
  idempotency boundary
- quantities, stack sizes, dates, categories, and rarities are not validated
- the proposed composite primary key contains nullable columns, which does not
  provide a sound item-instance identity model
- there is no immutable inventory ledger or audit evidence
- `cleanupExpired` returns a filtered array but does not mutate or persist the
  inventory and is not a server-owned expiry process
- concurrent grants and consumes can overspend or lose items

### Production direction

Implement an item-definition catalogue plus uniquely identified inventory
stacks. Grants and consumes must run in PostgreSQL transactions with row locks or
optimistic versions, stable idempotency keys, non-negative constraints, an
immutable inventory ledger, deterministic stack ordering, and a server worker
for expiry. Currency-like assets must remain inside the existing wallet and
wallet-ledger boundary rather than being duplicated as inventory items.

## Loot & Drop Engine v1

### Useful concepts

- versionable weighted-table shape
- bounded quantity range per entry
- a location for future pity metadata

### Blocking defects

- defaults to `Math.random`, which is forbidden for server-authoritative rewards
- accepts client-supplied RNG functions without an authorization boundary
- `pityAfter` is unused
- guaranteed entries are unused
- zero, negative, fractional, non-finite, and overflowing weights are accepted
- invalid quantity ranges are accepted
- empty and malformed tables are not rejected
- there is no table version in the resulting proof
- no idempotency, replay protection, transaction, drop receipt, audit record, or
  atomic inventory credit exists
- the final `null` fallback can hide malformed totals instead of failing closed

### Production direction

Resolve an immutable loot-table version on the server, use an approved
cryptographic or existing deterministic server RNG boundary, validate all
weights and quantity ranges before publication, persist pity state under lock,
and settle the roll, receipt, pity update, and inventory/wallet grants in one
idempotent transaction. Store enough evidence to replay and audit every drop
without exposing secret seed material to clients.

## Achievement Engine v1

### Useful concepts

- metric-based definitions
- simple completion evaluation
- next-target lookup

### Current repository overlap

The repository already contains `apps/api/src/achievements/achievement-system.ts`
with a server catalogue, chained prerequisites, progression-derived views, and
claim eligibility. Replacing it with the prototype would remove current
functionality and create a parallel architecture.

### Blocking defects

- no persistence, catalogue version, event hook, or backfill strategy
- no atomic claim boundary or duplicate-claim protection
- no wallet/inventory ledger integration
- no validation of targets or rewards
- no immutable completion evidence
- rewards include types that are not connected to the existing economy model

### Production direction

Extend the existing achievement system rather than introducing a second one.
Persist definition versions and player achievement state, derive progress from
server-owned statistics/events, backfill existing players explicitly, and route
claims through the established idempotent reward and ledger boundaries.

## Player Core Module v1

### Useful concepts

- demonstrates the intended profile/wallet/stats/inventory grouping

### Blocking defects

- directly mutates coins without the existing wallet ledger
- combines progression, wallet, and inventory side effects in one mutable
  in-memory service
- has no safe-integer, non-negative, max-level, transaction, authorization, or
  idempotency checks
- duplicates the repository's existing server-authoritative player, wallet,
  progression, statistics, and reward architecture
- its XP curve and reward writes are not versioned or auditable

### Production direction

Do not integrate this module. Use the deterministic progression core introduced
on this branch for pure XP calculations, then connect it to the existing
transactional spin stores. Keep wallet changes inside wallet plus ledger
transactions and implement inventory as an independent audited subsystem.

## Integration decision

| Package | Decision |
| --- | --- |
| Inventory Engine v2 | reference only; redesign around transactional stacks and inventory ledger |
| Loot & Drop Engine v1 | reference only; redesign around server RNG, receipts, pity persistence, and atomic grants |
| Achievement Engine v1 | do not replace current system; extend existing achievement architecture |
| Player Core Module v1 | reject as production architecture; retain existing bounded services |

No schema or runtime code from these four prototypes is enabled by this review.
