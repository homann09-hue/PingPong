# ADR 0010: Durable server-authoritative wheel entitlements

Status: Accepted

## Decision

Bonus wheels consume persisted, expiring entitlements. Segment selection uses a
versioned server weight table and cryptographically sourced random unit value.
Entitlement consumption, immutable result, wallet credit and ledger entry share
one transaction. Player/idempotency uniqueness makes retries return the stored
result without selecting or crediting again. The client only animates the
already selected segment.
