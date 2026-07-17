# ADR 0029: Server-owned High Roller membership boundary

## Status

Accepted

## Context

High-Roller Points existed as a wallet currency but had no membership state,
entry rule, expiry, benefit enforcement, or player surface. A client-derived
flag would permit early entry and forged benefits, while deriving permanent
access from a cumulative balance would make the weekly qualification meaningless.

## Decision

The server owns a versioned Club policy. Activation spends 20,000 High-Roller
Points, grants one Diamond Stamp, and creates exactly seven days of access from
server time. A unique player/idempotency-key activation record stores the
settled response, while current expiry is kept separately for efficient reads.

Spin settlement remains the first authoritative point producer: wager-scaled
points begin at a 1,000-Coin bet and Level Up Plus grants 1,000 additional
points per level crossed. While membership is active, the same settlement
transaction applies 2% Endless Cashback to losing spins and doubles League
Points. Daily Bonus, Lobby Express, standard Wheel, Booster activation, and
virtual-shop purchases credit fixed, versioned awards inside the transaction of
their source action. Space Battle, Oinky, and Golden Pass remain explicitly
unavailable until their authoritative producers exist.

## Consequences

- Membership cannot be extended, duplicated, or activated below threshold by
  request replay.
- Point spending, Diamond Stamp grants, and cashback have immutable ledger legs.
- Every live fixed source has its own replay-safe `high_roller_source` ledger
  leg; the client displays its award and marks unavailable producers as upcoming.
- Membership expiry does not require a cleanup job; server-time reads determine
  whether benefits are active.
- Exclusive slot ids are classified by the API domain and advertised in lobby
  and paytable metadata. The spin endpoint remains authoritative and rejects
  inactive players even when a modified client bypasses its lobby lock.
- `neon-nights` is the first club-exclusive game. Additional producers must call
  the same server-owned economy boundary.
