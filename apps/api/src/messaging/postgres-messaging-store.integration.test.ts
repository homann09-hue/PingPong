import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LiveOpsCampaign } from "../liveops/liveops-store.js";
import { PostgresMessagingStore } from "./postgres-messaging-store.js";
import { AesGcmPushTokenCipher } from "./push-token-cipher.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgresMessagingStore", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const cipher = new AesGcmPushTokenCipher(randomBytes(32).toString("base64"));
  const store = PostgresMessagingStore.connect(databaseUrl!, cipher);
  const playerId = randomUUID(); const campaignId = randomUUID();
  const campaign: LiveOpsCampaign = {
    id: campaignId, version: 1, name: "Integration push", status: "published",
    startsAt: new Date(Date.now() - 1_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    audience: { minLevel: 1, minVipPoints: 0 }, creative: { title: "Live event", subtitle: "Play now", ctaLabel: "EVENTS" },
    createdBy: "integration-editor", publishedBy: "integration-publisher",
    createdAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    const migration = await readFile(new URL("../../../../infra/postgres/017_push_messaging.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query("INSERT INTO players (id) VALUES ($1) ON CONFLICT DO NOTHING", [playerId]);
    await pool.query(
      `INSERT INTO liveops_campaigns
        (id,version,name,status,starts_at,ends_at,min_level,min_vip_points,title,subtitle,cta_label,created_by,published_by,published_at)
       VALUES ($1,1,$2,'published',$3,$4,1,0,$5,$6,'EVENTS',$7,$8,now()) ON CONFLICT DO NOTHING`,
      [campaignId, campaign.name, campaign.startsAt, campaign.endsAt, campaign.creative.title,
        campaign.creative.subtitle, campaign.createdBy, campaign.publishedBy],
    );
  });
  afterAll(async () => { await store.close(); await pool.end(); });

  it("encrypts registrations and delivers an audited campaign idempotently", async () => {
    const installationId = randomUUID(); const token = "postgres-provider-token-that-is-secret"; const now = new Date();
    await store.updatePreferences(playerId, { enabled: true, marketing: true, rewards: true, social: true,
      quietHoursStartMinutes: null, quietHoursEndMinutes: null, timeZone: "UTC" }, now);
    await store.registerInstallation(playerId, { installationId, platform: "android", provider: "fcm", token }, now);
    const persisted = await pool.query<{ token_ciphertext: string }>(
      "SELECT token_ciphertext FROM push_installations WHERE player_id=$1 AND installation_id=$2", [playerId, installationId],
    );
    expect(persisted.rows[0]?.token_ciphertext).not.toContain(token);
    expect(await store.queueLiveOpsCampaign(campaign, "integration-publisher", now)).toEqual({ queued: 1, duplicate: false });
    expect(await store.queueLiveOpsCampaign(campaign, "integration-publisher", now)).toEqual({ queued: 0, duplicate: true });
    const deliveries = await store.leaseDeliveries(10, new Date(now.getTime() + 2_000));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ provider: "fcm", token, title: "Live event", attempt: 1 });
    await store.settleDelivery(deliveries[0]!.id, { type: "delivered" }, new Date());
    const state = await pool.query<{ status: string }>("SELECT status FROM push_deliveries WHERE id=$1", [deliveries[0]!.id]);
    expect(state.rows[0]?.status).toBe("delivered");
    const audit = await pool.query<{ action: string }>(
      "SELECT action FROM admin_audit_log WHERE entity_id=$1 AND action='push.dispatched'", [campaignId],
    );
    expect(audit.rows).toEqual([{ action: "push.dispatched" }]);
    await store.disablePlayer(playerId, new Date());
    expect(await store.listInstallations(playerId)).toEqual([]);
    expect(await store.getPreferences(playerId)).toMatchObject({ enabled: false });
  });
});
