# ADR 0006: Immutable wallet ledger with explicit balance transitions

Status: Accepted

## Context

A wallet balance alone cannot prove why value changed. The original ledger
recorded amount, reason and reference, but did not carry the balance transition
or a transaction-specific idempotency key. This made reconciliation and fraud
investigation unnecessarily dependent on replaying unrelated data.

## Decision

Every wallet mutation is represented by an append-only `wallet_ledger` row in
the same PostgreSQL transaction as the balance update. Each row contains:

- currency and signed amount;
- reason and bounded-context source;
- immutable reference ID and transaction-specific idempotency key;
- balance before and after;
- structured metadata and optional admin reason;
- creation timestamp.

PostgreSQL enforces `balance_after = balance_before + amount`, non-negative
balances, and uniqueness of `(player_id, currency, idempotency_key)`. A spin
uses separate wager and win entries so debits and credits remain independently
auditable. Replaying the same spin returns its stored settlement and inserts no
additional ledger rows.

The public API exposes read-only wallet balances and a bounded transaction
history. It never accepts client-authored balances or ledger entries.

## Consequences

- Reconciliation can validate every balance transition locally.
- Duplicate credits and debits are rejected at the database boundary.
- Manual administration must later supply `admin_reason` and follow an approval
  workflow; it may not update `wallets.balance` directly.
- Existing ledgers are reconstructed backwards from the authoritative current
  balance by migration `004_wallet_ledger_audit.sql`.
