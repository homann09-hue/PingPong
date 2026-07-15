import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LiveOpsCampaign } from "../liveops/liveops-store.js";
import { InMemoryMessagingStore } from "./in-memory-messaging-store.js";
import { PushCampaignNotPublishableError } from "./messaging-store.js";
import { AesGcmPushTokenCipher } from "./push-token-cipher.js";
import { nextAllowedAfterQuietHours, PushDeliveryWorker, type PushGateway } from "./push-delivery-worker.js";

const campaign: LiveOpsCampaign = {
  id: "10000000-0000-4000-8000-000000000001", version: 1, name: "Weekend",
  status: "published", startsAt: "2026-07-15T10:00:00.000Z", endsAt: "2026-07-16T10:00:00.000Z",
  audience: { minLevel: 1, minVipPoints: 0 },
  creative: { title: "Weekend Coins", subtitle: "Your event is live", ctaLabel: "EVENTS" },
  createdBy: "editor", publishedBy: "publisher", createdAt: "2026-07-14T10:00:00.000Z", publishedAt: "2026-07-14T11:00:00.000Z",
};

describe("push delivery", () => {
  it("encrypts provider tokens with authenticated encryption", () => {
    const cipher = new AesGcmPushTokenCipher(randomBytes(32).toString("base64"));
    const envelope = cipher.encrypt("provider-token-that-must-stay-secret");
    expect(envelope).not.toContain("provider-token");
    expect(cipher.decrypt(envelope)).toBe("provider-token-that-must-stay-secret");
    const parts = envelope.split(".");
    parts[2] = `${parts[2]!.startsWith("A") ? "B" : "A"}${parts[2]!.slice(1)}`;
    expect(() => cipher.decrypt(parts.join("."))).toThrow();
  });

  it("fans out opted-in campaigns and delivers each leased message once", async () => {
    const store = new InMemoryMessagingStore(); const playerId = randomUUID(); const sent: string[] = [];
    await store.updatePreferences(playerId, {
      enabled: true, marketing: true, rewards: true, social: true,
      quietHoursStartMinutes: null, quietHoursEndMinutes: null, timeZone: "Europe/Berlin",
    }, new Date("2026-07-15T09:00:00Z"));
    await store.registerInstallation(playerId, {
      installationId: randomUUID(), platform: "ios", provider: "apns", token: "a-valid-provider-token",
    }, new Date("2026-07-15T09:00:00Z"));
    expect(await store.queueLiveOpsCampaign(campaign, "publisher", new Date("2026-07-15T10:00:00Z")))
      .toEqual({ queued: 1, duplicate: false });
    expect(await store.queueLiveOpsCampaign(campaign, "publisher", new Date("2026-07-15T10:00:00Z")))
      .toEqual({ queued: 0, duplicate: true });
    const gateway: PushGateway = { send: async (delivery) => { sent.push(delivery.id); return { type: "delivered" }; } };
    const worker = new PushDeliveryWorker(store, gateway);
    expect(await worker.runOnce(new Date("2026-07-15T10:00:00Z"))).toBe(1);
    expect(await worker.runOnce(new Date("2026-07-15T10:01:00Z"))).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("removes installations after an invalid-token response", async () => {
    const store = new InMemoryMessagingStore(); const playerId = randomUUID(); const installationId = randomUUID();
    await store.updatePreferences(playerId, { enabled: true, marketing: true, rewards: true, social: true,
      quietHoursStartMinutes: null, quietHoursEndMinutes: null, timeZone: "UTC" }, new Date());
    await store.registerInstallation(playerId, { installationId, platform: "android", provider: "fcm",
      token: "invalid-provider-token" }, new Date());
    await store.queueLiveOpsCampaign(campaign, "publisher", new Date("2026-07-15T10:00:00Z"));
    const worker = new PushDeliveryWorker(store, { send: async () => ({ type: "invalid_token", reason: "unregistered" }) });
    await worker.runOnce(new Date("2026-07-15T10:00:00Z"));
    expect(await store.listInstallations(playerId)).toEqual([]);
  });

  it("disables every installation when the player account is deleted", async () => {
    const store = new InMemoryMessagingStore(); const playerId = randomUUID();
    await store.updatePreferences(playerId, { enabled: true, marketing: true, rewards: true, social: true,
      quietHoursStartMinutes: null, quietHoursEndMinutes: null, timeZone: "UTC" }, new Date());
    await store.registerInstallation(playerId, { installationId: randomUUID(), platform: "web", provider: "web_push",
      token: "web-push-subscription-secret" }, new Date());
    await store.disablePlayer(playerId, new Date());
    expect(await store.listInstallations(playerId)).toEqual([]);
    expect(await store.getPreferences(playerId)).toMatchObject({ enabled: false });
  });

  it("rejects an expired campaign before creating delivery jobs", async () => {
    const store = new InMemoryMessagingStore();
    await expect(store.queueLiveOpsCampaign({ ...campaign, endsAt: "2026-07-15T09:00:00.000Z" }, "publisher",
      new Date("2026-07-15T10:00:00.000Z"))).rejects.toBeInstanceOf(PushCampaignNotPublishableError);
  });

  it("delays delivery until cross-midnight quiet hours end", () => {
    const now = new Date("2026-07-15T21:30:00.000Z"); // 23:30 in Europe/Berlin
    const allowed = nextAllowedAfterQuietHours(now, "Europe/Berlin", 22 * 60, 7 * 60);
    expect(allowed?.toISOString()).toBe("2026-07-16T05:00:00.000Z");
    expect(nextAllowedAfterQuietHours(new Date("2026-07-15T12:00:00Z"), "Europe/Berlin", 1320, 420)).toBeNull();
  });
});
