# Player Web design QA

Date: 2026-07-17

## Compared evidence

- Reference: `../../docs/audits/web-readiness/04-current-flutter-web-lobby-mobile.png` at 390×844
- Prototype: `../../docs/audits/web-readiness/06-player-web-lobby-mobile.png` at 390×844
- Desktop prototype: `../../docs/audits/web-readiness/05-player-web-lobby-desktop.png` at 1280×720
- Playable slot: `../../docs/audits/web-readiness/07-player-web-slot-mobile.png` at 390×844

## Results

| Priority | Check | Result |
| --- | --- | --- |
| P0 | Lobby → Pharaoh Oasis → server spin → wallet update | Passed; wallet changed from 8,400,000 to 8,399,900 for a 100-coin spin. |
| P0 | Viewport overflow | Passed; `scrollWidth === innerWidth` at 390 and 1280. |
| P1 | Responsive navigation | Passed; desktop side navigation and mobile bottom navigation are visible at their target breakpoints. |
| P1 | Asset fidelity | Passed; canonical covers, avatar, font, and Pharaoh symbols are synced from the existing Flutter source assets. |
| P1 | Readability and clipping | Passed after shrinking the mobile wallet cluster and constraining hero copy to the card width. |
| P1 | Semantic interaction | Passed; lobby landmarks, named links/buttons, wallet label, slot grid label, live region, and image alternatives are exposed. |
| P2 | Reel end state | Passed after waiting for all five sequential reel transitions; no persistent blur or cropped reel. |
| P2 | Category controls | Passed; visible categories change the catalog and expose pressed state. |

## Follow-up polish

- P3: Season-specific hero merchandising should come from Remote Config instead of the current local catalog metadata.
- P3: Low-card symbols follow the Flutter client's typographic fallback; dedicated raster art can replace them in a later slot-art package.
- P3: Sound controls are wired as UI state; production audio banks remain a separate content package.

final result: passed
