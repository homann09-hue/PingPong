# ADR 0015: Reel-strip stacked wilds

## Status

Accepted

## Context

Stacked wilds are a reel-model property: adjacent wild stops must exist in the
published strip. Generating extra adjacent wilds after a stop would change the
declared probability model and make certification and replay analysis harder.

## Decision

The reel-strip builder can preserve explicitly repeated configured symbols
instead of inserting its normal low-symbol separators. A slot may declare a
wild symbol and minimum visible stack size. Publication validation requires the
symbol to be wild, the minimum to fit the visible rows, and at least one matching
circular run in the actual published strips.

The engine does not alter the grid. Before win evaluation it scans each visible
reel for contiguous runs and emits one `wild.stacked` event per qualifying run,
including reel, start row, size, and symbol. The Flutter client derives its
feature banner and highlighted cells from those authoritative coordinates.

Frozen Kingdom v3 contains preserved `WW` blocks on all five base strips and
combines them with its existing sticky-wild free-spin state. Its changed reel
model and paytable are published as math version 3.0.0.

## Consequences

- Stacks are represented in the probability model rather than injected later.
- Replays and mathematics use the same immutable reel strips.
- Detection works for base spins, free spins, and cascade refills.
- Every strip or stack-size change requires a new published configuration and
  fresh RTP, hit-frequency, volatility, and feature-frequency evidence.
