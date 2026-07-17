# Aurora Player Web

Dedicated responsive player application. It shares the existing Aurora API, identity, wallet, progression, jackpots, and server-authoritative slot engine with Flutter clients.

## Local run

1. Start the API from the repository root: `DEMO_MODE=true npm run dev`.
2. Copy `.env.example` to `.env.local` when the API is not on `http://127.0.0.1:8080`.
3. Run `npm run dev:player-web` from the repository root.
4. Open `http://localhost:3000`.

## Security boundary

The browser calls only `/api/player/*`. That same-origin BFF stores platform access and refresh credentials as HttpOnly cookies and proxies a strict endpoint allowlist. Slot RNG, wager validation, wallet settlement, progression, and jackpot awards remain in the existing API.

## Assets and quality tiers

`npm run assets:sync -w @aurora/player-web` copies versioned canonical artwork from `apps/mobile/assets` into generated public build assets and writes a checksum manifest. Next Image negotiates AVIF/WebP and uses quality tiers 55, 72, and 86. Never edit generated files under `public/assets`.
