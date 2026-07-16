# ADR 0023: Central multi-currency economy

## Status

Accepted

## Context

Coins and Gems were persisted separately, VIP points lived on the player row,
and the wallet endpoint returned Coins only. Loyalty, high-roller, clan,
league, mission, collectible, and booster balances had no authoritative model.

## Decision

The API owns one stable thirteen-currency catalog. The profile and wallet
responses compose persisted wallets with VIP progression into one ordered
snapshot. PostgreSQL and the deterministic in-memory adapter apply the same
spin policy exactly once inside idempotent settlement.

Every settled spin awards wager-scaled LP, Clan, League, and Mission points.
High-Roller points require a wager of at least 5,000 Coins. Winning spins award
a Check-&-Win mark. Lotsa Cash, Stamps, Boosters, and Oinky Coupons are modeled
with zero defaults but are not fabricated by ordinary spins; later LiveOps and
reward flows must credit them through explicit ledger entries.

## Consequences

- Coins remain the only slot wager and payout currency.
- Higher wagers create more progression points without changing slot math.
- Spin replay cannot duplicate currency grants.
- Every non-zero persisted delta has before/after balances and a wallet-ledger
  idempotency key.
- New currencies require a catalog, database-constraint, API, and analytics
  version review rather than an ad-hoc UI counter.
- Insufficient Coin balance never starts a spin; Flutter routes the player to
  the bonus center or play-money shop instead.
- The lobby wallet center reads balances and audit history from `/v1/wallet`
  and `/v1/wallet/transactions`; it never derives authoritative balances from
  locally cached spin animations.
