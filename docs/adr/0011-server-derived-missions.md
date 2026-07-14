# ADR 0011: Server-derived versioned missions

Status: Accepted

## Decision

Mission progress is derived only from authoritative settled-spin data inside
the spin transaction. Definitions are versioned data with metric, target,
cadence and reward. Progress is partitioned by UTC period. Claims lock progress,
verify completion and unclaimed state, then credit wallet and ledger atomically.
No endpoint accepts client-authored progress.
