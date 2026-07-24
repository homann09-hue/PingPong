# ADR 0033: Server-authoritative, versioned, and auditable loot openings

Status: Accepted

## Context

Loot openings change the play-money economy and may grant scarce inventory.
Client-side randomness, floating-point weighted selection, mutable drop tables,
or a pity counter held only in memory cannot prove what happened and cannot
safely survive retries, concurrency, deployments, or partial failures.

The early Loot & Drop Engine v1 prototype used `Math.random`, accepted unchecked
weights, contained only a pity placeholder, and credited no persistent inventory.
It is therefore a product reference only, not an implementation base.

## Decision

Loot outcomes are resolved exclusively by the server against a published,
immutable loot-table version. Clients provide the table identifier and an
idempotency key, but cannot choose the table version, random seed, pity state,
entry, quantity, stack identifier, or evidence.

Each opening uses a cryptographically generated 32-byte server seed. The pure
loot engine derives an audit stream with HMAC-SHA-256 and samples bounded
integers using 64-bit rejection sampling. It does not use `Math.random`, clocks,
network state, or floating-point cumulative probabilities. Stable entry ordering
and the persisted table version make the outcome reproducible from the stored
seed and configuration.

The opening stores:

- table identifier and version;
- pity group, counter before and after, and whether pity forced the pool;
- proof format version;
- the server seed in the restricted server database;
- a SHA-256 seed commitment returned to the caller;
- every accepted draw, its purpose, counter, bound, value, and rejected-block
  count;
- the replayable public result;
- one reward row per selected entry linked to the exact loot entry and the
  inventory operation that granted it.

Guaranteed entries are always granted. Exactly one weighted entry is selected.
If the configured pity threshold is reached, selection is restricted to
pity-eligible weighted entries. A pity-eligible result resets the counter;
otherwise it increments with checked arithmetic.

Opening evidence, pity-state mutation, all inventory stack and ledger changes,
reward references, and outbox events commit in one PostgreSQL transaction.
Inventory is credited only through the transactional inventory boundary from
ADR 0032. Any invalid table, inactive item, unsafe integer, failed inventory
grant, or persistence error rolls the complete opening back.

## Invariants

- only an active, published table version can open;
- weighted entries have positive safe-integer weights;
- guaranteed entries have zero weight and cannot reset weighted pity;
- quantity ranges are positive safe integers with `max >= min`;
- pity-enabled tables contain at least one pity-eligible weighted entry;
- total selection weight cannot exceed the JavaScript safe-integer range;
- the server seed is never included in API results or client events;
- a repeated matching idempotency request replays the stored opening without new
  RNG, pity changes, or inventory grants;
- reusing an idempotency key for another request fails;
- every persisted reward references its exact opening, table version, entry,
  item version, and inventory operation;
- failed openings leave no pity row, opening, reward, inventory operation,
  ledger entry, or outbox message.

## Consequences

The system gains deterministic dispute reproduction, durable pity behavior,
atomic rewards, and evidence suitable for internal audits. The database stores
sensitive server seeds and must restrict direct access, backups, logs, and
administrative exports accordingly. A future public reveal protocol may disclose
seeds after a defined delay, but clients must never receive unrevealed seeds or
use them to predict future openings.
