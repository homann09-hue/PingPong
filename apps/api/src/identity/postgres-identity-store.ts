import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AccountSummary, CloudSave, CreateGuestSession, CreateProviderSession, DeviceSummary, IdentityStore, RotateSession, SessionRecord, SessionSummary } from "./identity-store.js";

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
          "INSERT INTO wallets (player_id, currency, balance) VALUES ($1,'coin',$2),($1,'gem',$3)",
          [playerId, command.initialCoinBalance, command.initialGemBalance],
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

  public async createProviderSession(command: CreateProviderSession): Promise<SessionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${command.provider}:${command.providerSubject}`]);
      const identity = await client.query<{ player_id: string }>(
        "SELECT player_id FROM auth_identities WHERE provider=$1 AND provider_subject=$2",
        [command.provider, command.providerSubject],
      );
      const existingPlayerId = identity.rows[0]?.player_id;
      if (command.currentPlayerId && existingPlayerId && command.currentPlayerId !== existingPlayerId) {
        const permanent = await client.query(
          "SELECT 1 FROM auth_identities WHERE player_id=$1 AND provider <> 'guest' LIMIT 1",
          [command.currentPlayerId],
        );
        if (permanent.rowCount) throw new Error("IDENTITY_ALREADY_LINKED");
        await client.query("UPDATE players SET status='deleted' WHERE id=$1", [command.currentPlayerId]);
        await client.query("UPDATE sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE player_id=$1", [command.currentPlayerId]);
        await client.query("DELETE FROM auth_identities WHERE player_id=$1", [command.currentPlayerId]);
        await client.query("UPDATE devices SET installation_id=id WHERE player_id=$1", [command.currentPlayerId]);
      }
      const playerId = existingPlayerId ?? command.currentPlayerId ?? randomUUID();
      if (!existingPlayerId && !command.currentPlayerId) {
        await client.query("INSERT INTO players (id) VALUES ($1)", [playerId]);
        await client.query(
          "INSERT INTO wallets (player_id, currency, balance) VALUES ($1,'coin',$2),($1,'gem',$3)",
          [playerId, command.initialCoinBalance, command.initialGemBalance],
        );
      }
      await client.query(
        `INSERT INTO auth_identities (id, player_id, provider, provider_subject)
         VALUES ($1,$2,$3,$4) ON CONFLICT (provider, provider_subject) DO NOTHING`,
        [randomUUID(), playerId, command.provider, command.providerSubject],
      );
      await client.query("DELETE FROM auth_identities WHERE player_id=$1 AND provider='guest'", [playerId]);
      if (command.currentPlayerId === playerId) {
        await client.query("UPDATE sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE player_id=$1", [playerId]);
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
      id: string; device_id: string; platform: SessionSummary["platform"];
      created_at: Date; last_used_at: Date; expires_at: Date;
    }>(
      `SELECT sessions.id, sessions.device_id, devices.platform, sessions.created_at,
              sessions.last_used_at, sessions.expires_at
         FROM sessions JOIN devices ON devices.id=sessions.device_id
        WHERE sessions.player_id=$1 AND sessions.revoked_at IS NULL
          AND sessions.expires_at > now()
        ORDER BY sessions.last_used_at DESC`,
      [playerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      platform: row.platform,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    }));
  }

  public async listDevices(playerId: string): Promise<readonly DeviceSummary[]> {
    const result = await this.pool.query<{
      id: string; platform: DeviceSummary["platform"]; created_at: Date; last_seen_at: Date; active_sessions: string;
    }>(
      `SELECT devices.id, devices.platform, devices.created_at, devices.last_seen_at,
              count(sessions.id) FILTER (WHERE sessions.revoked_at IS NULL AND sessions.expires_at > now()) AS active_sessions
         FROM devices LEFT JOIN sessions ON sessions.device_id=devices.id
        WHERE devices.player_id=$1
        GROUP BY devices.id ORDER BY devices.last_seen_at DESC`,
      [playerId],
    );
    return result.rows.map((row) => ({ id: row.id, platform: row.platform,
      createdAt: row.created_at.toISOString(), lastSeenAt: row.last_seen_at.toISOString(), activeSessions: Number(row.active_sessions) }));
  }

  public async getAccount(playerId: string): Promise<AccountSummary | null> {
    const result = await this.pool.query<{
      id: string; status: AccountSummary["status"]; created_at: Date; providers: AccountSummary["providers"]; cloud_save_version: string;
    }>(
      `SELECT players.id, players.status, players.created_at,
              coalesce(array_agg(auth_identities.provider ORDER BY auth_identities.provider)
                FILTER (WHERE auth_identities.provider IS NOT NULL), ARRAY[]::text[]) AS providers,
              coalesce(player_cloud_saves.version, 0) AS cloud_save_version
         FROM players
         LEFT JOIN auth_identities ON auth_identities.player_id=players.id
         LEFT JOIN player_cloud_saves ON player_cloud_saves.player_id=players.id
        WHERE players.id=$1 AND players.status <> 'deleted'
        GROUP BY players.id, player_cloud_saves.version`,
      [playerId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { playerId: row.id, status: row.status, createdAt: row.created_at.toISOString(), providers: row.providers,
      isGuest: row.providers.length === 1 && row.providers[0] === "guest", cloudSaveVersion: Number(row.cloud_save_version) };
  }

  public async getCloudSave(playerId: string): Promise<CloudSave> {
    const result = await this.pool.query<{ version: string; updated_at: Date; data: Record<string, unknown> }>(
      "SELECT version, updated_at, data FROM player_cloud_saves WHERE player_id=$1",
      [playerId],
    );
    const row = result.rows[0];
    return row ? { version: Number(row.version), updatedAt: row.updated_at.toISOString(), data: row.data }
      : { version: 0, updatedAt: new Date(0).toISOString(), data: {} };
  }

  public async updateCloudSave(playerId: string, expectedVersion: number, data: Readonly<Record<string, unknown>>): Promise<CloudSave | null> {
    const result = await this.pool.query<{ version: string; updated_at: Date; data: Record<string, unknown> }>(
      `INSERT INTO player_cloud_saves (player_id, version, data)
       SELECT $1, 1, $3::jsonb WHERE $2=0
       ON CONFLICT (player_id) DO UPDATE SET version=player_cloud_saves.version+1, data=EXCLUDED.data, updated_at=now()
       WHERE player_cloud_saves.version=$2
       RETURNING version, updated_at, data`,
      [playerId, expectedVersion, JSON.stringify(data)],
    );
    const row = result.rows[0];
    return row ? { version: Number(row.version), updatedAt: row.updated_at.toISOString(), data: row.data } : null;
  }

  public async exportAccount(playerId: string): Promise<Readonly<Record<string, unknown>> | null> {
    const account = await this.getAccount(playerId);
    if (!account) return null;
    const [wallets, ledger, spins, purchases] = await Promise.all([
      this.pool.query("SELECT currency, balance, version FROM wallets WHERE player_id=$1 ORDER BY currency", [playerId]),
      this.pool.query("SELECT currency, amount, reason, source, created_at FROM wallet_ledger WHERE player_id=$1 ORDER BY created_at", [playerId]),
      this.pool.query("SELECT id, slot_id, bet, win, result, progression_after, created_at FROM spins WHERE player_id=$1 ORDER BY created_at", [playerId]),
      this.pool.query("SELECT offer_id, coins, gems_spent, created_at FROM shop_purchases WHERE player_id=$1 ORDER BY created_at", [playerId]),
    ]);
    return { exportedAt: new Date().toISOString(), account, devices: await this.listDevices(playerId),
      sessions: await this.listSessions(playerId), cloudSave: await this.getCloudSave(playerId),
      wallets: wallets.rows, walletLedger: ledger.rows, spins: spins.rows, shopPurchases: purchases.rows };
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
