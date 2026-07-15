# Architecture

Aurora uses a modular monolith first, with enforced domain boundaries and an
outbox/event contract. This keeps wallet and spin transactions strongly
consistent while preserving a low-risk path to independently deployed services.

## Bounded contexts

| Context | Owns | Consistency |
|---|---|---|
| Identity | accounts, devices, sessions, consent | strong |
| Economy | wallets, immutable ledger, grants, purchases | strong |
| Games | configs, math versions, spins, jackpots | strong with Economy |
| Progression | XP, levels, VIP, achievements, missions | event-driven |
| Social | friends, clans, leaderboards | eventual |
| LiveOps | events, tournaments, offers, segmentation | eventual |
| Messaging | inbox, push orchestration, preferences | eventual |
| Analytics | telemetry, experiments, aggregates | eventual |
| Admin | RBAC workflows and immutable audit trail | strong |

Guest identities, devices and refresh sessions are persisted together.
Short-lived access JWTs carry a session ID and are accepted only while that
session is active. Refresh tokens are opaque, hash-only at rest and rotate on
every use; replay revokes the active session family. See ADR 0007.

The authoritative spin transaction debits the wager, records the selected
immutable config version and RNG seed, credits the win, and inserts an outbox
event in one PostgreSQL transaction. The client only renders the signed result.
The persisted audit also records balance before/after, server version, math
model version, complete result, and normalized feature events. RNG seeds never
leave the API boundary in player responses.

Wallet mutations are append-only balance transitions. Every entry stores its
source, reference, transaction idempotency key, and balances before/after;
PostgreSQL rejects a transition unless `balance_after = balance_before + amount`.
Wagers and wins are separate entries, while spin replay returns the persisted
settlement without producing another debit or credit. See ADR 0006.

The same settlement returns a server-calculated progression snapshot. Reward
claims are allow-listed, unique per player/reward key, and credited together
with their wallet-ledger entry. Quest and achievement requirements are evaluated
against the authoritative profile before any credit occurs. VIP points and
tournament score are derived from settled gameplay rather than client events.
See ADR 0003.

LiveOps campaign publication is isolated from player authentication. Workforce
JWTs require the `aurora-workforce` issuer, `aurora-admin` audience and a
separate secret. Editors can create drafts, publishers can release them, and a
database constraint rejects self-approval. Every mutation appends an audit row;
PostgreSQL rejects updates and deletes on that audit table. Player reads expose
only published campaigns whose UTC window and level/VIP audience match the
authoritative profile.

## Runtime target

- Flutter clients use feature modules and a render-only slot scene.
- TypeScript/Node API is stateless; PostgreSQL is the system of record.
- Redis is introduced only for rate limits, ephemeral leaderboards, and cache.
- Realtime uses WebSocket/SSE gateways fed from durable outbox events.
- Object storage/CDN hosts versioned asset bundles with integrity manifests.
- OpenTelemetry traces, structured logs, metrics, crash reporting, and analytics
  share correlation IDs but never raw credentials or sensitive identifiers.

## Slot feature model

The base evaluator is pure and deterministic. Feature behavior (free spins,
sticky/walking/expanding wilds, respins, cascades, jackpots and bonus rounds) is
implemented as ordered state-machine modules. Configuration refers only to a
versioned, allow-listed feature type and validated parameters; arbitrary scripts
are forbidden. Presentation hooks are semantic events, not engine-side assets.

The implemented feature pipeline supports scatter pays, bounded free-spin
retriggering, expanding wilds, bounded cascades, deterministic pick and wheel
bonuses, bounded hold-and-win awards, persistent sticky-wild cells during free
spins, walking-wild respins, and fixed symbol-triggered respins. Every transition is included in
`rounds` and emits typed presentation events. Limits are validated to prevent
malformed LiveOps configuration from producing infinite sessions.

Wild multipliers are calculated inside line evaluation, never in the client.
Published configuration defines the wild symbol, per-wild factor, and hard total
cap; each application emits a typed `multiplier.applied` event.

Local jackpots are immutable game configuration: scatter symbol, unique tier,
minimum trigger count, and bet multiplier. The engine selects the highest
eligible tier, settles it as its own bonus round, and emits tier and scatter
count for presentation and audit. The client derives meter values from the same
published multipliers but never decides or credits a jackpot. A shared progressive
pool is intentionally separate future economy infrastructure.

Bonus Buy is allow-listed per immutable game configuration. The server derives
the wallet debit from the configured multiplier, rejects unsupported games, and
passes only a boolean purchase intent into the deterministic engine. Spin audit
data distinguishes base bet, actual wager, and purchase mode.

RTP, volatility, and hit frequency are outputs of reel strips, paytables, feature
probabilities and bet rules—not runtime knobs. A math build is admitted only when
exact analysis or a reproducible large Monte Carlo run meets approved confidence
bands. Published configurations are immutable and hashed.

The line model uses total-bet semantics: wallet wager is distributed across all
configured paylines, while scatter, bonus, and jackpot multipliers use total bet.
Leading wilds substitute regular symbols, all-wild wins use the wild paytable,
and games may explicitly enable right-to-left evaluation. Cascades remove the
winning cells, retain survivor order, refill from the top, and apply only bounded
configured multipliers. See ADR 0004.

Stake steps, max-win limit, win-class thresholds, and semantic math version are
validated configuration. Max-win settlement truncates subsequent rounds,
adjusts the final payable win, and emits `max_win.reached`; wallet code never
performs a second independent cap.
