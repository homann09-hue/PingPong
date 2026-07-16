# Phase 5: Progressive jackpots

## Outcome

The MINI, MINOR, MAJOR and GRAND values shown by a slot are real progressive
server pools. Settled wagers grow all four pools and configured jackpot bonus
results award the current pool instead of a client-side or static placeholder.

## Settlement model

- Pool contribution is calculated from the accepted server wager.
- Contributions, jackpot detection, pool locking, award replacement, wallet
  settlement, ledger entries, spin audit and pool reset share one PostgreSQL
  transaction.
- The engine remains the source of the jackpot trigger and tier. The settlement
  layer replaces only the configured placeholder bonus amount.
- The awarded amount is embedded in the immutable spin result as
  `progressiveAmount`, making replay and audit deterministic.
- A winning pool resets to its configured seed amount. Other pools continue to
  grow.
- Idempotent spin replay does not contribute or award a second time.

## Pools

| Tier | Seed | Wager contribution |
| --- | ---: | ---: |
| MINI | 500,000 | 1.00% |
| MINOR | 5,000,000 | 0.50% |
| MAJOR | 15,000,000 | 0.35% |
| GRAND | 50,000,000 | 0.25% |

Low play-money wagers contribute at least one coin per tier so the local meter
always demonstrates progression.

## API and client

- `GET /v1/jackpots` publishes the current pools.
- Every successful spin response contains the post-settlement pool snapshot.
- Flutter loads the pools on slot entry and refreshes all meters after a spin.
- Existing jackpot bonus presentation receives the real awarded pool amount.

## Rollout

Apply `infra/postgres/012_progressive_jackpots.sql` and then
`infra/postgres/025_major_progressive_jackpot.sql` before deploying this API.

## Verification

- API typecheck and release build succeed.
- 27 API tests pass, including pool growth, tier detection, contribution math
  and progressive award replacement.
- Flutter analyzer reports no issues.
- 7 Flutter widget tests pass, including progressive meter rendering.
- Offline-capable Flutter release web build succeeds.
