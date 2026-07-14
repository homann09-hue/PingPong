# ADR-0001: Start as a modular monolith

Status: Accepted — 2026-07-13

## Decision

Run Games and Economy in one deployable and one PostgreSQL transaction boundary.
Keep domain packages isolated and integrate other contexts through transactional
outbox events. Extract only when measured scaling or ownership constraints demand
it.

## Consequences

Spin settlement cannot lose or duplicate currency through distributed failure.
Teams retain explicit ownership boundaries. Deployments are initially coupled,
but operational complexity and cross-service transaction risk remain low.
