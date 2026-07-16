# ADR 0024: Server-authoritative Check-&-Win exchange

## Status

Accepted

## Context

Winning spins already award Check-&-Win marks, but marks had no use and Stamps
had no legitimate earn path. A client-side exchange would allow duplicated
rewards after retries and could diverge from the wallet ledger.

## Decision

Reward version 1 consumes five Check-&-Win marks and grants 100,000 virtual
Coins plus one Stamp. `GET /v1/economy/check-win` publishes progress and current
terms. `POST /v1/economy/check-win/claim` requires a UUID idempotency key.

PostgreSQL locks the player's Coin and mark wallets, verifies the threshold,
creates the Stamp wallet when needed, updates all three balances, persists the
versioned claim, and appends three immutable ledger entries in one transaction.
The in-memory adapter mirrors the same behavior for deterministic tests.

## Consequences

- A win mark is valuable only after a server-settled winning spin.
- Concurrent claims cannot overspend marks.
- Retrying a completed request returns the original balances without another
  grant.
- Reward terms can change only through a new version and must remain auditable.
- Flutter displays server-provided terms and never decides claim eligibility.
