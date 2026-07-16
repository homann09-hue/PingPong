# ADR 0019: Authoritative mystery reveals

## Status

Accepted

## Context

The engine could replace mystery symbols before evaluating wins, but no
published game used the feature and its event exposed only a count. A client
therefore could not identify the transformed cells for presentation or audit.

## Decision

Pharaoh Oasis v3 places `R` mystery symbols directly on its versioned reel
strips. When one or more are visible, the server consumes exactly one value
from the seeded deterministic RNG and selects a shared target from the
configured `A`, `K`, `Q`, and `J` set. Every visible mystery cell becomes that
target before paylines, scatters, expanding wilds, or subsequent rounds are
evaluated.

The `mystery.revealed` event contains the source symbol, selected target,
transformed count, and an ordered comma-separated list of `reel:row`
positions. Flutter uses those authoritative positions for highlighting and
never chooses or settles a target locally.

The reel and paytable change is published as slot version 3 and math model
`3.0.0`. A deterministic 100,000-spin release sample measured 93.8083% RTP,
38.713% hit frequency, and 28.208% mystery-trigger frequency at a 100-coin bet.

## Consequences

- Identical config, bet, and seed reproduce target, positions, grid, and win.
- One trigger consumes one RNG draw regardless of the number of mystery cells.
- New games can reuse the mechanic through configuration alone.
- Changing reel placement, targets, or reveal ordering requires a new published
  game and math-model version.
