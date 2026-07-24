# ADR 0032: Transactional inventory stacks and immutable ledger

Status: Accepted

## Context

Inventory is part of the play-money economy. A client-maintained item array or a
single mutable quantity cannot prove why an item was granted, consumed, or
expired. It also cannot safely handle retries, overlapping requests, stack
limits, event-specific items, or concurrent cleanup.

The early Inventory Engine v2 prototype demonstrated item categories and
rarities, but did not provide transactions, idempotency, atomic consume,
correct stack overflow, persistence, or an audit trail.

## Decision

Inventory is server-authoritative and stored in PostgreSQL through four related
structures:

- versioned `inventory_item_definitions` define category, rarity, stack limit,
  activation state, and immutable item-version semantics;
- `inventory_stacks` store positive bounded quantities, item version, stack
  index, optional event scope, and optional expiration;
- `inventory_operations` reserve one player-scoped idempotency key and persist a
  SHA-256 fingerprint plus the replayable result;
- append-only `inventory_ledger` rows describe every stack transition with
  quantity before, signed delta, quantity after, source, reason, reference, and
  metadata.

Grant and consume commands lock the player row, then execute stack changes,
ledger entries, operation finalization, and an outbox event in one transaction.
A retry with the same fingerprint returns the stored result. Reusing the key for
another request fails. Insufficient consume requests roll back without creating
an operation or partial ledger.

Grants first fill compatible partial stacks and then create as many bounded
stacks as necessary. Consume operations lock all eligible stacks and consume
items expiring soonest before permanent items. Expired items are removed only by
a server cleanup process using `FOR UPDATE SKIP LOCKED`; clients cannot claim
that cleanup occurred.

## Invariants

- stack quantity is always positive and never exceeds its recorded stack limit;
- inventory totals and ledger transitions use safe non-negative integers at the
  TypeScript boundary and checked `bigint` values in PostgreSQL;
- every ledger row satisfies `quantity_after = quantity_before + delta`;
- every successful operation has exactly one replayable result and one outbox
  event;
- failed or conflicting operations do not mutate stacks;
- item definitions are versioned rather than silently changing the meaning of
  existing inventory;
- loot RNG, pity state, achievement rewards, and wallet rewards remain separate
  bounded contexts that may call inventory grants but may not bypass them.

## Consequences

The system gains deterministic retry behavior, local reconciliation, and a
usable audit trail. Operations require more rows and explicit transaction
handling, but avoid duplicate rewards, partial consumes, negative inventory,
and untraceable administrative changes.

Public inventory endpoints may expose item definitions and active stacks, but
must never accept client-authored stack IDs, quantities after mutation, ledger
rows, random seeds, or reward evidence as authority.
