# ADR 0016: Authoritative multiplier symbols

## Status

Accepted

## Context

Standalone multiplier symbols differ from multiplier wilds: they do not
substitute or pay by themselves, but modify other wins in the same round. Their
combination rule and upper bound must be part of the published mathematics.

## Decision

The symbol catalog includes a dedicated `multiplier` kind. A slot configuration
maps multiplier symbols to integer values, selects additive or multiplicative
combination, and declares a maximum combined factor. Publication validation
requires unique symbols of the correct kind and a cap that includes every
individual value.

After lines, ways, and optional scatters have been evaluated, the engine finds
visible configured multiplier symbols. It combines their values, applies the
cap, multiplies every win in that round, and emits a `multiplier.applied` event.
The event records the combination mode, count, final factor, and authoritative
`reel:row=value` positions. Multiplicative combination is capped during the
calculation to prevent unsafe intermediate integer growth.

Neon Nights v3 places ×2 symbols on all five reels, combines them additively up
to ×8, and publishes a dedicated calibrated paytable as math version 3.0.0.

## Consequences

- Multiplier symbols cannot become accidental line or ways candidates.
- Base spins, free spins, respins, and cascades use the same settlement path.
- Flutter highlights the returned positions and displays the applied factor.
- Changes to values, combination, cap, strips, or paytable require a new
  immutable game version and new math evidence.
