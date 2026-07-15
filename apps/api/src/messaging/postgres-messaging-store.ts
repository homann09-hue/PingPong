import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { LiveOpsCampaign } from "../liveops/liveops-store.js";
import type {
  MessagingStore, PushCategory, PushDelivery, PushDeliveryDisposition, PushDispatchResult,
  PushInstallation, PushPlatform, PushPreferences, PushProviderName, RegisterPushInstallation,
} from "./messaging-store.js";
import { PushCampaignNotPublishableError } from "./messaging-store.js";
import type { PushTokenCipher } from "./push-token-cipher.js";

interface PreferenceRow {
  enabled: boolean; marketing: boolean; rewards: boolean; social: boolean;
  quiet_hours_start_minutes: number | null; quiet_hours_end_minutes: number | null;
  time_zone: string; updated_at: Date;
}
interface InstallationRow {
  id: string; installation_id: string; platform: PushPlatform; provider: PushProviderName; updated_at: Date;
}
interface DeliveryRow extends PreferenceRow {
  id: string; installation_id: string; provider: PushProviderName; token_ciphertext: string;
  category: PushCategory; title: string; body: string; deep_link: string; attempt_count: number;
}

/** Durable push registry and transactional campaign fan-out. */
export class PostgresMessagingStore implements MessagingStore {
  private constructor(private readonly pool: Pool, private readonly tokenCipher: PushTokenCipher) {}

  public static connect(connectionString: string, tokenCipher: PushTokenCipher): PostgresMessagingStore {
    return new PostgresMessagingStore(new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 }), tokenCipher);
  }

  public async getPreferences(playerId: string): Promise<PushPreferences> {
    await this.pool.query("INSERT INTO push_preferences (player_id) VALUES ($1) ON CONFLICT DO NOTHING", [playerId]);
    const result = await this.pool.query<PreferenceRow>("SELECT * FROM push_preferences WHERE player_id=$1", [playerId]);
    return mapPreferences(result.rows[0]!);
  }

  public async updatePreferences(
    playerId: string,
    preferences: Omit<PushPreferences, "updatedAt">,
    now: Date,
  ): Promise<PushPreferences> {
    const result = await this.pool.query<PreferenceRow>(
      `INSERT INTO push_preferences
        (player_id,enabled,marketing,rewards,social,quiet_hours_start_minutes,quiet_hours_end_minutes,time_zone,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (player_id) DO UPDATE SET enabled=EXCLUDED.enabled,marketing=EXCLUDED.marketing,
         rewards=EXCLUDED.rewards,social=EXCLUDED.social,
         quiet_hours_start_minutes=EXCLUDED.quiet_hours_start_minutes,
         quiet_hours_end_minutes=EXCLUDED.quiet_hours_end_minutes,time_zone=EXCLUDED.time_zone,updated_at=EXCLUDED.updated_at
       RETURNING *`,
      [playerId, preferences.enabled, preferences.marketing, preferences.rewards, preferences.social,
        preferences.quietHoursStartMinutes, preferences.quietHoursEndMinutes, preferences.timeZone, now],
    );
    return mapPreferences(result.rows[0]!);
  }

  public async listInstallations(playerId: string): Promise<readonly PushInstallation[]> {
    const result = await this.pool.query<InstallationRow>(
      "SELECT id,installation_id,platform,provider,updated_at FROM push_installations WHERE player_id=$1 AND active ORDER BY updated_at DESC",
      [playerId],
    );
    return result.rows.map(mapInstallation);
  }

  public async registerInstallation(playerId: string, command: RegisterPushInstallation, now: Date): Promise<PushInstallation> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const fingerprint = this.tokenCipher.fingerprint(command.token);
      await client.query(
        "UPDATE push_installations SET active=false,updated_at=$1 WHERE token_fingerprint=$2 AND NOT (player_id=$3 AND installation_id=$4)",
        [now, fingerprint, playerId, command.installationId],
      );
      const result = await client.query<InstallationRow>(
        `INSERT INTO push_installations
          (id,player_id,installation_id,platform,provider,token_ciphertext,token_fingerprint,active,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
         ON CONFLICT (player_id,installation_id) DO UPDATE SET platform=EXCLUDED.platform,provider=EXCLUDED.provider,
           token_ciphertext=EXCLUDED.token_ciphertext,token_fingerprint=EXCLUDED.token_fingerprint,active=true,updated_at=EXCLUDED.updated_at
         RETURNING id,installation_id,platform,provider,updated_at`,
        [randomUUID(), playerId, command.installationId, command.platform, command.provider,
          this.tokenCipher.encrypt(command.token), fingerprint, now],
      );
      await client.query("COMMIT");
      return mapInstallation(result.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  public async removeInstallation(playerId: string, installationId: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE push_installations SET active=false,updated_at=now() WHERE player_id=$1 AND installation_id=$2 AND active",
      [playerId, installationId],
    );
    return result.rowCount === 1;
  }

  public async disablePlayer(playerId: string, now: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO push_preferences (player_id,enabled,updated_at) VALUES ($1,false,$2)
         ON CONFLICT (player_id) DO UPDATE SET enabled=false,updated_at=EXCLUDED.updated_at`,
        [playerId, now],
      );
      await client.query("UPDATE push_installations SET active=false,updated_at=$1 WHERE player_id=$2 AND active", [now, playerId]);
      await client.query(
        `UPDATE push_deliveries SET status='suppressed',completed_at=$1,locked_at=NULL,last_error='account_deleted'
          WHERE player_id=$2 AND status IN ('pending','processing')`,
        [now, playerId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  public async queueLiveOpsCampaign(campaign: LiveOpsCampaign, actor: string, now: Date): Promise<PushDispatchResult> {
    if (campaign.status !== "published" || new Date(campaign.endsAt) <= now) throw new PushCampaignNotPublishableError();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dispatch = await client.query(
        `INSERT INTO push_campaign_dispatches (campaign_id,campaign_version,requested_by,requested_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT (campaign_id,campaign_version) DO NOTHING RETURNING campaign_id`,
        [campaign.id, campaign.version, actor, now],
      );
      if (dispatch.rowCount !== 1) { await client.query("ROLLBACK"); return { queued: 0, duplicate: true }; }
      const deliveries = await client.query(
        `INSERT INTO push_deliveries
          (id,campaign_id,campaign_version,player_id,installation_id,category,title,body,deep_link,available_at)
         SELECT gen_random_uuid(),$1,$2,i.player_id,i.id,'marketing',$3,$4,'/events',GREATEST($5::timestamptz,$6::timestamptz)
           FROM push_installations i
           JOIN players p ON p.id=i.player_id AND p.status='active'
           LEFT JOIN push_preferences pref ON pref.player_id=i.player_id
          WHERE i.active AND p.level >= $7 AND p.vip_points >= $8
            AND COALESCE(pref.enabled,true) AND COALESCE(pref.marketing,false)
         ON CONFLICT (campaign_id,campaign_version,installation_id) DO NOTHING`,
        [campaign.id, campaign.version, campaign.creative.title, campaign.creative.subtitle, now,
          new Date(campaign.startsAt), campaign.audience.minLevel, campaign.audience.minVipPoints],
      );
      const queued = deliveries.rowCount ?? 0;
      await client.query(
        `UPDATE push_campaign_dispatches SET queued_count=$1 WHERE campaign_id=$2 AND campaign_version=$3`,
        [queued, campaign.id, campaign.version],
      );
      await client.query(
        `INSERT INTO admin_audit_log (id,actor,action,entity_type,entity_id,payload)
         VALUES ($1,$2,'push.dispatched','liveops_campaign',$3,$4)`,
        [randomUUID(), actor, campaign.id, JSON.stringify({ version: campaign.version, queued })],
      );
      await client.query("COMMIT");
      return { queued, duplicate: false };
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  public async leaseDeliveries(limit: number, now: Date): Promise<readonly PushDelivery[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE push_deliveries d SET status='suppressed',completed_at=$1,locked_at=NULL,last_error='recipient_inactive'
          FROM push_installations i,players p
         WHERE d.installation_id=i.id AND d.player_id=p.id AND d.status IN ('pending','processing')
           AND (NOT i.active OR p.status <> 'active')`,
        [now],
      );
      await client.query(
        `UPDATE push_deliveries SET status='failed',completed_at=$1,locked_at=NULL,last_error='attempt_limit'
          WHERE status IN ('pending','processing') AND attempt_count >= 10`,
        [now],
      );
      const leased = await client.query<{ id: string }>(
        `WITH candidates AS (
           SELECT id FROM push_deliveries
            WHERE (status='pending' AND available_at <= $1)
               OR (status='processing' AND locked_at < $1 - interval '5 minutes')
            ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT $2
         )
         UPDATE push_deliveries d SET status='processing',locked_at=$1,attempt_count=d.attempt_count+1
          FROM candidates WHERE d.id=candidates.id RETURNING d.id`,
        [now, limit],
      );
      if (leased.rows.length === 0) { await client.query("COMMIT"); return []; }
      const result = await client.query<DeliveryRow>(
        `SELECT d.id,i.id AS installation_id,i.provider,i.token_ciphertext,d.category,d.title,d.body,d.deep_link,d.attempt_count,
                COALESCE(pref.enabled,true) AS enabled,COALESCE(pref.marketing,false) AS marketing,
                COALESCE(pref.rewards,true) AS rewards,COALESCE(pref.social,true) AS social,
                pref.quiet_hours_start_minutes,pref.quiet_hours_end_minutes,COALESCE(pref.time_zone,'UTC') AS time_zone,
                COALESCE(pref.updated_at,to_timestamp(0)) AS updated_at
           FROM push_deliveries d JOIN push_installations i ON i.id=d.installation_id
           LEFT JOIN push_preferences pref ON pref.player_id=d.player_id
          WHERE d.id=ANY($1::uuid[]) ORDER BY d.id`,
        [leased.rows.map((row) => row.id)],
      );
      await client.query("COMMIT");
      return result.rows.map((row) => ({
        id: row.id, installationId: row.installation_id, provider: row.provider,
        token: this.tokenCipher.decrypt(row.token_ciphertext), category: row.category,
        title: row.title, body: row.body, deepLink: row.deep_link, attempt: row.attempt_count,
        preferences: mapPreferences(row),
      }));
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  public async settleDelivery(deliveryId: string, disposition: PushDeliveryDisposition, now: Date): Promise<void> {
    const reason = "reason" in disposition ? disposition.reason.slice(0, 256) : null;
    if (disposition.type === "retry") {
      await this.pool.query(
        "UPDATE push_deliveries SET status='pending',available_at=$1,locked_at=NULL,last_error=$2 WHERE id=$3 AND status='processing'",
        [disposition.nextAttemptAt, reason, deliveryId],
      );
      return;
    }
    const status = disposition.type === "delivered" ? "delivered" : disposition.type === "suppressed" ? "suppressed" : "failed";
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const settled = await client.query<{ installation_id: string }>(
        `UPDATE push_deliveries SET status=$1,completed_at=$2,locked_at=NULL,last_error=$3
          WHERE id=$4 AND status='processing' RETURNING installation_id`,
        [status, now, reason, deliveryId],
      );
      if (disposition.type === "invalid_token" && settled.rows[0]) {
        await client.query("UPDATE push_installations SET active=false,updated_at=$1 WHERE id=$2", [now, settled.rows[0].installation_id]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  public async close(): Promise<void> { await this.pool.end(); }
}

function mapPreferences(row: PreferenceRow): PushPreferences {
  return {
    enabled: row.enabled, marketing: row.marketing, rewards: row.rewards, social: row.social,
    quietHoursStartMinutes: row.quiet_hours_start_minutes, quietHoursEndMinutes: row.quiet_hours_end_minutes,
    timeZone: row.time_zone, updatedAt: row.updated_at.toISOString(),
  };
}

function mapInstallation(row: InstallationRow): PushInstallation {
  return { id: row.id, installationId: row.installation_id, platform: row.platform, provider: row.provider, updatedAt: row.updated_at.toISOString() };
}
