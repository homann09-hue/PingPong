# ADR 0028: Catalog-driven achievement progression

## Status

Accepted

## Context

Achievements were three response literals inside the profile route. Reward
amounts and requirements were duplicated in separate maps, making it possible
for the visible objective and the claim validation to drift apart. The model
also had no category or durable tier progression.

## Decision

Maintain a typed, immutable achievement catalog in the API domain layer. Each
definition owns its stable reward ID, category, tier, metric, target, Coin
reward, display copy, and optional prerequisite. Profile responses and claim
validation derive from that same definition.

Progress uses only server-owned cumulative player counters. Bronze, Silver,
and Gold claims form explicit prerequisite chains within each category. Existing
reward IDs are retained for the original First Spin, Coin Collector, and High
Roller grants so deployed claim records remain valid. The existing unique
`reward_claims` constraint and transactional wallet ledger remain the durable
idempotency boundary.

## Consequences

- Adding a new achievement is a catalog change with unit-testable semantics.
- Clients cannot fabricate a target, prerequisite, or reward value.
- A completed higher tier remains locked until the preceding reward is claimed.
- Catalog versions or non-Coin reward bundles would require a future persistence
  extension; they are deliberately outside this slice.
