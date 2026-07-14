# Phase 5: Server-authoritative tournaments

## Outcome

The former profile-derived mock leaderboard is replaced by a recurring weekly
tournament. Spins now create authoritative competition points and the client
renders the active period, prize pool, entrant count, player rank and leaders
returned by the API.

## Fair scoring

Tournament points use the win-to-bet ratio instead of raw coin wins. Every spin
awards participation points and winning spins add capped, bet-normalized points.
This prevents a high-stake player from buying an automatic ranking advantage
while retaining a clear reward for strong outcomes.

## Persistence and ranking

- `tournament_scores` stores one score per player, tournament and UTC week.
- Spin settlement updates the score in the same transaction as the wallet,
  progression, missions, live events and spin audit.
- PostgreSQL calculates ranks with a window function ordered by score and the
  earliest update as deterministic tie-breaker.
- Only anonymized player aliases leave the server leaderboard boundary.
- The local demo adapter uses deterministic paced opponents while keeping the
  local player's score fully driven by real spins.

## API

- `GET /v1/tournaments/active` returns the current competition.
- `GET /v1/profile` embeds the same authoritative tournament view for efficient
  lobby hydration.

## Rollout

Apply `infra/postgres/011_tournaments.sql` before deploying this API version.

## Verification

- API typecheck and release compilation succeed.
- 24 API tests pass, including server-side tournament scoring.
- Flutter analyzer reports no issues.
- 6 Flutter widget tests pass with tournament-card assertions.
- Flutter release web build succeeds.
