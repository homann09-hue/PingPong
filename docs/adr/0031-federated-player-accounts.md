# ADR 0031: Federated player accounts with Aurora-owned sessions

Status: Accepted

## Context

Players need guest access, Apple, Google and email login, recovery, device
switching, cloud save and immediate session revocation. Wallet balances and
gameplay progression must never become client-authoritative or depend on a
third-party browser session.

## Decision

- Supabase Auth verifies Apple, Google and confirmed email identities. The API
  verifies every supplied provider access token against the Supabase Auth user
  endpoint using only the publishable key. A service-role key is never shipped
  to either player client.
- Aurora remains the account and session authority. After external verification
  it issues the existing 15-minute access token and rotating opaque refresh
  token, both bound to a server-side session and device.
- First-time linking converts the current guest account in one transaction and
  retains its wallet and progression. A known external identity restores its
  existing Aurora player on another device; guest balances are not merged into
  an existing account because that would enable repeated signup grants.
- Economy and progression remain in their normalized server tables. The
  versioned `player_cloud_saves` document stores only cross-device preferences
  and non-economy state, uses optimistic concurrency and is capped at 64 KiB.
- Account suspension is enforced by every authenticated request through the
  active-player session lookup. Deletion revokes all sessions and removes login
  identities. Privacy export includes account, device, session, cloud-save,
  wallet, ledger, spin and shop-purchase records.
- The web BFF owns Aurora credentials in HttpOnly SameSite cookies. Provider
  exchange, logout and deletion are server routes so refresh tokens are never
  readable by browser JavaScript.

## Consequences

Provider outages cannot corrupt wallets or invalidate already active Aurora
sessions. Apple web OAuth credentials still require scheduled secret rotation
in Supabase. Production must configure allowed redirect URLs, email templates,
CAPTCHA and provider consent screens before enabling public registration.
