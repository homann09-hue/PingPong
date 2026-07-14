# ADR-0002: Deterministic server-side RNG

Status: Accepted — 2026-07-13

## Decision

Production creates seeds from a cryptographically secure server source and stores
them with the immutable configuration version and outcome. The engine accepts an
explicit seed and contains no clocks, network calls, or global randomness.

## Consequences

Every disputed spin can be reproduced exactly. Statistical suites can use fixed
seed ranges. The current SplitMix64 stream is suitable for deterministic sampling;
before public launch, security review decides whether a CSPRNG stream is required
for production outcomes while retaining a deterministic audit implementation.
