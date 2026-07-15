import { randomUUID } from "node:crypto";
import type { AdminAuditEntry, CreateCampaignCommand, LiveOpsCampaign, LiveOpsStore } from "./liveops-store.js";
import { CampaignNotFoundError, CampaignStateError, FourEyesViolationError } from "./liveops-store.js";

export class InMemoryLiveOpsStore implements LiveOpsStore {
  private readonly campaigns = new Map<string, LiveOpsCampaign>();
  private readonly audit: AdminAuditEntry[] = [];
  public constructor(seed = true) {
    if (seed) {
      const now = new Date(); const id = "20000000-0000-4000-8000-000000000001";
      this.campaigns.set(id, {
        id, version: 1, name: "Welcome campaign", status: "published",
        startsAt: new Date(now.getTime() - 86_400_000).toISOString(), endsAt: new Date(now.getTime() + 6 * 86_400_000).toISOString(),
        audience: { minLevel: 1, minVipPoints: 0 },
        creative: { title: "MEGA COIN WEEK", subtitle: "Spiele Events und sichere dir exklusive Belohnungen", ctaLabel: "EVENTS" },
        createdBy: "system-bootstrap", publishedBy: "system-release", createdAt: now.toISOString(), publishedAt: now.toISOString(),
      });
    }
  }
  public async listActive(level: number, vipPoints: number, now: Date): Promise<readonly LiveOpsCampaign[]> {
    return [...this.campaigns.values()].filter((item) => item.status === "published" &&
      new Date(item.startsAt) <= now && new Date(item.endsAt) > now &&
      item.audience.minLevel <= level && item.audience.minVipPoints <= vipPoints);
  }
  public async listCampaigns(): Promise<readonly LiveOpsCampaign[]> { return [...this.campaigns.values()]; }
  public async createDraft(command: CreateCampaignCommand): Promise<LiveOpsCampaign> {
    const id = randomUUID(); const createdAt = new Date().toISOString();
    const campaign: LiveOpsCampaign = { id, version: 1, name: command.name, status: "draft",
      startsAt: command.startsAt.toISOString(), endsAt: command.endsAt.toISOString(), audience: command.audience,
      creative: command.creative, createdBy: command.actor, publishedBy: null, createdAt, publishedAt: null };
    this.campaigns.set(id, campaign); this.record(command.actor, "campaign.created", id, { version: 1 }); return campaign;
  }
  public async publish(campaignId: string, actor: string, now: Date): Promise<LiveOpsCampaign> {
    const current = this.campaigns.get(campaignId); if (!current) throw new CampaignNotFoundError();
    if (current.status !== "draft") throw new CampaignStateError();
    if (current.createdBy === actor) throw new FourEyesViolationError();
    const published = { ...current, status: "published" as const, publishedBy: actor, publishedAt: now.toISOString() };
    this.campaigns.set(campaignId, published); this.record(actor, "campaign.published", campaignId, { version: current.version });
    return published;
  }
  public async listAudit(limit: number): Promise<readonly AdminAuditEntry[]> { return this.audit.slice(-limit).reverse(); }
  public async close(): Promise<void> {}
  private record(actor: string, action: string, entityId: string, payload: Readonly<Record<string, unknown>>): void {
    this.audit.push({ id: randomUUID(), actor, action, entityType: "liveops_campaign", entityId, payload, createdAt: new Date().toISOString() });
  }
}
