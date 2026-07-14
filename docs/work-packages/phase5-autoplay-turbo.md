# Phase 5: Autoplay and turbo play

## Outcome

Slots now support configurable 10, 25 and 50-spin autoplay sessions and a
player-controlled turbo presentation mode. Every autoplay spin still uses the
normal authenticated, idempotent and server-authoritative spin endpoint.

## Runtime behavior

- Only one spin request can be active at a time.
- The remaining autoplay count is visible on both the selector and stop button.
- Stop requests never discard an in-flight settlement. The current spin is
  completed and reconciled before the local loop exits.
- Bet changes and bonus purchases are locked while autoplay is active.
- Navigation is held until the active settlement finishes, preventing stale
  wallet state in the lobby.
- Autoplay stops automatically on a bonus, free-spin sequence, progressive
  jackpot, max win, win of at least 20x bet, connection failure or insufficient
  coin balance.
- Turbo shortens reel cycling, feature-round transitions and the pause between
  autoplay spins. It does not alter RNG, math, outcomes or server timing.

## Verification

- Flutter analyzer reports no issues.
- 7 widget tests pass, including the 10/25/50 autoplay selector, turbo control
  and progressive jackpot meters.
- Offline-capable Flutter release web build succeeds.
- Manual browser verification covers the slot layout, turbo selection,
  autoplay menu, active countdown and stop control.
