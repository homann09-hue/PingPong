# ADR 0030: Dedicated player web application

- Status: Accepted
- Date: 2026-07-17

## Context

The Flutter client already ships to iOS, Android, and Web. Its web build is functional, but the desktop lobby is constrained to a phone-width canvas, renders without useful semantic HTML, and couples browser delivery to the API static-file process. The Control Center is an independent administration product and must not become the player-facing web app.

The platform already has the authoritative capabilities that must remain shared across clients: rotating identity sessions, wallet ledger, progression, lobby catalog, jackpots, live operations, and deterministic server-side slot settlement.

## Decision

Create `apps/player-web` as a separate Next.js App Router application.

- Next.js owns responsive HTML, accessibility, SEO metadata, routing, and web delivery.
- A same-origin BFF stores access and rotating refresh tokens only in `HttpOnly`, `Secure` production cookies. Browser JavaScript never receives platform tokens.
- The BFF calls the existing API. It does not implement RNG, paylines, wallet mutation, progression, or jackpot settlement.
- `@aurora/design-tokens` is the cross-client visual contract. Flutter can consume equivalent generated values later without coupling its widget tree to the web app.
- Existing source artwork remains canonical under `apps/mobile/assets`. A deterministic web asset sync copies selected versioned source files into generated public build assets; generated copies are not independently edited.
- Initial reel presentation uses semantic HTML and GPU-friendly CSS transforms. A canvas renderer is deferred until a measured content feature requires it; introducing one now would duplicate interaction and accessibility work without improving authoritative game logic.
- Player Web, API, Flutter client, and Control Center are independently buildable and deployable.

## Consequences

- Desktop and mobile browsers receive purpose-built responsive navigation and lobby density.
- Session cookies require HTTPS in production and a configured server-only `AURORA_API_URL`.
- The API remains the single source of truth, so a spin initiated on Web is visible to the same account on mobile.
- Web deployment cannot reuse the existing Control Center Vercel project; it needs a separate project and domain.
- Account linking beyond guest identity remains a backend roadmap item; the BFF is compatible with adding first-party sign-in later.
