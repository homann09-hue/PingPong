import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { AdminAuditEntry, CreateCampaignCommand, LiveOpsCampaign, LiveOpsStore } from "./liveops-store.js";
import { CampaignNotFoundError, CampaignStateError, FourEyesViolationError } from "./liveops-store.js";

interface CampaignRow {
  id: string; version: number; name: string; status: "draft" | "published" | "archived";
  starts_at: Date; ends_at: Date; min_level: number; min_vip_points: string;
  title: string; subtitle: string; cta_label: string; created_by: string; published_by: string | null;
  created_at: Date; published_at: Date | null;
}
interface AuditRow { id: string; actor: string; action: string; entity_type: string; entity_id: string; payload: Record<string, unknown>; created_at: Date }

/** Persists campaign approval and audit records in the same transaction. */
export class PostgresLiveOpsStore implements LiveOpsStore {
  public constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresLiveOpsStore {
    return new PostgresLiveOpsStore(new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 }));
  }
  public async listActive(level: number, vipPoints: number, now: Date): Promise<readonly LiveOpsCampaign[]> {
    const result = await this.pool.query<CampaignRow>(
      `SELECT * FROM liveops_campaigns WHERE status='published' AND starts_at<=$1 AND ends_at>$1
        AND min_level<=$2 AND min_vip_points<=$3 ORDER BY published_at DESC LIMIT 20`, [now, level, vipPoints],
    );
    return result.rows.map((row) => this.map(row));
  }
  public async listCampaigns(): Promise<readonly LiveOpsCampaign[]> {
    const result = await this.pool.query<CampaignRow>("SELECT * FROM liveops_campaigns ORDER BY created_at DESC LIMIT 200");
    return result.rows.map((row) => this.map(row));
  }
  public async createDraft(command: CreateCampaignCommand): Promise<LiveOpsCampaign> {
    const client = await this.pool.connect(); const id = randomUUID();
    try {
      await client.query("BEGIN");
      const campaign = await client.query<CampaignRow>(
        `INSERT INTO liveops_campaigns
          (id,version,name,status,starts_at,ends_at,min_level,min_vip_points,title,subtitle,cta_label,created_by)
         VALUES ($1,1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, command.name, command.startsAt, command.endsAt, command.audience.minLevel, command.audience.minVipPoints,
          command.creative.title, command.creative.subtitle, command.creative.ctaLabel, command.actor],
      );
      await client.query(
        "INSERT INTO admin_audit_log (id,actor,action,entity_type,entity_id,payload) VALUES ($1,$2,'campaign.created','liveops_campaign',$3,$4)",
        [randomUUID(), command.actor, id, JSON.stringify({ version: 1 })],
      );
      await client.query("COMMIT"); return this.map(campaign.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  public async publish(campaignId: string, actor: string, now: Date): Promise<LiveOpsCampaign> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<CampaignRow>("SELECT * FROM liveops_campaigns WHERE id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE", [campaignId]);
      const row = current.rows[0]; if (!row) throw new CampaignNotFoundError();
      if (row.status !== "draft") throw new CampaignStateError();
      if (row.created_by === actor) throw new FourEyesViolationError();
      const result = await client.query<CampaignRow>(
        "UPDATE liveops_campaigns SET status='published',published_by=$1,published_at=$2 WHERE id=$3 AND version=$4 RETURNING *",
        [actor, now, campaignId, row.version],
      );
      await client.query(
        "INSERT INTO admin_audit_log (id,actor,action,entity_type,entity_id,payload) VALUES ($1,$2,'campaign.published','liveops_campaign',$3,$4)",
        [randomUUID(), actor, campaignId, JSON.stringify({ version: row.version })],
      );
      await client.query("COMMIT"); return this.map(result.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  public async listAudit(limit: number): Promise<readonly AdminAuditEntry[]> {
    const result = await this.pool.query<AuditRow>("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1", [limit]);
    return result.rows.map((row) => ({ id: row.id, actor: row.actor, action: row.action, entityType: row.entity_type,
      entityId: row.entity_id, payload: row.payload, createdAt: row.created_at.toISOString() }));
  }
  public async close(): Promise<void> { await this.pool.end(); }
  private map(row: CampaignRow): LiveOpsCampaign {
    return { id: row.id, version: row.version, name: row.name, status: row.status,
      startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(),
      audience: { minLevel: row.min_level, minVipPoints: Number(row.min_vip_points) },
      creative: { title: row.title, subtitle: row.subtitle, ctaLabel: row.cta_label },
      createdBy: row.created_by, publishedBy: row.published_by, createdAt: row.created_at.toISOString(),
      publishedAt: row.published_at?.toISOString() ?? null };
  }
}
