# ADR 0004: Total-bet settlement and versioned slot math

## Status

Accepted.

## Context

The first playable slice reused one compact symbol population and treated the
request bet as a line bet. With multiple paylines this made wallet debit and
displayed payout mathematically inconsistent. It also made themes differ mostly
through presentation features instead of their underlying probability models.

## Decision

- `SpinRequest.bet` is the complete wallet wager for one paid spin.
- Line awards are `floor(paytable × total bet ÷ configured lines)` using integer
  wallet arithmetic. Scatter, bonus, and jackpot multipliers use total bet.
- Published theme configurations are immutable; the rebuilt models use version 2.
- Every theme owns a distinct reel definition, paytable scale, volatility label,
  measured hit-frequency expectation, and allow-listed feature configuration.
- Wild-only lines pay from the wild paytable. Right-to-left evaluation is opt-in.
- Cascades preserve falling-symbol order, refill from the top, and use bounded
  configuration multipliers. Free-spin multipliers are engine-side.
- Bonus/jackpot and free-spin scatters are separate semantic symbols.
- CI runs deterministic Monte Carlo guardrails. Release certification still
  requires a larger controlled simulation and exact analysis where tractable.

## Consequences

Wallet settlement, UI wording, audit data, and paytable values now describe the
same bet. Existing published version 1 results remain replayable with their old
config; production must retain both versions. Changes affecting probability or
payout require another config version and renewed math evidence.
