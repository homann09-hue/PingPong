# Player Web readiness report

Date: 2026-07-17

## Executive result

The platform backend is ready for a dedicated player web vertical slice. The existing Flutter web build is useful as a visual and behavioral reference, but it is not ready as the long-term desktop player experience.

## Evidence

- API and slot-engine TypeScript builds pass.
- Flutter release web build passes with local CanvasKit assets (`--no-web-resources-cdn`).
- Guest identity, rotating sessions, profile, central wallet, lobby catalog, paytables, jackpots, and server-authoritative spins already exist.
- A live Pharaoh Oasis browser spin debited the wallet and advanced progressive values without browser console errors.
- Eight themed slot definitions and production artwork sets are present.

## Current web gaps

| Area | Status | Finding |
| --- | --- | --- |
| Mobile browser layout | Ready as reference | Coherent 390×844 lobby and navigation. |
| Desktop layout | Blocked for production | Phone-width canvas centered inside a 1440px viewport with extensive unused space. |
| Accessibility | Blocked | Canvas rendering exposes no useful lobby/slot semantic tree. |
| SEO/discovery | Blocked | Player routes and catalog content are not server-rendered HTML. |
| Web delivery | Needs separation | API currently serves Flutter static output; independent releases are not possible. |
| Authentication | Partial | Mobile/web token client exists, but production browser tokens should be protected by an HttpOnly same-origin BFF. |
| Asset delivery | Partial | High-quality local artwork exists; versioned quality tiers/CDN policy are not formalized. |
| Slot authority | Ready | RNG, evaluation, wallet settlement, idempotency, and replay boundary are server-side. |
| Account continuity | Partial | Shared backend identity is ready; explicit guest-to-account linking UI/API remains future work. |

## Captures

- `web-readiness/01-current-flutter-web-lobby-desktop.png`
- `web-readiness/02-current-flutter-web-slot-desktop.png`
- `web-readiness/03-current-flutter-web-spin-result.png`
- `web-readiness/04-current-flutter-web-lobby-mobile.png`

## Go/no-go

Go for a separate web app using the existing backend. No-go for scaling the current centered Flutter canvas into the primary desktop product without first addressing responsive layout, accessibility, independent deployment, secure browser sessions, and web performance budgets.
