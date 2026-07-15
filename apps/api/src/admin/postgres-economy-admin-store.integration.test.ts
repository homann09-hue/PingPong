import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EconomyFourEyesViolationError } from "./economy-admin-store.js";
import { PostgresEconomyAdminStore } from "./postgres-economy-admin-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("Postgres economy administration", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresEconomyAdminStore(pool);
  const playerId = randomUUID();
  beforeAll(async () => {
    if (!(await pool.query("SELECT to_regclass('public.players') name")).rows[0]?.name) {
      await pool.query(await readFile(new URL("../../../../infra/postgres/001_core.sql", import.meta.url), "utf8"));
    }
    if (!(await pool.query("SELECT to_regclass('public.social_profiles') name")).rows[0]?.name) {
      await pool.query(await readFile(new URL("../../../../infra/postgres/014_social.sql", import.meta.url), "utf8"));
    }
    await pool.query(await readFile(new URL("../../../../infra/postgres/015_liveops_admin.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../../../../infra/postgres/023_economy_admin.sql", import.meta.url), "utf8"));
    await pool.query("INSERT INTO players (id,level,xp,vip_points) VALUES ($1,7,400,900)", [playerId]);
    await pool.query("INSERT INTO social_profiles (player_id,display_name) VALUES ($1,$2)", [playerId, `TEST-${playerId.slice(0, 6)}`]);
    await pool.query("INSERT INTO wallets (player_id,currency,balance) VALUES ($1,'coin',1000),($1,'gem',25)", [playerId]);
  });
  afterAll(async () => store.close());

  it("commits grant, wallet, ledger and immutable audit in one approval", async () => {
    expect(await store.searchPlayers(playerId, 1)).toContainEqual(expect.objectContaining({ id: playerId, coinBalance: 1000 }));
    const grant = await store.createGrant({ playerId, currency: "coin", amount: 500, reason: "Integration support correction", actor: "support-1", now: new Date() });
    await expect(store.approveGrant(grant.id, "support-1", new Date())).rejects.toBeInstanceOf(EconomyFourEyesViolationError);
    const approved = await store.approveGrant(grant.id, "approver-2", new Date());
    expect(approved).toMatchObject({ status: "approved", balanceBefore: 1000, balanceAfter: 1500 });
    expect((await pool.query("SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin'", [playerId])).rows[0].balance).toBe("1500");
    expect((await pool.query("SELECT source,admin_reason FROM wallet_ledger WHERE reference_id=$1", [grant.id])).rows[0])
      .toEqual({ source: "admin", admin_reason: "Integration support correction" });
    await expect(pool.query("UPDATE admin_audit_log SET action='tampered' WHERE entity_id=$1", [grant.id]))
      .rejects.toThrow("admin_audit_log is append-only");
  });
});

