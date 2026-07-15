import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresLiveOpsStore } from "./postgres-liveops-store.js";
import { FourEyesViolationError } from "./liveops-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("Postgres LiveOps approval", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresLiveOpsStore(pool);
  beforeAll(async () => {
    const migration = await readFile(new URL("../../../../infra/postgres/015_liveops_admin.sql", import.meta.url), "utf8");
    await pool.query(migration);
  });
  afterAll(async () => store.close());

  it("atomically publishes a targeted campaign with a second actor and audit trail", async () => {
    const now = new Date();
    const draft = await store.createDraft({ name: `Integration ${now.getTime()}`,
      startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 86_400_000),
      audience: { minLevel: 10, minVipPoints: 2_000 },
      creative: { title: "POSTGRES LIVEOPS", subtitle: "Audited campaign", ctaLabel: "PLAY" }, actor: "integration-editor" });
    await expect(store.publish(draft.id, "integration-editor", now)).rejects.toBeInstanceOf(FourEyesViolationError);
    expect(await store.listActive(9, 10_000, now)).not.toContainEqual(expect.objectContaining({ id: draft.id }));
    const published = await store.publish(draft.id, "integration-publisher", now);
    expect(published).toMatchObject({ status: "published", publishedBy: "integration-publisher" });
    expect(await store.listActive(12, 2_000, now)).toContainEqual(expect.objectContaining({ id: draft.id }));
    const audit = await store.listAudit(20);
    expect(audit.filter((entry) => entry.entityId === draft.id).map((entry) => entry.action)).toEqual([
      "campaign.published", "campaign.created",
    ]);
    await expect(pool.query("UPDATE admin_audit_log SET action='tampered' WHERE entity_id=$1", [draft.id]))
      .rejects.toThrow("admin_audit_log is append-only");
  });
});
