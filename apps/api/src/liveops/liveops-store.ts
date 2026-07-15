export type CampaignStatus = "draft" | "published" | "archived";
export interface CampaignAudience { readonly minLevel: number; readonly minVipPoints: number }
export interface CampaignCreative { readonly title: string; readonly subtitle: string; readonly ctaLabel: string }
export interface LiveOpsCampaign {
  readonly id: string; readonly version: number; readonly name: string; readonly status: CampaignStatus;
  readonly startsAt: string; readonly endsAt: string; readonly audience: CampaignAudience;
  readonly creative: CampaignCreative; readonly createdBy: string; readonly publishedBy: string | null;
  readonly createdAt: string; readonly publishedAt: string | null;
}
export interface CreateCampaignCommand {
  readonly name: string; readonly startsAt: Date; readonly endsAt: Date;
  readonly audience: CampaignAudience; readonly creative: CampaignCreative; readonly actor: string;
}
export interface AdminAuditEntry {
  readonly id: string; readonly actor: string; readonly action: string; readonly entityType: string;
  readonly entityId: string; readonly payload: Readonly<Record<string, unknown>>; readonly createdAt: string;
}
export interface LiveOpsStore {
  listActive(level: number, vipPoints: number, now: Date): Promise<readonly LiveOpsCampaign[]>;
  listCampaigns(): Promise<readonly LiveOpsCampaign[]>;
  createDraft(command: CreateCampaignCommand): Promise<LiveOpsCampaign>;
  publish(campaignId: string, actor: string, now: Date): Promise<LiveOpsCampaign>;
  listAudit(limit: number): Promise<readonly AdminAuditEntry[]>;
  close(): Promise<void>;
}
export class CampaignNotFoundError extends Error {}
export class CampaignStateError extends Error {}
export class FourEyesViolationError extends Error {}
