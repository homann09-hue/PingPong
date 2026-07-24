import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { PostgresDistributedRateLimiter } from "./distributed-rate-limiter.js";

function limiterReturning(requestCount: number, expiresAt: Date) {
  const query = vi.fn().mockResolvedValue({ rows: [{ request_count: requestCount, expires_at: expiresAt }] });
  const end = vi.fn().mockResolvedValue(undefined);
  const pool = { query, end } as unknown as Pool;
  return { limiter: new PostgresDistributedRateLimiter(pool), query, end };
}

describe("PostgresDistributedRateLimiter", () => {
  it("allows requests inside the shared window and reports remaining capacity", async () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const expiresAt = new Date("2026-07-24T13:00:00.000Z");
    const { limiter, query } = limiterReturning(4, expiresAt);

    await expect(limiter.consume("guest-create:ip:hash", 20, 3_600_000, now)).resolves.toEqual({
      allowed: true,
      remaining: 16,
      retryAfterSeconds: 3_600,
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[1]).toEqual(["guest-create:ip:hash", now, expiresAt]);
  });

  it("blocks requests after the distributed limit is exceeded", async () => {
    const now = new Date("2026-07-24T12:30:00.000Z");
    const { limiter } = limiterReturning(21, new Date("2026-07-24T13:00:00.000Z"));

    await expect(limiter.consume("guest-create:ip:hash", 20, 3_600_000, now)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1_800,
    });
  });

  it("closes its dedicated database pool", async () => {
    const { limiter, end } = limiterReturning(1, new Date("2026-07-24T13:00:00.000Z"));
    await limiter.close();
    expect(end).toHaveBeenCalledOnce();
  });

  it("rejects unsafe keys and invalid windows before querying Postgres", async () => {
    const { limiter, query } = limiterReturning(1, new Date("2026-07-24T13:00:00.000Z"));
    await expect(limiter.consume("", 20, 3_600_000)).rejects.toThrow("Invalid distributed rate-limit key");
    await expect(limiter.consume("valid", 0, 3_600_000)).rejects.toThrow("Invalid distributed rate-limit limit");
    await expect(limiter.consume("valid", 20, 999)).rejects.toThrow("Invalid distributed rate-limit window");
    expect(query).not.toHaveBeenCalled();
  });
});
