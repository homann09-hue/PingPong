import { Pool } from "pg";
import type { DurableOperationsSnapshot, OperationsStore } from "./operations-store.js";

interface SnapshotRow {
  active_players: string; suspended_players: string; spins_15m: string; analytics_24h: string;
  pending_grants: string; open_moderation: string; push_pending: string; push_processing: string;
  push_stale: string; push_failed_24h: string; admin_actions_24h: string;
}

/** Executes a single bounded aggregate query without exposing operational row contents. */
export class PostgresOperationsStore implements OperationsStore {
  public constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresOperationsStore {
    return new PostgresOperationsStore(new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, statement_timeout: 3_000 }));
  }
  public async snapshot(now: Date): Promise<DurableOperationsSnapshot> {
    const result = await this.pool.query<SnapshotRow>(
      `SELECT
        (SELECT count(*) FROM players WHERE status='active') active_players,
        (SELECT count(*) FROM players WHERE status='suspended') suspended_players,
        (SELECT count(*) FROM spins WHERE created_at >= $1::timestamptz - interval '15 minutes') spins_15m,
        (SELECT count(*) FROM client_analytics_events WHERE received_at >= $1::timestamptz - interval '24 hours') analytics_24h,
        (SELECT count(*) FROM economy_grant_requests WHERE status='pending') pending_grants,
        (SELECT count(*) FROM clan_moderation_cases WHERE status='open') open_moderation,
        (SELECT count(*) FROM push_deliveries WHERE status='pending') push_pending,
        (SELECT count(*) FROM push_deliveries WHERE status='processing') push_processing,
        (SELECT count(*) FROM push_deliveries WHERE status='processing' AND locked_at < $1::timestamptz - interval '5 minutes') push_stale,
        (SELECT count(*) FROM push_deliveries WHERE status='failed' AND completed_at >= $1::timestamptz - interval '24 hours') push_failed_24h,
        (SELECT count(*) FROM admin_audit_log WHERE created_at >= $1::timestamptz - interval '24 hours') admin_actions_24h`, [now],
    );
    const row = result.rows[0]!;
    return {
      activePlayers: Number(row.active_players), suspendedPlayers: Number(row.suspended_players),
      spinsLast15Minutes: Number(row.spins_15m), analyticsEventsLast24Hours: Number(row.analytics_24h),
      pendingEconomyGrants: Number(row.pending_grants), openModerationCases: Number(row.open_moderation),
      pushPending: Number(row.push_pending), pushProcessing: Number(row.push_processing), pushStale: Number(row.push_stale),
      pushFailedLast24Hours: Number(row.push_failed_24h), adminActionsLast24Hours: Number(row.admin_actions_24h),
    };
  }
  public async close(): Promise<void> { await this.pool.end(); }
}
