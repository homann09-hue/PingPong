import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AdminPlayerSummary, CreateEconomyGrantCommand, EconomyAdminAuditEntry, EconomyAdminStore, EconomyGrant, EconomyGrantStatus } from "./economy-admin-store.js";
import { EconomyFourEyesViolationError, EconomyGrantNotFoundError, EconomyGrantStateError, EconomyPlayerNotFoundError } from "./economy-admin-store.js";

interface PlayerRow { id: string; display_name: string | null; status: AdminPlayerSummary["status"]; level: number; xp: string; vip_points: string; coin_balance: string; gem_balance: string; created_at: Date }
interface GrantRow { id: string; player_id: string; currency: "coin" | "gem"; amount: string; reason: string; status: EconomyGrantStatus; requested_by: string; resolved_by: string | null; requested_at: Date; resolved_at: Date | null; balance_before: string | null; balance_after: string | null }
interface AuditRow { id: string; actor: string; action: string; entity_id: string; created_at: Date }

/** Atomically approves a workforce grant, wallet mutation, ledger entry and immutable audit record. */
export class PostgresEconomyAdminStore implements EconomyAdminStore {
  public constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresEconomyAdminStore {
    return new PostgresEconomyAdminStore(new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 }));
  }

  public async searchPlayers(query: string, limit: number): Promise<readonly AdminPlayerSummary[]> {
    const value = query.trim();
    const result = await this.pool.query<PlayerRow>(
      `SELECT p.id,sp.display_name,p.status,p.level,p.xp,p.vip_points,p.created_at,
        COALESCE(MAX(w.balance) FILTER (WHERE w.currency='coin'),0) coin_balance,
        COALESCE(MAX(w.balance) FILTER (WHERE w.currency='gem'),0) gem_balance
       FROM players p LEFT JOIN social_profiles sp ON sp.player_id=p.id LEFT JOIN wallets w ON w.player_id=p.id
       WHERE ($1='' OR p.id::text=$1 OR sp.display_name ILIKE '%' || $1 || '%')
       GROUP BY p.id,sp.display_name ORDER BY p.created_at DESC LIMIT $2`, [value, limit],
    );
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name ?? `Player ${row.id.slice(0, 8)}`, status: row.status,
      level: row.level, xp: Number(row.xp), vipPoints: Number(row.vip_points), coinBalance: Number(row.coin_balance),
      gemBalance: Number(row.gem_balance), createdAt: row.created_at.toISOString() }));
  }

  public async listGrants(status: EconomyGrantStatus | undefined, limit: number): Promise<readonly EconomyGrant[]> {
    const result = await this.pool.query<GrantRow>(
      "SELECT * FROM economy_grant_requests WHERE ($1::text IS NULL OR status=$1) ORDER BY requested_at DESC LIMIT $2", [status ?? null, limit]);
    return result.rows.map(mapGrant);
  }

  public async createGrant(command: CreateEconomyGrantCommand): Promise<EconomyGrant> {
    const client = await this.pool.connect(); const id = randomUUID();
    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT 1 FROM players WHERE id=$1 AND status='active'", [command.playerId]);
      if (!player.rowCount) throw new EconomyPlayerNotFoundError();
      const result = await client.query<GrantRow>(
        `INSERT INTO economy_grant_requests (id,player_id,currency,amount,reason,requested_by,requested_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, command.playerId, command.currency, command.amount, command.reason, command.actor, command.now]);
      await audit(client, command.actor, "economy_grant.created", id, { playerId: command.playerId, currency: command.currency, amount: command.amount });
      await client.query("COMMIT"); return mapGrant(result.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async approveGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const grantResult = await client.query<GrantRow>("SELECT * FROM economy_grant_requests WHERE id=$1 FOR UPDATE", [grantId]);
      const grant = grantResult.rows[0]; if (!grant) throw new EconomyGrantNotFoundError();
      if (grant.status !== "pending") throw new EconomyGrantStateError();
      if (grant.requested_by === actor) throw new EconomyFourEyesViolationError();
      const wallet = await client.query<{ balance: string }>(
        `SELECT w.balance FROM wallets w JOIN players p ON p.id=w.player_id
         WHERE w.player_id=$1 AND w.currency=$2 AND p.status='active' FOR UPDATE`, [grant.player_id, grant.currency]);
      if (!wallet.rows[0]) throw new EconomyPlayerNotFoundError();
      const before = Number(wallet.rows[0].balance); const amount = Number(grant.amount); const after = before + amount;
      await client.query("UPDATE wallets SET balance=$1,version=version+1 WHERE player_id=$2 AND currency=$3", [after, grant.player_id, grant.currency]);
      await client.query(
        `INSERT INTO wallet_ledger (id,player_id,currency,amount,reason,source,reference_id,idempotency_key,balance_before,balance_after,metadata,admin_reason)
         VALUES ($1,$2,$3,$4,'admin_grant','admin',$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), grant.player_id, grant.currency, amount, grant.id, `admin-grant:${grant.id}`, before, after,
          JSON.stringify({ requestedBy: grant.requested_by, approvedBy: actor }), grant.reason]);
      const updated = await client.query<GrantRow>(
        `UPDATE economy_grant_requests SET status='approved',resolved_by=$1,resolved_at=$2,balance_before=$3,balance_after=$4
         WHERE id=$5 RETURNING *`, [actor, now, before, after, grant.id]);
      await audit(client, actor, "economy_grant.approved", grant.id, { playerId: grant.player_id, currency: grant.currency, amount });
      await client.query("COMMIT"); return mapGrant(updated.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async rejectGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<GrantRow>("SELECT * FROM economy_grant_requests WHERE id=$1 FOR UPDATE", [grantId]);
      const grant = current.rows[0]; if (!grant) throw new EconomyGrantNotFoundError();
      if (grant.status !== "pending") throw new EconomyGrantStateError();
      if (grant.requested_by === actor) throw new EconomyFourEyesViolationError();
      const result = await client.query<GrantRow>(
        "UPDATE economy_grant_requests SET status='rejected',resolved_by=$1,resolved_at=$2 WHERE id=$3 RETURNING *", [actor, now, grantId]);
      await audit(client, actor, "economy_grant.rejected", grantId, { playerId: grant.player_id, currency: grant.currency, amount: Number(grant.amount) });
      await client.query("COMMIT"); return mapGrant(result.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async listAudit(limit: number): Promise<readonly EconomyAdminAuditEntry[]> {
    const result = await this.pool.query<AuditRow>(
      "SELECT id,actor,action,entity_id,created_at FROM admin_audit_log WHERE entity_type='economy_grant' ORDER BY created_at DESC LIMIT $1", [limit]);
    return result.rows.map((row) => ({ id: row.id, actor: row.actor, action: row.action, grantId: row.entity_id, createdAt: row.created_at.toISOString() }));
  }
  public async close(): Promise<void> { await this.pool.end(); }
}

async function audit(client: PoolClient, actor: string, action: string, entityId: string, payload: Record<string, unknown>): Promise<void> {
  await client.query("INSERT INTO admin_audit_log (id,actor,action,entity_type,entity_id,payload) VALUES ($1,$2,$3,'economy_grant',$4,$5)",
    [randomUUID(), actor, action, entityId, JSON.stringify(payload)]);
}
function mapGrant(row: GrantRow): EconomyGrant {
  return { id: row.id, playerId: row.player_id, currency: row.currency, amount: Number(row.amount), reason: row.reason,
    status: row.status, requestedBy: row.requested_by, resolvedBy: row.resolved_by, requestedAt: row.requested_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null, balanceBefore: row.balance_before === null ? null : Number(row.balance_before),
    balanceAfter: row.balance_after === null ? null : Number(row.balance_after) };
}
