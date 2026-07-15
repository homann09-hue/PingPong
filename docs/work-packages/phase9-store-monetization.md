# Phase 9 — Store monetization boundary

Aurora sells only virtual consumables. They cannot be withdrawn, transferred for
money, or redeemed for prizes. Localized price and currency text are owned by
StoreKit or Google Play Billing and are never configured by the game API.

## Trust boundary

- The client submits the platform product ID, transaction ID and opaque proof.
- A private HTTPS gateway normalizes Apple/Google verification.
- The API accepts only purchased, account-bound, quantity-one transactions and
  stores a SHA-256 proof hash, never the receipt or purchase token.
- PostgreSQL grants both wallets in one transaction, deduplicated globally by
  `(platform, transaction_id)` and protected by an advisory transaction lock.
- Refund events are independently idempotent and may precede client verification.
  Recovery never creates a negative wallet. Unrecovered virtual value blocks
  later purchases for manual review.

Apply `infra/postgres/018_store_monetization.sql` and
`infra/postgres/019_native_store_semantics.sql` in order. Production requires
`STORE_VERIFICATION_URL`, `STORE_GATEWAY_TOKEN`, and `STORE_WEBHOOK_TOKEN`; all
tokens must contain at least 32 bytes. Refund notifications are accepted only at
`POST /internal/v1/store/refunds` with the webhook bearer credential.

The Flutter `StorePurchaseBridge` is intentionally dependency-neutral. A release
build uses Flutter's maintained `in_app_purchase` adapter and shows only the
store-provided localized price. The unavailable web/desktop default cannot
initiate a charge and prevents fabricated pricing.

The client deliberately disables automatic consumption. It sends a PURCHASED
transaction to the API, waits for the idempotent wallet grant, and only then calls
the platform completion API. An interrupted client receives the unfinished
transaction again, replays the same server grant safely, and retries completion.
The one-time starter pack is a non-consumable and supports provider restore;
repeatable coin packages are consumables with automatic consumption disabled.
