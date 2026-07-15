import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresOperationsStore } from "./postgres-operations-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("Postgres operations health aggregate", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresOperationsStore(pool);
  beforeAll(async () => {
    await ensure("players", "001_core.sql");
    await ensure("social_profiles", "014_social.sql");
    await ensure("liveops_campaigns", "015_liveops_admin.sql");
    await ensure("client_analytics_events", "016_observability_analytics.sql");
    await ensure("push_deliveries", "017_push_messaging.sql");
    await ensure("clan_messages", "020_clan_community.sql");
    await ensure("clan_moderation_cases", "021_clan_moderation.sql");
    await ensure("economy_grant_requests", "023_economy_admin.sql");
    await pool.query(await readFile(new URL("../../../../infra/postgres/024_operations_health_indexes.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => store.close());

  it("returns bounded aggregate counts for every operational queue", async () => {
    const snapshot = await store.snapshot(new Date());
    expect(Object.values(snapshot)).toHaveLength(11);
    expect(Object.values(snapshot).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
  });

  async function ensure(table: string, migration: string): Promise<void> {
    const exists = await pool.query<{ name: string | null }>("SELECT to_regclass($1) name", [`public.${table}`]);
    if (!exists.rows[0]?.name) await pool.query(await readFile(new URL(`../../../../infra/postgres/${migration}`, import.meta.url), "utf8"));
  }
});
