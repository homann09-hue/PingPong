# Phase 6: Audited LiveOps campaign workflow

## Outcome

The player lobby can render scheduled promotional campaigns owned by the
server. A campaign is drafted and published through a protected workforce API,
and never becomes player-visible without approval from a second operator.

## Domain and API

- `GET /v1/liveops` returns only active campaigns matching the authenticated
  player's authoritative level and VIP points.
- `GET /admin/v1/liveops/campaigns` requires the auditor role.
- `POST /admin/v1/liveops/campaigns` requires the editor role and creates a
  draft with validated UTC dates, targeting and creative copy.
- `POST /admin/v1/liveops/campaigns/:campaignId/publish` requires the publisher
  role and rejects publication by the draft author.
- `GET /admin/v1/audit` exposes bounded audit reads to auditors.

Production uses short-lived HS256 workforce JWTs with issuer
`aurora-workforce`, audience `aurora-admin`, an allow-list of roles and a secret
that is independent from player authentication. Demo mode exposes explicit
editor and publisher identities only for local development.

## Persistence and security

`infra/postgres/015_liveops_admin.sql` stores versioned campaign definitions and
enforces valid windows, audience bounds, publication metadata and second-actor
approval. Draft creation and publication write their audit record in the same
database transaction as the campaign mutation. A database trigger rejects
updates or deletes on `admin_audit_log`, keeping the history append-only even if
application code is bypassed.

Admin routes have a separate rate-limit bucket. Player endpoints cannot create,
edit or publish content and never receive draft campaigns or workforce data.

## Client integration

The Flutter lobby requests campaigns after startup and replaces its fallback
event promotion when an eligible campaign exists. The creative title, subtitle,
expiry and CTA are server-driven; navigation remains mapped to allow-listed
client destinations rather than arbitrary URLs. The branded font is bundled for
both its primary and Material fallback family, so the web build does not depend
on Google Fonts at runtime.

## Verification

- Admin JWT tests cover the dedicated audience and role allow-list.
- API contract tests cover role enforcement, draft invisibility, second-actor
  publication and audit order.
- PostgreSQL integration covers audience filtering, four-eyes publication,
  transactional audit writes and database-level audit immutability.
- Flutter analysis and widget tests pass; the release web build succeeds.
- Browser verification confirms the campaign banner is visible, opens Live
  Events, and generates no new console warnings or errors.

## Remaining scope

This package is the secure backend vertical slice, not the complete visual admin
application. Targeting previews, revision/archival workflows, economy grants,
push orchestration, analytics dashboards and the admin UI remain separate work
packages.
