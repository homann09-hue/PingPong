# Phase 6 work package: persistent friends and clans

The previous Club screen changed only local widget state. This package replaces
that placeholder with an authenticated, server-authoritative social graph.

## Delivered

- Social profiles with unique display names.
- Directed friend requests and symmetric friendships.
- Clan creation, discovery, joining and leaving.
- Exactly one clan membership per player, bounded clan capacity and owner role.
- Member roster, bounded officer assignment, role-aware removal and atomic
  ownership transfer with append-only action evidence.
- Demo and PostgreSQL adapters behind the same `SocialStore` contract.
- Flutter rendering and actions sourced only from `/v1/social/overview`.
- API, widget and PostgreSQL integration coverage.

## Security and consistency

Every mutation derives the actor from the access token. Clients cannot submit a
sender identity, member count, role or clan score. PostgreSQL transactions lock
membership and request state before mutation. Unique indexes prevent duplicate
pending requests, duplicate friendships, duplicate clan identities and multiple
memberships.

## Next

Add clan missions, seasonal score settlement, chat/inbox delivery, automated
sanctions and broader abuse controls.
