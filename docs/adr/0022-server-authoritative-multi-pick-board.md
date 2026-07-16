# ADR 0022: Server-authoritative multi-pick boards

## Status

Accepted

## Context

Pirate Bay displayed three chests but settled only one multiplier. Every chest
therefore exposed the same result, with no multi-step bonus history. Its legacy
50× Bonus Buy was also not calibrated against the forced feature payout.

## Decision

`pickBonus` configurations define a bounded pick count, board size, and allowed
integer multipliers. The seeded engine draws the configured ordered picks with
replacement, sums them, settles that total once, and records the individual
values plus board size in the immutable `bonus.awarded` event.

Pirate Bay v4 uses three picks on a nine-chest board. Flutter lets the player
open any three distinct chests and reveals the next server-returned value in
each selected position. The interaction controls presentation only; neither
Flutter nor chest position can alter the already authoritative payout.

The normal deterministic 100,000-spin sample measures 94.8946% RTP, 29.899%
hit frequency, and 0.091% natural pick-board frequency. The forced feature
returns 92.7482% of its new 32× play-money purchase price. The game is published
as version 4 and math model `4.0.0`.

## Consequences

- Config, bet, and seed reproduce pick order, total multiplier, and settlement.
- The client can present several tactile reveals without owning prize logic.
- Board size and pick count are validated and reusable by later themes.
- Changing picks, multiplier weights, board size, or purchase price requires a
  new published math version and calibration.
