# ADR 0017: Progressive free-spin multiplier ladders

## Status

Accepted

## Context

A fixed free-spin multiplier cannot model feature modes whose value increases
as the player advances through a bonus. The active factor must depend on the
authoritative free-spin index and remain stable across replay and retriggers.

## Decision

Free-spin configuration may declare either one fixed multiplier or an ordered
multiplier ladder, never both. Each ladder step contains the first free-spin
index at which its multiplier applies. Validation requires the ladder to start
at spin one, remain inside the configured maximum free-spin count, and increase
strictly in both index and multiplier.

Before every free-spin round, the engine resolves the last ladder step whose
index has been reached. It applies that factor to line, ways, and scatter wins
and emits a `free_spins.modified` event containing mode, spin index, and active
multiplier. The existing `multiplier.applied` event remains the common monetary
audit event.

Dragon Peak v3 publishes the ladder ×2 from spin 1, ×3 from spin 4, and ×5 from
spin 8 as math version 3.0.0. Retriggered spins continue using the total played
spin index instead of restarting the ladder.

## Consequences

- Bonus progress is deterministic and server authoritative.
- Static and progressive multipliers cannot accidentally stack.
- Flutter can show the exact current Ultimate Free Spin stage from engine data.
- Ladder, trigger, reel, or paytable changes require a new immutable game
  version and new RTP, hit-frequency, volatility, and reach-frequency evidence.
