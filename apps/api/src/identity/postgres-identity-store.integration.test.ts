import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityService } from "./identity-service.js";
import { PostgresIdentityStore } from "./postgres-identity-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("Postgres identity sessions", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresIdentityStore(pool);
  const identity = new IdentityService(store, "postgres-identity-test-secret-32-bytes-minimum");

  beforeAll(async () => {
    const exists = await pool.query<{ table_name: string | null }>("SELECT to_regclass('public.players') AS table_name");
    if (!exists.rows[0]?.table_name) {
      const core = await readFile(new URL("../../../../infra/postgres/001_core.sql", import.meta.url), "utf8");
      await pool.query(core);
    }
    const migration = await readFile(
      new URL("../../../../infra/postgres/005_identity_sessions.sql", import.meta.url), "utf8",
    );
    await pool.query(migration);
  });

  afterAll(async () => identity.close());

  it("persists a guest device and atomically rotates its session", async () => {
    const installationId = randomUUID();
    const first = await identity.createGuest(installationId, "ios");
    const wallets = await pool.query<{ currency: string; balance: string }>(
      "SELECT currency, balance FROM wallets WHERE player_id=$1 ORDER BY currency",
      [first.playerId],
    );
    expect(wallets.rows).toEqual([
      { currency: "coin", balance: "100000" },
      { currency: "gem", balance: "320" },
    ]);
    const rotated = await identity.refresh(first.refreshToken);
    expect(rotated?.playerId).toBe(first.playerId);
    expect(await identity.authenticate(`Bearer ${first.accessToken}`)).toBeNull();
    expect(await identity.authenticate(`Bearer ${rotated!.accessToken}`)).toBe(first.playerId);

    const rows = await pool.query<{ sessions: string; active: string; devices: string }>(
      `SELECT
         (SELECT count(*) FROM sessions WHERE player_id=$1) AS sessions,
         (SELECT count(*) FROM sessions WHERE player_id=$1 AND revoked_at IS NULL) AS active,
         (SELECT count(*) FROM devices WHERE player_id=$1) AS devices`,
      [first.playerId],
    );
    expect(rows.rows[0]).toEqual({ sessions: "2", active: "1", devices: "1" });

    expect(await identity.refresh(first.refreshToken)).toBeNull();
    expect(await identity.authenticate(`Bearer ${rotated!.accessToken}`)).toBeNull();

    const replacement = await identity.createGuest(installationId, "web");
    const sessions = await identity.listSessions(first.playerId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.platform).toBe("web");
    expect(await identity.revokeSession(first.playerId, sessions[0]!.id)).toBe(true);
    expect(await identity.authenticate(`Bearer ${replacement.accessToken}`)).toBeNull();

    const finalSession = await identity.createGuest(installationId, "android");
    expect(await identity.logoutAll(first.playerId)).toBe(1);
    expect(await identity.authenticate(`Bearer ${finalSession.accessToken}`)).toBeNull();
    const deletable = await identity.createGuest(installationId, "ios");
    expect(await identity.deleteAccount(first.playerId)).toBe(true);
    expect(await identity.authenticate(`Bearer ${deletable.accessToken}`)).toBeNull();
    const player = await pool.query<{ status: string }>("SELECT status FROM players WHERE id=$1", [first.playerId]);
    expect(player.rows[0]?.status).toBe("deleted");
  });
});
