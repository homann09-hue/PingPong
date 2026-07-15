import { randomUUID } from "node:crypto";
import type { LiveOpsCampaign } from "../liveops/liveops-store.js";
import type {
  MessagingStore, PushDelivery, PushDeliveryDisposition, PushDispatchResult, PushInstallation,
  PushPreferences, RegisterPushInstallation,
} from "./messaging-store.js";
import { PushCampaignNotPublishableError } from "./messaging-store.js";

interface StoredInstallation extends PushInstallation { readonly playerId: string; token: string }
interface StoredDelivery extends PushDelivery { state: "pending" | "processing" | "delivered" | "failed" | "suppressed"; availableAt: Date }

const defaultPreferences = (now: Date): PushPreferences => ({
  enabled: true,
  marketing: false,
  rewards: true,
  social: true,
  quietHoursStartMinutes: null,
  quietHoursEndMinutes: null,
  timeZone: "UTC",
  updatedAt: now.toISOString(),
});

export class InMemoryMessagingStore implements MessagingStore {
  private readonly preferences = new Map<string, PushPreferences>();
  private readonly installations = new Map<string, StoredInstallation>();
  private readonly deliveries = new Map<string, StoredDelivery>();
  private readonly dispatchedCampaigns = new Set<string>();

  public async getPreferences(playerId: string): Promise<PushPreferences> {
    return this.preferences.get(playerId) ?? defaultPreferences(new Date());
  }

  public async updatePreferences(
    playerId: string,
    preferences: Omit<PushPreferences, "updatedAt">,
    now: Date,
  ): Promise<PushPreferences> {
    const updated = { ...preferences, updatedAt: now.toISOString() };
    this.preferences.set(playerId, updated);
    return updated;
  }

  public async listInstallations(playerId: string): Promise<readonly PushInstallation[]> {
    return [...this.installations.values()].filter((item) => item.playerId === playerId).map(({ playerId: _playerId, token: _token, ...item }) => item);
  }

  public async registerInstallation(playerId: string, command: RegisterPushInstallation, now: Date): Promise<PushInstallation> {
    for (const [key, value] of this.installations) if (value.token === command.token) this.installations.delete(key);
    const key = `${playerId}:${command.installationId}`;
    const existing = this.installations.get(key);
    const stored: StoredInstallation = {
      id: existing?.id ?? randomUUID(), playerId, installationId: command.installationId,
      platform: command.platform, provider: command.provider, token: command.token, updatedAt: now.toISOString(),
    };
    this.installations.set(key, stored);
    const { playerId: _playerId, token: _token, ...publicInstallation } = stored;
    return publicInstallation;
  }

  public async removeInstallation(playerId: string, installationId: string): Promise<boolean> {
    return this.installations.delete(`${playerId}:${installationId}`);
  }

  public async disablePlayer(playerId: string, now: Date): Promise<void> {
    const current = await this.getPreferences(playerId);
    this.preferences.set(playerId, { ...current, enabled: false, updatedAt: now.toISOString() });
    const installationIds = new Set<string>();
    for (const [key, value] of this.installations) {
      if (value.playerId === playerId) { installationIds.add(value.id); this.installations.delete(key); }
    }
    for (const delivery of this.deliveries.values()) {
      if (installationIds.has(delivery.installationId) && (delivery.state === "pending" || delivery.state === "processing")) {
        delivery.state = "suppressed";
      }
    }
  }

  public async queueLiveOpsCampaign(campaign: LiveOpsCampaign, _actor: string, now: Date): Promise<PushDispatchResult> {
    if (campaign.status !== "published" || new Date(campaign.endsAt) <= now) throw new PushCampaignNotPublishableError();
    if (this.dispatchedCampaigns.has(campaign.id)) return { queued: 0, duplicate: true };
    this.dispatchedCampaigns.add(campaign.id);
    let queued = 0;
    for (const installation of this.installations.values()) {
      const preferences = await this.getPreferences(installation.playerId);
      if (!preferences.enabled || !preferences.marketing) continue;
      const delivery: StoredDelivery = {
        id: randomUUID(), installationId: installation.id, provider: installation.provider, token: installation.token,
        category: "marketing", title: campaign.creative.title, body: campaign.creative.subtitle,
        deepLink: "/events", attempt: 0, preferences, state: "pending",
        availableAt: new Date(Math.max(now.getTime(), new Date(campaign.startsAt).getTime())),
      };
      this.deliveries.set(delivery.id, delivery); queued += 1;
    }
    return { queued, duplicate: false };
  }

  public async leaseDeliveries(limit: number, now: Date): Promise<readonly PushDelivery[]> {
    const selected = [...this.deliveries.values()]
      .filter((item) => item.state === "pending" && item.availableAt <= now).slice(0, limit);
    for (const item of selected) { item.state = "processing"; (item as { attempt: number }).attempt += 1; }
    return selected;
  }

  public async settleDelivery(deliveryId: string, disposition: PushDeliveryDisposition, _now: Date): Promise<void> {
    const delivery = this.deliveries.get(deliveryId); if (!delivery) return;
    if (disposition.type === "delivered") delivery.state = "delivered";
    else if (disposition.type === "suppressed") delivery.state = "suppressed";
    else if (disposition.type === "invalid_token") {
      delivery.state = "failed";
      for (const [key, value] of this.installations) if (value.id === delivery.installationId) this.installations.delete(key);
    } else if (disposition.type === "failed") delivery.state = "failed";
    else { delivery.state = "pending"; delivery.availableAt = disposition.nextAttemptAt; }
  }

  public async close(): Promise<void> {}
}
