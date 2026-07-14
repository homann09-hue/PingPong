# Design QA

## Target

- Reference: `design/selected-world-tour.png`
- Reference viewport: 390 × 844 logical pixels
- Browser capture: centered 480 × 720 application crop from the in-app browser
- Primary flow: lobby world journey → select slot → spin → win/free-spin/bonus feedback

## Automated checks

- Flutter static analysis: passed
- Flutter widget journey tests: passed (4)
- Flutter release web build: passed
- Backend and slot-engine type checks: passed
- Backend API tests: passed (9; PostgreSQL integration test skipped without `TEST_DATABASE_URL`)
- Deterministic slot-engine tests: passed (16)

## Visual comparison

- Side-by-side comparison: `design/qa-lobby-comparison.png`
- Lobby capture: `design/implementation-lobby.png`
- Slot captures: `design/implementation-slot-{pharaoh,dragon,candy,pirate,neon,frozen,jungle,vegas}.png`
- Extended lobby capture: `design/implementation-lobby-eight-slots.png`
- Meta captures: `design/meta-{quests,club,events,shop}.png`
- Progression flow: `design/meta-spin-result.png`,
  `design/meta-quests-progress.png`, and `design/meta-quest-claimed.png`
- VIP and competitive meta: `design/meta-vip.png`,
  `design/meta-achievements.png`, `design/meta-tournament.png`, and
  `design/meta-leaderboard.png`
- Bonus Buy flow: `design/bonus-buy-confirmation.png` and
  `design/bonus-buy-wheel.png`

The in-app browser now loads the local release build. The comparison confirms
the selected fantasy world-tour composition, purple/gold economy HUD, player
avatar and level progress, tournament and daily-reward surfaces, progressive
slot journey, and persistent bottom navigation.

All eight available games have distinct backgrounds, frames, jackpots, color
systems, and six bespoke transparent reel symbols (48 symbols total). Reels use
slide/fade transitions, winning states animate, free-spin and cascade rounds are
presented sequentially. Pirate Bay can reveal a server-authoritative pick bonus,
Jungle Temple a deterministic wheel bonus, and Vegas Gold a bounded hold-and-win
bonus.

No P0 or P1 visual defects remain in the captured lobby and eight slot screens.
Remaining P2 product-fidelity gaps are the use of illustrated journey cards
instead of fully modelled machine/building nodes, fewer ornamental progression
details than the reference, and an eight-game catalogue rather than mature
live-ops catalogue scale.

Browser coordinate interaction verified the complete current loop: claim the
daily reward, open Pharaoh Oasis, perform a server-authoritative spin, return to
the lobby, observe updated quest progress, and claim the completed free-spin
mission. The HUD balance increased only after successful API responses. Widget,
API, and deterministic engine tests cover the same boundaries.

The extended browser pass also verified the tappable VIP badge and progress
sheet, three achievement cards, tournament overview, complete five-player
leaderboard, and the player's server-calculated rank. Reward requirements now
fail closed in the API when their objective has not been met.

The Bonus Buy browser pass verified the 50× price label, mandatory confirmation
dialog, purchased Jungle Temple wheel, and the transition into the animated
bonus presentation. A 390-pixel widget test also caught and fixed a jackpot-row
overflow before release.

The exact 390 × 844 browser capture remains unavailable; the centered 480 × 720
application crop has no visible clipping in the tested states. This is
sufficient for the current vertical slice, but not evidence that the platform
has reached the content breadth of a mature live title.

final result: blocked
