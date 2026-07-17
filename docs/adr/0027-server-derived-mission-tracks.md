# ADR 0027: Server-derived mission tracks and reward bundles

## Status

Accepted

## Context

The first mission implementation exposed daily and weekly spin counters with a
Coin-only claim. It did not model the documented relationship between Daily,
Pro, Super, Crazy, and weekly progress, and the client could not explain why a
tier was locked. Mission Points, Stamps, Loyalty Points, Toolboxes, and Boosters
were not part of the mission reward transaction.

## Decision

Mission content is a versioned server catalog mirrored into PostgreSQL. Daily
windows reset at 00:00 UTC, Pro/Crazy windows use deterministic three-day epoch
buckets, and weekly windows begin Monday at 00:00 UTC.

The server derives unlock state from claimed progress in the current windows:
three standard Daily claims unlock Super; Crazy additionally requires both Pro
claims. Locked missions do not accrue progress. Claiming a standard Daily
mission advances every weekly Daily-claim milestone in the same database
transaction.

A claim locks its progress and all six affected wallets in stable currency
order. It marks the mission claimed, credits the configured Coin, Mission Point,
Loyalty Point, Stamp, Toolbox, and Booster bundle, and writes one immutable
ledger leg for every non-zero reward. The existing mission-period uniqueness
prevents duplicate claims.

## Consequences

- Reset and unlock decisions are reproducible and independent of client clocks.
- Weekly intermediate and final rewards are driven by completed Daily work.
- Reward bundles cannot be partially booked or duplicated.
- The Flutter client renders server progress, lock requirements, windows, and
  reward terms without deriving authoritative state.
