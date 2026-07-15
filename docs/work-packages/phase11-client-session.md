# Phase 11 work package: authenticated client sessions

Completed: 15 July 2026

## Implemented

- Flutter creates a stable installation-scoped guest identity through
  `POST /v1/auth/guest` and uses the issued bearer token for every API request.
- Access tokens remain in process memory and are proactively refreshed before
  their 15-minute server expiry.
- Opaque refresh credentials rotate through `POST /v1/auth/refresh` and are
  persisted with `flutter_secure_storage` 10.3.1.
- Concurrent startup and `401` recovery share one refresh operation. A request
  is retried only once and preserves its idempotency key and payload.
- A rejected or expired refresh credential recreates the session with the same
  installation identifier, so the backend resolves the existing guest player.
- Transient gateway/server failures retain the refresh credential and never
  create a replacement player.
- Logout revokes the server session and clears the local refresh credential.
- Android backup is disabled because hardware-bound encrypted preferences must
  not be restored onto another device.
- Demo mode now validates the same signed access tokens as production and no
  longer accepts the static `Bearer local-demo` shortcut.

## Storage boundary

- iOS: Keychain.
- Android API 24+: RSA-OAEP/AES-GCM storage backed by Android Keystore.
- Web: secure-context storage; production deployment requires HTTPS. Browser
  storage cannot compensate for an XSS compromise, so CSP, dependency review,
  output encoding, and the existing no-third-party-script policy remain hard
  release gates.
- Access and refresh tokens must never be logged, placed in analytics events,
  or embedded in crash metadata.

## Verification

- Session tests cover serialized bootstrap, rotation, invalid-token recovery,
  transient failure behavior, concurrent `401` retry, logout, and storage.
- Existing API identity tests cover JWT validation, rotation reuse detection,
  rate limiting, and session revocation.
- Flutter analyze, tests, Web release build, and native CI builds are required.

## Remaining account work

Guest identity recovery is installation-scoped. Cross-device recovery requires
an explicit account-linking package (Sign in with Apple/Google or verified
email), provider-subject uniqueness constraints, merge rules, and a player-led
recovery flow. It must not be simulated by copying guest refresh credentials.
