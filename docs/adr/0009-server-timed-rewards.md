# ADR 0009: Server-timed durable rewards

Status: Accepted

## Decision

Daily and hourly availability is calculated exclusively from server UTC time
and persisted state. Claims lock the state and coin wallet, update streak/cycle
progress, write an immutable ledger credit and store the claim in one database
transaction. Hourly rewards scale with authoritative level; every fourth claim
unlocks a wheel entitlement signal and resets progress. Daily rewards use a
seven-day cycle and reset the streak after a missed UTC day.

Clients render `availableAt` and progress but never decide eligibility or value.
