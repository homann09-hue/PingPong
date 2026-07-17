# ADR 0026: Server-authoritative Loyalty Rewards exchange

## Status

Accepted

## Context

Settled spins already awarded wager-scaled Loyalty Points, but players could not
use them. A displayed balance without an earn-and-spend loop adds economy
complexity without creating meaningful progression. Client-calculated prices or
rewards would allow modified clients and request retries to mint virtual value.

## Decision

The API owns a versioned catalog of fixed LP costs and virtual Coin or Gem
rewards. `GET /v1/economy/loyalty-rewards` returns the authoritative LP balance,
catalog terms, and derived affordability. A redemption requires an authenticated
player and UUID idempotency key.

PostgreSQL locks the LP and destination wallets in a stable currency order. It
then validates the LP balance, debits LP, credits the reward, stores the exact
catalog version and booked terms, and appends both immutable wallet-ledger legs
in one transaction. `(player_id, idempotency_key)` is unique. Reusing a key for
the same offer returns the original result; reusing it for another offer is a
conflict.

The Flutter client only renders server terms and submits the selected offer ID.
It never calculates or applies wallet value locally beyond presenting the
confirmed response.

## Consequences

- Loyalty Points now have a complete earn-and-spend loop.
- Catalog changes require a new version; historical redemptions remain auditable.
- Redemptions cannot overdraw LP or duplicate rewards under retries.
- Coins and Gems remain virtual, non-withdrawable currencies.
