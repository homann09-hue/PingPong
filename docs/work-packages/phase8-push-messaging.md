# Phase 8 work package: push messaging

## Delivered scope

Aurora now has a provider-neutral, durable push pipeline. Authenticated players
can read and update notification preferences, including independent marketing,
reward and social categories, an account-wide switch, IANA time zone and
cross-midnight quiet hours. Marketing is disabled by default and is never inferred
from gameplay or analytics consent.

The installation registry supports APNs, FCM and Web Push identifiers. Provider
tokens are accepted only over the authenticated API, encrypted with AES-256-GCM
before persistence and never returned by read APIs. A SHA-256 fingerprint supports
safe token reassignment without exposing the original credential.

Published LiveOps campaigns can be queued from the workforce console. Dispatch
requires the publisher role, reuses the existing four-eyes-approved campaign,
applies authoritative level/VIP targeting and includes only active installations
with explicit marketing opt-in. A `(campaign, version)` key makes dispatch
idempotent and the action is appended to the immutable admin audit log.

## Delivery lifecycle

`PushDeliveryWorker` leases rows with PostgreSQL `SKIP LOCKED`, allowing multiple
replicas without duplicate ownership. It reclaims leases abandoned for five
minutes, rechecks current preferences immediately before delivery, delays through
quiet hours, applies bounded exponential retries and deactivates invalid tokens.
Deleted/inactive accounts and installations are suppressed before a gateway call.

The HTTPS gateway adapter sends a normalized APNs/FCM/Web Push envelope with the
delivery UUID as its idempotency key. Production startup requires an HTTPS gateway
URL, a 32-byte gateway credential and a base64-encoded 32-byte token-encryption
key. Demo mode uses an explicit in-process adapter and never contacts a provider.

## API and operations

- `GET /v1/messaging/preferences`
- `PUT /v1/messaging/preferences`
- `GET /v1/messaging/installations`
- `PUT /v1/messaging/installations/current`
- `DELETE /v1/messaging/installations/{installationId}`
- `POST /admin/v1/liveops/campaigns/{campaignId}/push-dispatch`

Migration `infra/postgres/017_push_messaging.sql` owns preferences,
installations, dispatch records and delivery history. Operations must schedule
`purge_push_delivery_history(interval)`, normally for 30 days. Delivery outcomes
are exposed through `aurora_push_deliveries_total` without player or token labels.

## Client boundary

Flutter exposes server-backed notification settings from the lobby. Native system
permission prompts and provider-token acquisition are deliberately not faked:
they require the final Apple/Google/Web application identifiers, entitlements and
gateway credentials. Once those are provisioned, the platform bootstrap supplies
the real token to the existing installation endpoint. Until then the demo proves
preference behavior and backend delivery without claiming device-provider receipt.

## Verification and remaining launch work

Contract tests cover validation, opt-in defaults, token non-disclosure, RBAC and
idempotent dispatch. Worker tests cover authenticated encryption, successful
delivery, invalid-token removal and DST-aware cross-midnight quiet hours. A
PostgreSQL integration test proves encrypted persistence, fan-out, leasing,
settlement and immutable audit output.

Production still needs native permission/token adapters, APNs/FCM/Web Push account
provisioning, deep-link routing, gateway capacity tests, provider receipt
reconciliation, encryption-key rotation procedures, alert thresholds and regional
consent/legal review.
