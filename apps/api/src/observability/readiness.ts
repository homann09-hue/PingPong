import { Pool } from "pg";

export interface ReadinessResult { readonly ready: boolean; readonly checks: Readonly<Record<string, "up" | "down">> }
export interface ReadinessProbe { check(): Promise<ReadinessResult>; close(): Promise<void> }

export class AlwaysReadyProbe implements ReadinessProbe {
  public async check(): Promise<ReadinessResult> { return { ready: true, checks: { runtime: "up" } }; }
  public async close(): Promise<void> {}
}

/** Uses a small independent pool so readiness verifies the actual system of record. */
export class PostgresReadinessProbe implements ReadinessProbe {
  private constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresReadinessProbe {
    return new PostgresReadinessProbe(new Pool({ connectionString, max: 2, connectionTimeoutMillis: 2_000, statement_timeout: 2_000 }));
  }
  public async check(): Promise<ReadinessResult> {
    try { await this.pool.query("SELECT 1"); return { ready: true, checks: { database: "up" } }; }
    catch { return { ready: false, checks: { database: "down" } }; }
  }
  public async close(): Promise<void> { await this.pool.end(); }
}
