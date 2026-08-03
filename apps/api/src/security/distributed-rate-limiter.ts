import { Pool } from "pg";

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface DistributedRateLimiter {
  consume(key: string, limit: number, windowMilliseconds: number, now?: Date): Promise<RateLimitDecision>;
  close(): Promise<void>;
}

interface RateLimitRow {
  request_count: number;
  expires_at: Date;
}

/**
 * Cluster-wide fixed-window limiter backed by PostgreSQL.
 * Callers must pass non-sensitive, derived keys; raw IPs and credentials are forbidden.
 */
export class PostgresDistributedRateLimiter implements DistributedRateLimiter {
  public constructor(private readonly pool: Pool) {}

  public static connect(connectionString: string): PostgresDistributedRateLimiter {
    return new PostgresDistributedRateLimiter(new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 }));
  }

  public async consume(key: string, limit: number, windowMilliseconds: number, now = new Date()): Promise<RateLimitDecision> {
    if (!key || key.length > 200) throw new Error("Invalid distributed rate-limit key");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid distributed rate-limit limit");
    if (!Number.isInteger(windowMilliseconds) || windowMilliseconds < 1_000) {
      throw new Error("Invalid distributed rate-limit window");
    }

    const expiresAt = new Date(now.getTime() + windowMilliseconds);
    const result = await this.pool.query<RateLimitRow>(
      `INSERT INTO api_rate_limits (scope_key, request_count, window_started_at, expires_at, updated_at)
       VALUES ($1, 1, $2, $3, $2)
       ON CONFLICT (scope_key) DO UPDATE SET
         request_count = CASE
           WHEN api_rate_limits.expires_at <= $2 THEN 1
           ELSE api_rate_limits.request_count + 1
         END,
         window_started_at = CASE
           WHEN api_rate_limits.expires_at <= $2 THEN $2
           ELSE api_rate_limits.window_started_at
         END,
         expires_at = CASE
           WHEN api_rate_limits.expires_at <= $2 THEN $3
           ELSE api_rate_limits.expires_at
         END,
         updated_at = $2
       RETURNING request_count, expires_at`,
      [key, now, expiresAt],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Distributed rate limiter did not return a counter");

    const count = Number(row.request_count);
    const retryAfterSeconds = Math.max(1, Math.ceil((row.expires_at.getTime() - now.getTime()) / 1_000));
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
