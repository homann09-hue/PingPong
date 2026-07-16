# ADR 0018: Variable reel heights for Ways slots

## Status

Accepted

## Context

Megaways-like games require a different visible row count on each reel. Treating
the client layout as cosmetic would make displayed combinations diverge from
server settlement. Existing fixed-row modifiers also risk writing into cells
that are absent in a shorter reel.

## Decision

A Ways slot may configure an ascending set of allowed row counts per reel. The
published `rows` value remains the maximum layout height. Validation requires
one option set per reel, values within that maximum, safe maximum-Ways integer
arithmetic, and Ways evaluation. Extra free-spin wild counts must fit even the
smallest possible layout.

For every new base, free-spin, or respin grid, the deterministic spin RNG selects
one allowed height per reel. Grid generation, scatter counting, Ways evaluation,
cascade refill, and symbol modifiers operate on the resulting jagged grid. The
engine emits `layout.changed` with the row vector and exact Ways product.

Expanding wilds now preserve the current reel height. Extra wilds shuffle actual
cell coordinates. Sticky wilds remain stored but are written only when their row
is visible, and walking wilds are removed when the destination reel is too short.

The paytable endpoint reports variable layout status plus minimum and maximum
Ways. Flutter renders each reel using its actual cell count, labels live layouts,
and describes the published maximum rather than claiming a fixed Ways value.

Candy Carnival v4 selects two to five rows independently on five reels, yielding
32 to 3,125 Ways, and publishes math version 4.0.0.

## Consequences

- Displayed cells and settled combinations always use the same authoritative grid.
- Replays reproduce both symbol stops and reel-height choices from the seed.
- Existing fixed-row slots consume no additional RNG values and remain unchanged.
- Row options, divisor, reels, or modifiers require a new immutable game version
  and new RTP, hit-frequency, volatility, and layout-distribution evidence.
