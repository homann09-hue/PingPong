# ADR 0014: Configured symbol upgrades

## Status

Accepted

## Context

Symbol upgrades must affect authoritative win evaluation and remain replayable.
A client-only replacement would display outcomes that do not match settlement,
while hard-coded theme logic would prevent the engine from serving new games.

## Decision

Slot configurations may define one trigger symbol, a minimum visible trigger
count, and an ordered list of distinct regular-symbol mappings. When the
threshold is met, the engine applies all mappings simultaneously before mystery
reveal, wild expansion, and win evaluation. Each mapping that changed at least
one cell emits a `symbol.upgraded` event with source, target, changed-cell count,
and visible trigger count.

Mappings are deterministic and consume no random numbers. Configuration
validation requires a configured trigger, a threshold that fits the grid,
unique source symbols, distinct source and target symbols, and regular-symbol
endpoints. Published configurations are versioned because upgrades alter slot
mathematics.

Jungle Temple v3 activates the feature on three bonus symbols and promotes
J→Q, Q→K, and K→A. The API returns the engine events unchanged; Flutter derives
its presentation label from those authoritative transitions.

## Consequences

- Replays produce identical upgraded grids, wins, and events.
- Upgrade behavior is reusable without theme-specific engine branches.
- Cascades and free spins use the same evaluation order.
- Every published upgrade configuration requires new RTP, hit-frequency, and
  volatility evidence before release.
