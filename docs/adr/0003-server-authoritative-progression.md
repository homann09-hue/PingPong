# ADR 0003: Server-authoritative progression and reward claims

## Status

Accepted.

## Context

XP, levels, missions, event scores, and reward grants affect retention and the
play-money economy. Calculating or granting them only in Flutter would allow a
modified client to fabricate progress or increase its wallet.

## Decision

Spin settlement calculates progression inside the same store transaction as the
wager and win. The API returns an immutable `progression` snapshot containing
level, current-level XP, spin count, total won, and awarded free spins.

Reward definitions are allow-listed on the server. Claims use a stable reward
identifier and a database uniqueness constraint on `(player_id, reward_id)`.
Daily rewards are namespaced with the server's UTC date. Wallet credit and its
immutable ledger record are written in one transaction.

The Flutter client only displays returned progress and balances. It may decide
when a claim button becomes visually available, but the server remains the final
authority and safely rejects duplicate claims.

## Consequences

- Duplicate and modified-client claims cannot mint additional coins.
- An idempotent spin replay returns the original post-spin progression snapshot.
- Existing databases must apply `infra/postgres/002_spin_progression.sql`.
- Mission eligibility is currently represented by fixed server-side reward IDs;
  a later LiveOps mission service will validate dynamic mission definitions and
  segments without changing the wallet boundary.
