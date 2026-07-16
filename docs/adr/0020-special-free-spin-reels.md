# ADR 0020: Versioned special free-spin reels and injected wilds

## Status

Accepted

## Context

Free spins already supported alternative reel strips and extra wild injection,
but no published theme used both mechanics. The extra-wild event also omitted
its positions, preventing the client from presenting the authoritative change.

## Decision

Frozen Kingdom v4 switches from its base strips to dedicated free-spin strips.
Those strips retain scatter symbols for bounded retriggers and contain a higher
concentration of contiguous Ice Wild blocks. Before each free-spin evaluation,
the seeded server RNG shuffles all visible coordinates and injects one Wild at
the first coordinate. Sticky-Wild state is applied after injection, so the new
cell persists into later rounds within the same feature.

The `free_spins.modified` event with mode `extra_wilds` now includes an ordered
comma-separated `reel:row` position list. Flutter highlights those cells and
does not choose positions locally. A separate `special_reels` event identifies
the reel-set transition.

The content change is published as game version 4 and math model `4.0.0`. A
deterministic 100,000-spin sample at a 100-coin bet measured 93.72395% RTP,
46.662% hit frequency, 1.527% free-spin trigger frequency, 0.051% retrigger
frequency per base spin, and 5.363 played rounds per triggered feature. The
resulting variance is classified as very high rather than medium.

## Consequences

- Config, bet, and seed reproduce the selected reel stops, injected cell,
  sticky state, retriggers, and settlement.
- Free-spin content can diverge from base-game strips without engine changes.
- Extra-Wild animation and settlement use the same server-returned positions.
- Reel, Wild-count, or paytable changes require another published version and
  a new deterministic math calibration.
