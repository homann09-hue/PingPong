# ADR 0021: Per-game sampled volatility bands

## Status

Accepted

## Context

The release test compared average variance between volatility groups. A game
could therefore be mislabeled while still passing because another title pulled
the group average in the opposite direction. Moving one correctly measured
game between groups also changed unrelated group averages.

## Decision

Every published game is checked individually over the deterministic 100,000
seed release sample. Variance bands are `low` below 10, `medium` from 10 to 18,
`high` from 18 to 30, and `very_high` from 30 upward. RTP and hit-frequency
guardrails remain independent checks.

The measured catalog requires two corrections: Jungle Temple is `high` and is
published as version 4 / math `4.0.0`; Candy Carnival is `very_high` and is
published as version 5 / math `5.0.0`. Frozen Kingdom v4 is also `very_high`
after adding persistent special-reel Wild behavior. These profile changes also
select the corresponding configured max-win guardrail.

## Consequences

- A mislabeled game fails by its own sample instead of being hidden by peers.
- Adding or moving a game cannot change another game's pass/fail result.
- Volatility-band or max-win changes require a new published content version.
- Exact certification remains a separate pre-release math process; this test is
  deterministic regression evidence.
