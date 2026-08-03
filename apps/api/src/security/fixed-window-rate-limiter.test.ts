import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./fixed-window-rate-limiter.js";

describe("FixedWindowRateLimiter", () => {
  it("enforces a fixed window and resets after expiry", () => {
    const limiter = new FixedWindowRateLimiter();
    expect(limiter.consume("player", 1, 1_000, 1_000).allowed).toBe(true);
    expect(limiter.consume("player", 1, 1_000, 1_500).allowed).toBe(false);
    expect(limiter.consume("player", 1, 1_000, 2_000).allowed).toBe(true);
  });

  it("bounds attacker-controlled keys without disabling existing windows", () => {
    const limiter = new FixedWindowRateLimiter(2);
    expect(limiter.consume("first", 1, 60_000, 1_000).allowed).toBe(true);
    expect(limiter.consume("second", 1, 60_000, 1_000).allowed).toBe(true);
    expect(limiter.consume("third", 1, 60_000, 1_000).allowed).toBe(true);
    expect(limiter.consume("second", 1, 60_000, 1_000).allowed).toBe(false);
    expect(limiter.consume("first", 1, 60_000, 1_000).allowed).toBe(true);
  });

  it("rejects invalid capacity configuration", () => {
    expect(() => new FixedWindowRateLimiter(0)).toThrow(RangeError);
  });
});
