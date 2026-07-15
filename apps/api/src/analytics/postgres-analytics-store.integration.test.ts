import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAnalyticsStore } from "./postgres-analytics-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgresAnalyticsStore", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = PostgresAnalyticsStore.connect(databaseUrl!);
  const playerId = randomUUID();
  beforeAll(async () => {
    const migration = await readFile(new URL("../../../../infra/postgres/016_observability_analytics.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query("INSERT INTO players (id) VALUES ($1) ON CONFLICT DO NOTHING", [playerId]);
  });
  afterAll(async () => { await store.close(); await pool.end(); });

  it("persists a constrained event once", async () => {
    const eventId = randomUUID(); const receivedAt = new Date();
    const event = { eventId, name: "screen.viewed" as const, occurredAt: receivedAt,
      platform: "web" as const, appVersion: "0.1.0", screen: "lobby" };
    await expect(store.ingest(playerId, [event], receivedAt)).resolves.toEqual({ accepted: 1, duplicates: 0 });
    await expect(store.ingest(playerId, [event], receivedAt)).resolves.toEqual({ accepted: 0, duplicates: 1 });
    const persisted = await pool.query("SELECT event_name,screen FROM client_analytics_events WHERE event_id=$1", [eventId]);
    expect(persisted.rows).toEqual([{ event_name: "screen.viewed", screen: "lobby" }]);
  });
});
