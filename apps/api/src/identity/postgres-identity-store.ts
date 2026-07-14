import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { CreateGuestSession, IdentityStore, RotateSession, SessionRecord, SessionSummary } from "./identity-store.js";

interface SessionRow { id: string; player_id: string; expires_at: Date; revoked_at: Date | null }

/** PostgreSQL identity adapter with atomic refresh rotation and reuse detection. */
export class PostgresIdentityStore implements IdentityStore {
  public constructor(private readonly pool: Pool) {}

  public static connect(connectionString: string): PostgresIdentityStore {
    return new PostgresIdentityStore(new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 }));
  }

  public async createGuestSession(command: CreateGuestSession): Promise<SessionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [command.installationId]);
      const existing = await client.query<{ player_id: string }>(
        "SELECT player_id FROM auth_identities WHERE provider='guest' AND provider_subject=$1",
        [command.installationId],
      );
      const playerId = existing.rows[0]?.player_id ?? randomUUID();
      if (!existing.rows[0]) {
        await client.query("INSERT INTO players (id) VALUES ($1)", [playerId]);
        await client.query(
          "INSERT INTO wallets (player_id, currency, balance) VALUES ($1,'coin',$2),($1,'gem',0)",
          [playerId, command.initialCoinBalance],
        );
        await client.query(
          "INSERT INTO auth_identities (id, player_id, provider, provider_subject) VALUES ($1,$2,'guest',$3)",
          [randomUUID(), playerId, command.installationId],
        );
      }
      const deviceId = await this.upsertDevice(client, playerId, command.installationId, command.platform);
      const sessionId = randomUUID();
      await client.query(
        `INSERT INTO sessions (id, player_id, device_id, refresh_token_hash, expires_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [sessionId, playerId, deviceId, command.refreshTokenHash, command.expiresAt],
      );
      await client.query("COMMIT");
      return { playerId, sessionId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async rotateSession(command: RotateSession): Promise<SessionRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<SessionRow & { device_id: string }>(
        `SELECT id, player_id, device_id, expires_at, revoked_at
           FROM sessions WHERE refresh_token_hash=$1 FOR UPDATE`,
        [command.refreshTokenHash],
      );
      const current = result.rows[0];
      if (!current || current.revoked_at || current.expires_at <= new Date()) {
        if (current) {
          await client.query(
            "UPDATE sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE player_id=$1 AND revoked_at IS NULL",
            [current.player_id],
          );
        }
        await client.query("COMMIT");
        return null;
      }
      await client.query("UPDATE sessions SET revoked_at=now(), last_used_at=now() WHERE id=$1", [current.id]);
      const sessionId = randomUUID();
      await client.query(
        `INSERT INTO sessions (id, player_id, device_id, refresh_token_hash, expires_at, rotated_from)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [sessionId, current.player_id, current.device_id, command.nextRefreshTokenHash, command.nextExpiresAt, current.id],
      );
      await client.query("COMMIT");
      return { playerId: current.player_id, sessionId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async revokeSession(refreshTokenHash: Buffer): Promise<void> {
    await this.pool.query(
      "UPDATE sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE refresh_token_hash=$1",
      [refreshTokenHash],
    );
  }

  public async revokeSessionById(playerId: string, sessionId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE sessions SET revoked_at=now()
        WHERE id=$1 AND player_id=$2 AND revoked_at IS NULL`,
      [sessionId, playerId],
    );
    return result.rowCount === 1;
  }

  public async revokeAllSessions(playerId: string): Promise<number> {
    const result = await this.pool.query(
      "UPDATE sessions SET revoked_at=now() WHERE player_id=$1 AND revoked_at IS NULL",
      [playerId],
    );
    return result.rowCount ?? 0;
  }

  public async listSessions(playerId: string): Promise<readonly SessionSummary[]> {
    const result = await this.pool.query<{
      id: string; platform: SessionSummary["platform"];
      created_at: Date; last_used_at: Date; expires_at: Date;
    }>(
      `SELECT sessions.id, devices.platform, sessions.created_at,
              sessions.last_used_at, sessions.expires_at
         FROM sessions JOIN devices ON devices.id=sessions.device_id
        WHERE sessions.player_id=$1 AND sessions.revoked_at IS NULL
          AND sessions.expires_at > now()
        ORDER BY sessions.last_used_at DESC`,
      [playerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    }));
  }

  public async deleteAccount(playerId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await client.query(
        "UPDATE players SET status='deleted' WHERE id=$1 AND status <> 'deleted'",
        [playerId],
      );
      if (deleted.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      await client.query("UPDATE sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE player_id=$1", [playerId]);
      await client.query("DELETE FROM auth_identities WHERE player_id=$1", [playerId]);
      await client.query("UPDATE devices SET installation_id=id WHERE player_id=$1", [playerId]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async isSessionActive(sessionId: string, playerId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM sessions JOIN players ON players.id=sessions.player_id
        WHERE sessions.id=$1 AND sessions.player_id=$2 AND sessions.revoked_at IS NULL
          AND sessions.expires_at > now() AND players.status='active'`,
      [sessionId, playerId],
    );
    return result.rowCount === 1;
  }

  public async close(): Promise<void> { await this.pool.end(); }

  private async upsertDevice(
    client: PoolClient,
    playerId: string,
    installationId: string,
    platform: string,
  ): Promise<string> {
    const deviceId = randomUUID();
    const result = await client.query<{ id: string }>(
      `INSERT INTO devices (id, player_id, installation_id, platform)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (player_id, installation_id)
       DO UPDATE SET platform=EXCLUDED.platform, last_seen_at=now()
       RETURNING id`,
      [deviceId, playerId, installationId, platform],
    );
    return result.rows[0]!.id;
  }
}
