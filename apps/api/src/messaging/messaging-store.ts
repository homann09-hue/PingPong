import type { LiveOpsCampaign } from "../liveops/liveops-store.js";

export const pushCategories = ["marketing", "rewards", "social", "system"] as const;
export type PushCategory = typeof pushCategories[number];
export type PushPlatform = "ios" | "android" | "web";
export type PushProviderName = "apns" | "fcm" | "web_push";

export interface PushPreferences {
  readonly enabled: boolean;
  readonly marketing: boolean;
  readonly rewards: boolean;
  readonly social: boolean;
  readonly quietHoursStartMinutes: number | null;
  readonly quietHoursEndMinutes: number | null;
  readonly timeZone: string;
  readonly updatedAt: string;
}

export interface RegisterPushInstallation {
  readonly installationId: string;
  readonly platform: PushPlatform;
  readonly provider: PushProviderName;
  readonly token: string;
}

export interface PushInstallation {
  readonly id: string;
  readonly installationId: string;
  readonly platform: PushPlatform;
  readonly provider: PushProviderName;
  readonly updatedAt: string;
}

export interface PushDispatchResult { readonly queued: number; readonly duplicate: boolean }

export interface PushDelivery {
  readonly id: string;
  readonly installationId: string;
  readonly provider: PushProviderName;
  readonly token: string;
  readonly category: PushCategory;
  readonly title: string;
  readonly body: string;
  readonly deepLink: string;
  readonly attempt: number;
  readonly preferences: PushPreferences;
}

export type PushDeliveryDisposition =
  | { readonly type: "delivered" }
  | { readonly type: "suppressed"; readonly reason: string }
  | { readonly type: "failed"; readonly reason: string }
  | { readonly type: "invalid_token"; readonly reason: string }
  | { readonly type: "retry"; readonly reason: string; readonly nextAttemptAt: Date };

export interface MessagingStore {
  getPreferences(playerId: string): Promise<PushPreferences>;
  updatePreferences(playerId: string, preferences: Omit<PushPreferences, "updatedAt">, now: Date): Promise<PushPreferences>;
  listInstallations(playerId: string): Promise<readonly PushInstallation[]>;
  registerInstallation(playerId: string, command: RegisterPushInstallation, now: Date): Promise<PushInstallation>;
  removeInstallation(playerId: string, installationId: string): Promise<boolean>;
  disablePlayer(playerId: string, now: Date): Promise<void>;
  queueLiveOpsCampaign(campaign: LiveOpsCampaign, actor: string, now: Date): Promise<PushDispatchResult>;
  leaseDeliveries(limit: number, now: Date): Promise<readonly PushDelivery[]>;
  settleDelivery(deliveryId: string, disposition: PushDeliveryDisposition, now: Date): Promise<void>;
  close(): Promise<void>;
}

export class PushCampaignNotPublishableError extends Error {}
