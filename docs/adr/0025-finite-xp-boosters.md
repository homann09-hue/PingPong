# ADR 0025: Finite server-counted XP boosters

## Status

Accepted

## Context

Stamps and Boosters existed as wallet currencies but had no complete earn,
craft, activation, or gameplay loop. Client-timed boosters would be vulnerable
to clock manipulation and could consume charges on failed or replayed spins.

## Decision

Rule version 1 exchanges three Stamps for one Booster. Activating one Booster
adds twenty boosted spins to the player's durable boost state. Every boosted
spin awards twice the normal XP and decrements the counter only inside a
successful server settlement.

Craft and activation requests require UUID idempotency keys. Their results are
stored in `booster_actions`; reusing a key for another action is a conflict.
Wallet changes, action records, boost state, and ledger entries are committed
atomically. The in-memory adapter implements the same semantics.

## Consequences

- Boosters affect progression only; slot RNG, RTP, wins, and wagers are
  unchanged.
- Failed spins and idempotent replays never consume a boosted-spin charge.
- Multiple activations stack remaining spins rather than replacing value, up
  to a hard cap of 200 active spins.
- Flutter displays server-published costs, multipliers, inventory, and charges.
- Rule changes require a new version and migration/analytics review.
