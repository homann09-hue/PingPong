import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemorySpinStore } from "./spins/in-memory-spin-store.js";
import { InMemorySocialStore } from "./social/in-memory-social-store.js";
import { ClanOfficerLimitError } from "./social/social-store.js";
import { DemoAdminAuthenticator } from "./admin/admin-auth.js";
import { InMemoryLiveOpsStore } from "./liveops/in-memory-liveops-store.js";
import { InMemoryAnalyticsStore } from "./analytics/in-memory-analytics-store.js";
import { PrometheusOperationalMetrics } from "./observability/operational-metrics.js";
import { AlwaysReadyProbe } from "./observability/readiness.js";
import { InMemoryMessagingStore } from "./messaging/in-memory-messaging-store.js";
import { MonetizationService } from "./monetization/monetization-service.js";
import { DemoReceiptVerifier } from "./monetization/receipt-verifier.js";
import { InMemoryEconomyAdminStore } from "./admin/in-memory-economy-admin-store.js";
import type { OperationsStore } from "./operations/operations-store.js";

const playerId = "00000000-0000-4000-8000-000000000001";
const app = buildApp({
  authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
  spinStore: new InMemorySpinStore(100),
});
afterAll(async () => app.close());

describe("four-eyes economy administration API", () => {
  const spinStore = new InMemorySpinStore(1_000);
  const economyAdminStore = new InMemoryEconomyAdminStore(spinStore, playerId);
  const economyApp = buildApp({
    authenticator: { authenticate: async () => null }, spinStore, economyAdminStore,
    adminAuthenticator: new DemoAdminAuthenticator(),
  });
  afterAll(async () => economyApp.close());

  it("searches players and books an independently approved grant exactly once", async () => {
    const support = { authorization: "Bearer local-admin-support" };
    const approver = { authorization: "Bearer local-admin-economy-approver" };
    const players = await economyApp.inject({ method: "GET", url: "/admin/v1/players?query=Aurora", headers: support });
    expect(players.statusCode).toBe(200);
    expect(players.json().players[0]).toMatchObject({ id: playerId, coinBalance: 1_000, gemBalance: 320 });

    const created = await economyApp.inject({ method: "POST", url: "/admin/v1/economy/grants", headers: support,
      payload: { playerId, currency: "coin", amount: 750, reason: "Verified customer support correction" } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: "pending", requestedBy: "demo-support", amount: 750 });
    const grantId = created.json().id;
    expect((await economyApp.inject({ method: "POST", url: `/admin/v1/economy/grants/${grantId}/approve`, headers: support })).statusCode).toBe(403);

    const approved = await economyApp.inject({ method: "POST", url: `/admin/v1/economy/grants/${grantId}/approve`, headers: approver });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: "approved", resolvedBy: "demo-economy-approver", balanceBefore: 1_000, balanceAfter: 1_750 });
    expect((await spinStore.getProfile(playerId)).coinBalance).toBe(1_750);
    expect((await economyApp.inject({ method: "POST", url: `/admin/v1/economy/grants/${grantId}/approve`, headers: approver })).statusCode).toBe(409);
    expect((await spinStore.getProfile(playerId)).coinBalance).toBe(1_750);
    const audit = await economyApp.inject({ method: "GET", url: "/admin/v1/economy/audit", headers: approver });
    expect(audit.json().entries.map((entry: { action: string }) => entry.action)).toEqual(["economy_grant.approved", "economy_grant.created"]);
  });

  it("rejects invalid grants and keeps rejection separate from wallet mutation", async () => {
    const invalid = await economyApp.inject({ method: "POST", url: "/admin/v1/economy/grants",
      headers: { authorization: "Bearer local-admin-support" }, payload: { playerId, currency: "gem", amount: -1, reason: "invalid" } });
    expect(invalid.statusCode).toBe(400);
    const created = await economyApp.inject({ method: "POST", url: "/admin/v1/economy/grants",
      headers: { authorization: "Bearer local-admin-support" }, payload: { playerId, currency: "gem", amount: 25, reason: "Courtesy correction" } });
    const rejected = await economyApp.inject({ method: "POST", url: `/admin/v1/economy/grants/${created.json().id}/reject`,
      headers: { authorization: "Bearer local-admin-economy-approver" } });
    expect(rejected.json()).toMatchObject({ status: "rejected", balanceBefore: null, balanceAfter: null });
    expect((await spinStore.getProfile(playerId)).gemBalance).toBe(320);
  });
});

describe("verified store monetization API", () => {
  const spinStore = new InMemorySpinStore(1_000);
  const storeApp = buildApp({
    authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
    spinStore, monetizationService: new MonetizationService(new DemoReceiptVerifier(), spinStore),
    storeWebhookToken: "test-store-webhook",
  });
  afterAll(async () => storeApp.close());

  it("publishes grants without inventing platform prices", async () => {
    const response = await storeApp.inject({ method: "GET", url: "/v1/store/products?platform=ios" });
    expect(response.statusCode).toBe(200);
    expect(response.json().products).toHaveLength(4);
    expect(response.json().products[0]).toMatchObject({ storeProductId: "com.aurora.socialcasino.starter_vault", grantCoins: 2_000_000,
      purchaseLimit: "once", storeKind: "nonConsumable" });
    expect(response.body).not.toContain("price");
  });

  it("grants a verified purchase exactly once and rejects an invalid proof", async () => {
    const transactionId = `tx-${randomUUID()}`;
    const request = { method: "POST" as const, url: "/v1/store/purchases/verify", headers: { authorization: "Bearer valid" }, payload: {
      platform: "ios", storeProductId: "com.aurora.socialcasino.coin_stack", transactionId,
      verificationToken: `demo-approved:${transactionId}`,
    } };
    const first = await storeApp.inject(request); const replay = await storeApp.inject(request);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ coins: 1_000_000, coinBalance: 1_001_000, replayed: false });
    expect(replay.json()).toMatchObject({ coinBalance: 1_001_000, replayed: true });
    const invalid = await storeApp.inject({ ...request, payload: { ...request.payload, transactionId: `tx-${randomUUID()}`, verificationToken: "forged" } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toEqual({ code: "PURCHASE_INVALID" });
  });

  it("reverses a refunded grant once and blocks a pre-refunded transaction", async () => {
    const transactionId = `tx-${randomUUID()}`;
    const purchase = { platform: "android", storeProductId: "aurora_fortune_chest", transactionId,
      verificationToken: `demo-approved:${transactionId}` };
    expect((await storeApp.inject({ method: "POST", url: "/v1/store/purchases/verify", headers: { authorization: "Bearer valid" }, payload: purchase })).statusCode).toBe(200);
    const eventId = randomUUID();
    const refund = { method: "POST" as const, url: "/internal/v1/store/refunds", headers: { authorization: "Bearer test-store-webhook" },
      payload: { eventId, platform: "android", transactionId, occurredAt: new Date().toISOString(), providerPayloadHash: "a".repeat(64) } };
    expect((await storeApp.inject(refund)).json()).toEqual({ accepted: true });
    expect((await storeApp.inject(refund)).json()).toEqual({ accepted: false });
    const futureId = `tx-${randomUUID()}`;
    await storeApp.inject({ ...refund, payload: { ...refund.payload, eventId: randomUUID(), transactionId: futureId } });
    const revoked = await storeApp.inject({ method: "POST", url: "/v1/store/purchases/verify", headers: { authorization: "Bearer valid" }, payload: {
      platform: "android", storeProductId: "aurora_coin_stack", transactionId: futureId, verificationToken: `demo-approved:${futureId}`,
    } });
    expect(revoked.statusCode).toBe(409);
    expect(revoked.json()).toEqual({ code: "PURCHASE_REVOKED" });
  });

  it("hides the refund webhook from unauthorized callers", async () => {
    expect((await storeApp.inject({ method: "POST", url: "/internal/v1/store/refunds", payload: {} })).statusCode).toBe(404);
  });
});

describe("observability and analytics API", () => {
  const metrics = new PrometheusOperationalMetrics(false);
  const observableApp = buildApp({
    authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
    spinStore: new InMemorySpinStore(1_000), analyticsStore: new InMemoryAnalyticsStore(),
    metrics, metricsToken: "test-metrics-token", readiness: new AlwaysReadyProbe(),
  });
  afterAll(async () => observableApp.close());

  it("reports readiness and hides metrics without the scrape credential", async () => {
    metrics.recordPush("delivered");
    const ready = await observableApp.inject({ method: "GET", url: "/health/ready" });
    const hidden = await observableApp.inject({ method: "GET", url: "/internal/metrics" });
    const scrape = await observableApp.inject({ method: "GET", url: "/internal/metrics", headers: { authorization: "Bearer test-metrics-token" } });
    expect(ready).toMatchObject({ statusCode: 200 });
    expect(ready.json()).toEqual({ status: "ready", checks: { runtime: "up" } });
    expect(hidden.statusCode).toBe(404);
    expect(scrape.statusCode).toBe(200);
    expect(scrape.body).toContain("aurora_http_requests_total");
    expect(scrape.body).toContain('aurora_push_deliveries_total{result="delivered"} 1');
  });

  it("accepts allow-listed, recent analytics idempotently and rejects arbitrary properties", async () => {
    const event = { eventId: randomUUID(), name: "screen.viewed", occurredAt: new Date().toISOString(),
      platform: "web", appVersion: "0.1.0", screen: "lobby" };
    const request = { method: "POST" as const, url: "/v1/analytics/events", headers: { authorization: "Bearer valid" }, payload: { events: [event] } };
    expect((await observableApp.inject(request)).json()).toEqual({ accepted: 1, duplicates: 0 });
    expect((await observableApp.inject(request)).json()).toEqual({ accepted: 0, duplicates: 1 });
    const invalid = await observableApp.inject({ ...request, payload: { events: [{ ...event, eventId: randomUUID(), email: "must-not-be-collected@example.test" }] } });
    expect(invalid.statusCode).toBe(400);
  });
});

describe("workforce operations health API", () => {
  const metrics = new PrometheusOperationalMetrics(false);
  metrics.observeHttp("GET", "/synthetic", 503, 0.025);
  metrics.recordSpin("classic-3x3", "returned"); metrics.recordSpin("classic-3x3", "rejected");
  metrics.recordAnalytics(4, 1); metrics.recordPush("failed");
  const operationsStore: OperationsStore = {
    snapshot: async () => ({ activePlayers: 42, suspendedPlayers: 2, spinsLast15Minutes: 19,
      analyticsEventsLast24Hours: 120, pendingEconomyGrants: 3, openModerationCases: 4,
      pushPending: 8, pushProcessing: 2, pushStale: 1, pushFailedLast24Hours: 5, adminActionsLast24Hours: 9 }),
    close: async () => {},
  };
  const operationsApp = buildApp({ authenticator: { authenticate: async () => null }, spinStore: new InMemorySpinStore(),
    adminAuthenticator: new DemoAdminAuthenticator(), operationsStore, metrics, readiness: new AlwaysReadyProbe() });
  afterAll(async () => operationsApp.close());

  it("returns aggregate health only to the dedicated operations role", async () => {
    const forbidden = await operationsApp.inject({ method: "GET", url: "/admin/v1/operations/health",
      headers: { authorization: "Bearer local-admin-publisher" } });
    expect(forbidden.statusCode).toBe(403);
    const response = await operationsApp.inject({ method: "GET", url: "/admin/v1/operations/health",
      headers: { authorization: "Bearer local-admin-operations" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "warning", issues: ["stale_push_leases"],
      readiness: { ready: true }, runtime: { requests: { serverErrors: 1 }, spins: { returned: 1, rejected: 1 },
        analytics: { accepted: 4, duplicates: 1 }, push: { failed: 1 } },
      durable: { activePlayers: 42, pushStale: 1, pendingEconomyGrants: 3 } });
    expect(response.body).not.toContain("playerId");
  });
});

describe("push messaging API", () => {
  const messagingStore = new InMemoryMessagingStore();
  const liveOpsStore = new InMemoryLiveOpsStore();
  const messagingApp = buildApp({
    authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
    spinStore: new InMemorySpinStore(1_000), messagingStore, liveOpsStore,
    adminAuthenticator: new DemoAdminAuthenticator(),
  });
  afterAll(async () => messagingApp.close());

  it("persists strict preferences and never returns the provider token", async () => {
    const before = await messagingApp.inject({ method: "GET", url: "/v1/messaging/preferences", headers: { authorization: "Bearer valid" } });
    expect(before.json()).toMatchObject({ enabled: true, marketing: false, rewards: true, social: true, timeZone: "UTC" });
    const preferences = { enabled: true, marketing: true, rewards: true, social: false,
      quietHoursStartMinutes: 1320, quietHoursEndMinutes: 420, timeZone: "Europe/Berlin" };
    const updated = await messagingApp.inject({ method: "PUT", url: "/v1/messaging/preferences",
      headers: { authorization: "Bearer valid" }, payload: preferences });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject(preferences);
    const invalid = await messagingApp.inject({ method: "PUT", url: "/v1/messaging/preferences",
      headers: { authorization: "Bearer valid" }, payload: { ...preferences, timeZone: "Not/A_Real_Zone" } });
    expect(invalid.statusCode).toBe(400);

    const installationId = randomUUID();
    const registered = await messagingApp.inject({ method: "PUT", url: "/v1/messaging/installations/current",
      headers: { authorization: "Bearer valid" }, payload: {
        installationId, platform: "ios", provider: "apns", token: "provider-token-is-secret-and-long-enough",
      } });
    expect(registered.statusCode).toBe(200);
    expect(registered.body).not.toContain("provider-token");
    const listed = await messagingApp.inject({ method: "GET", url: "/v1/messaging/installations",
      headers: { authorization: "Bearer valid" } });
    expect(listed.json().installations).toHaveLength(1);
    expect(listed.body).not.toContain("provider-token");
    const incompatible = await messagingApp.inject({ method: "PUT", url: "/v1/messaging/installations/current",
      headers: { authorization: "Bearer valid" }, payload: {
        installationId: randomUUID(), platform: "android", provider: "apns", token: "another-provider-token-that-is-long",
      } });
    expect(incompatible.statusCode).toBe(400);
  });

  it("permits only a publisher to dispatch a published campaign idempotently", async () => {
    const draft = await liveOpsStore.createDraft({
      name: "Push campaign", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
      audience: { minLevel: 1, minVipPoints: 0 }, creative: { title: "Bonus", subtitle: "Event live", ctaLabel: "EVENTS" }, actor: "demo-editor",
    });
    const draftDispatch = await messagingApp.inject({ method: "POST", url: `/admin/v1/liveops/campaigns/${draft.id}/push-dispatch`,
      headers: { authorization: "Bearer local-admin-publisher" } });
    expect(draftDispatch.statusCode).toBe(409);
    await liveOpsStore.publish(draft.id, "demo-publisher", new Date());
    const forbidden = await messagingApp.inject({ method: "POST", url: `/admin/v1/liveops/campaigns/${draft.id}/push-dispatch`,
      headers: { authorization: "Bearer local-admin-editor" } });
    expect(forbidden.statusCode).toBe(403);
    const request = { method: "POST" as const, url: `/admin/v1/liveops/campaigns/${draft.id}/push-dispatch`,
      headers: { authorization: "Bearer local-admin-publisher" } };
    expect((await messagingApp.inject(request)).json()).toEqual({ queued: 1, duplicate: false });
    expect((await messagingApp.inject(request)).json()).toEqual({ queued: 0, duplicate: true });
  });
});

describe("clan message trust and safety API", () => {
  const socialStore = new InMemorySocialStore(playerId);
  const memberId = "00000000-0000-4000-8000-000000000102";
  const socialApp = buildApp({
    authenticator: { authenticate: async (header) => header === "Bearer owner" ? playerId : header === "Bearer member" ? memberId : null },
    spinStore: new InMemorySpinStore(1_000), socialStore, adminAuthenticator: new DemoAdminAuthenticator(),
  });
  afterAll(async () => socialApp.close());

  it("reports, role-checks, resolves, removes, and audits a clan message", async () => {
    const clan = await socialStore.createClan(playerId, "Safety Testers", "SAFE");
    await socialStore.joinClan(memberId, clan.id);
    const message = await socialStore.postClanMessage(playerId, "message requiring review");
    const reportRequest = { method: "POST" as const, url: `/v1/clans/feed/${message.id}/reports`,
      headers: { authorization: "Bearer member" }, payload: { reason: "harassment", details: "Targeted insult" } };
    const reported = await socialApp.inject(reportRequest);
    expect(reported.statusCode).toBe(201);
    expect((await socialApp.inject(reportRequest)).statusCode).toBe(409);

    expect((await socialApp.inject({ method: "GET", url: "/admin/v1/moderation/cases", headers: { authorization: "Bearer local-admin-editor" } })).statusCode).toBe(403);
    const queue = await socialApp.inject({ method: "GET", url: "/admin/v1/moderation/cases", headers: { authorization: "Bearer local-admin-moderator" } });
    expect(queue.statusCode).toBe(200);
    expect(queue.json().cases[0]).toMatchObject({ messageId: message.id, reportCount: 1, status: "open" });
    const caseId = queue.json().cases[0].id;
    const resolved = await socialApp.inject({ method: "POST", url: `/admin/v1/moderation/cases/${caseId}/resolve`,
      headers: { authorization: "Bearer local-admin-moderator" }, payload: { decision: "remove_message", note: "Policy violation confirmed" } });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().case).toMatchObject({ status: "actioned", resolvedBy: "demo-moderator" });
    expect((await socialApp.inject({ method: "POST", url: `/admin/v1/moderation/cases/${caseId}/resolve`,
      headers: { authorization: "Bearer local-admin-moderator" }, payload: { decision: "dismiss", note: "second decision" } })).statusCode).toBe(409);

    const feed = await socialApp.inject({ method: "GET", url: "/v1/clans/feed", headers: { authorization: "Bearer member" } });
    expect(feed.json().messages.find((item: { id: string }) => item.id === message.id)).toMatchObject({ status: "removed", body: null });
    const audit = await socialApp.inject({ method: "GET", url: "/admin/v1/moderation/audit", headers: { authorization: "Bearer local-admin-moderator" } });
    expect(audit.json().entries[0]).toMatchObject({ caseId, actor: "demo-moderator", decision: "remove_message" });
  });
});

describe("clan member management API", () => {
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const officerId = "00000000-0000-4000-8000-000000000102";
  const memberId = "00000000-0000-4000-8000-000000000103";
  const socialStore = new InMemorySocialStore(ownerId);
  const identities = new Map([["Bearer owner", ownerId], ["Bearer officer", officerId], ["Bearer member", memberId]]);
  const clanApp = buildApp({
    authenticator: { authenticate: async (header) => identities.get(header ?? "") ?? null },
    spinStore: new InMemorySpinStore(1_000), socialStore,
  });
  afterAll(async () => clanApp.close());

  it("lists members and enforces promotion, kick, and ownership-transfer capabilities", async () => {
    const clan = await socialStore.createClan(ownerId, "Managed Clan", "MGR");
    await socialStore.joinClan(officerId, clan.id);
    await socialStore.joinClan(memberId, clan.id);
    const roster = await clanApp.inject({ method: "GET", url: "/v1/clans/members", headers: { authorization: "Bearer member" } });
    expect(roster.statusCode).toBe(200);
    expect(roster.json().members.map((item: { role: string }) => item.role)).toEqual(["owner", "member", "member"]);

    const promote = await clanApp.inject({ method: "PUT", url: `/v1/clans/members/${officerId}/role`,
      headers: { authorization: "Bearer owner" }, payload: { role: "officer" } });
    expect(promote.json().member).toMatchObject({ role: "officer", player: { id: officerId } });
    expect((await clanApp.inject({ method: "PUT", url: `/v1/clans/members/${memberId}/role`,
      headers: { authorization: "Bearer officer" }, payload: { role: "officer" } })).statusCode).toBe(403);

    expect((await clanApp.inject({ method: "DELETE", url: `/v1/clans/members/${memberId}`,
      headers: { authorization: "Bearer officer" } })).statusCode).toBe(204);
    await socialStore.joinClan(memberId, clan.id);
    const transfer = await clanApp.inject({ method: "POST", url: "/v1/clans/ownership-transfer",
      headers: { authorization: "Bearer owner" }, payload: { playerId: memberId } });
    expect(transfer.statusCode).toBe(200);
    expect(transfer.json().members.find((item: { player: { id: string } }) => item.player.id === memberId).role).toBe("owner");
    expect(transfer.json().members.find((item: { player: { id: string } }) => item.player.id === ownerId).role).toBe("officer");
    expect((await clanApp.inject({ method: "PUT", url: `/v1/clans/members/${officerId}/role`,
      headers: { authorization: "Bearer owner" }, payload: { role: "member" } })).statusCode).toBe(403);
  });

  it("caps officer assignment at five", async () => {
    const isolatedOwner = randomUUID();
    const isolated = new InMemorySocialStore(isolatedOwner);
    const clan = await isolated.createClan(isolatedOwner, "Officer Limits", "LIMIT");
    const candidates = Array.from({ length: 6 }, () => randomUUID());
    for (const candidate of candidates) await isolated.joinClan(candidate, clan.id);
    for (const candidate of candidates.slice(0, 5)) await isolated.updateClanMemberRole(isolatedOwner, candidate, "officer");
    await expect(isolated.updateClanMemberRole(isolatedOwner, candidates[5]!, "officer")).rejects.toBeInstanceOf(ClanOfficerLimitError);
  });
});

describe("spin API", () => {
  it("requires an idempotency key", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/slots/classic-3x3/spins", headers: { authorization: "Bearer valid" }, payload: { bet: 10 } });
    expect(response.statusCode).toBe(400);
  });
  it("replays duplicate commands without a second spin", async () => {
    const key = randomUUID();
    const request = { method: "POST" as const, url: "/v1/slots/classic-3x3/spins", headers: { "idempotency-key": key, authorization: "Bearer valid" }, payload: { bet: 10 } };
    const first = await app.inject(request); const second = await app.inject(request);
    expect(first.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(first.json().spin.seed).toBeUndefined();
    expect(first.headers["x-request-id"]).toBeTruthy();
  });
  it("rejects unauthenticated spins", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/slots/classic-3x3/spins", headers: { "idempotency-key": randomUUID() }, payload: { bet: 10 } });
    expect(response.statusCode).toBe(401);
  });
  it("keeps High Roller games server-locked without an active membership", async () => {
    const response = await app.inject({
      method: "POST", url: "/v1/slots/neon-nights/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 10 },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "HIGH_ROLLER_MEMBERSHIP_REQUIRED", entryPoints: 20_000, points: 0 });
  });
  it("never permits a negative balance", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/slots/classic-3x3/spins", headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 1_000 } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "INSUFFICIENT_FUNDS" });
  });
  it("awards a server-authoritative reward only once", async () => {
    const first = await app.inject({
      method: "POST", url: "/v1/rewards/daily/claims", headers: { authorization: "Bearer valid" },
    });
    const second = await app.inject({
      method: "POST", url: "/v1/rewards/daily/claims", headers: { authorization: "Bearer valid" },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().coins).toBe(250_000);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ code: "REWARD_ALREADY_CLAIMED" });
  });
  it("rejects rewards whose progression requirement is not met", async () => {
    const response = await app.inject({
      method: "POST", url: "/v1/rewards/spin-10/claims", headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "REWARD_REQUIREMENT_NOT_MET" });
  });
  it("publishes the High Roller Club contract and rejects premature entry", async () => {
    const status = await app.inject({
      method: "GET", url: "/v1/economy/high-roller-club", headers: { authorization: "Bearer valid" },
    });
    const activation = await app.inject({
      method: "POST", url: "/v1/economy/high-roller-club/activate",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ entryPoints: 20_000, active: false, eligible: false });
    expect(status.json().sources).toHaveLength(10);
    expect(status.json().benefits).toHaveLength(5);
    expect(activation.json()).toEqual({ code: "HIGH_ROLLER_NOT_ELIGIBLE" });
  });
  it("claims catalog achievements once and validates their tier progression", async () => {
    const achievementApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
    });
    await achievementApp.inject({
      method: "POST", url: "/v1/slots/classic-3x3/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 10 },
    });
    const first = await achievementApp.inject({
      method: "POST", url: "/v1/rewards/achievement-first-spin/claims", headers: { authorization: "Bearer valid" },
    });
    const replay = await achievementApp.inject({
      method: "POST", url: "/v1/rewards/achievement-first-spin/claims", headers: { authorization: "Bearer valid" },
    });
    const silver = await achievementApp.inject({
      method: "POST", url: "/v1/rewards/achievement-high-roller/claims", headers: { authorization: "Bearer valid" },
    });
    expect(first).toMatchObject({ statusCode: 200 });
    expect(first.json()).toMatchObject({ rewardId: "achievement-first-spin", coins: 75_000 });
    expect(replay.statusCode).toBe(409);
    expect(silver.json()).toEqual({ code: "REWARD_REQUIREMENT_NOT_MET" });
    await achievementApp.close();
  });
  it("returns an authoritative VIP, achievement, and tournament profile", async () => {
    const response = await app.inject({
      method: "GET", url: "/v1/profile", headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().playerId).toBe(playerId);
    expect(response.json().vip.tier).toBe("SILVER");
    expect(response.json().achievements).toHaveLength(15);
    expect(response.json().achievements[0]).toMatchObject({
      category: "journey", tier: "bronze", rewardId: "achievement-journey-2", unlocked: true,
    });
    expect(response.json().achievements.find((item: { rewardId: string }) => item.rewardId === "achievement-high-roller"))
      .toMatchObject({ category: "spins", tier: "silver", unlocked: false });
    expect(response.json().tournament.name).toBe("WORLD FORTUNE CHAMPIONSHIP");
    expect(response.json().tournament.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("scores tournament spins on the server and publishes the active leaderboard", async () => {
    const tournamentApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000),
    });
    const before = await tournamentApp.inject({ method: "GET", url: "/v1/tournaments/active", headers: { authorization: "Bearer valid" } });
    const spin = await tournamentApp.inject({
      method: "POST", url: "/v1/slots/classic-3x3/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 10 },
    });
    const after = await tournamentApp.inject({ method: "GET", url: "/v1/tournaments/active", headers: { authorization: "Bearer valid" } });
    expect(before.statusCode).toBe(200);
    expect(before.json().score).toBe(0);
    expect(spin.statusCode).toBe(200);
    expect(after.json().score).toBeGreaterThan(0);
    expect(after.json()).toMatchObject({ scoring: "normalized_win_points", prizePool: 25_000_000 });
    await tournamentApp.close();
  });
  it("grows authoritative progressive jackpot pools from settled wagers", async () => {
    const jackpotApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(10_000),
    });
    const before = await jackpotApp.inject({ method: "GET", url: "/v1/jackpots" });
    const spin = await jackpotApp.inject({
      method: "POST", url: "/v1/slots/classic-3x3/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 100 },
    });
    expect(spin.statusCode).toBe(200);
    expect(spin.json().jackpots).toHaveLength(4);
    expect(spin.json().jackpots.map((pool: { tier: string }) => pool.tier)).toEqual([
      "MINI", "MINOR", "MAJOR", "GRAND",
    ]);
    expect(spin.json().jackpots[0].amount).toBeGreaterThan(before.json().jackpots[0].amount);
    await jackpotApp.close();
  });
  it("purchases play-money bundles atomically and enforces daily offer limits", async () => {
    const shopApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000),
    });
    const offers = await shopApp.inject({ method: "GET", url: "/v1/shop/offers" });
    const key = randomUUID();
    const request = { method: "POST" as const, url: "/v1/shop/offers/daily-fortune/purchase",
      headers: { authorization: "Bearer valid", "idempotency-key": key } };
    const first = await shopApp.inject(request);
    const replay = await shopApp.inject(request);
    const limited = await shopApp.inject({ ...request, headers: { ...request.headers, "idempotency-key": randomUUID() } });
    expect(offers.json().offers).toHaveLength(4);
    expect(first.json()).toMatchObject({ coins: 200_000, gemsSpent: 20, coinBalance: 201_000, gemBalance: 300 });
    expect(replay.json()).toEqual(first.json());
    expect(limited.statusCode).toBe(409);
    expect(limited.json().code).toBe("SHOP_OFFER_LIMIT_REACHED");
    await shopApp.close();
  });
  it("persists authenticated friend requests and clan membership", async () => {
    const socialStore = new InMemorySocialStore(playerId);
    const socialApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
      socialStore,
    });
    const overview = await socialApp.inject({ method: "GET", url: "/v1/social/overview", headers: { authorization: "Bearer valid" } });
    const suggestion = overview.json().suggestions[0] as { id: string };
    const request = await socialApp.inject({
      method: "POST", url: "/v1/social/friend-requests", headers: { authorization: "Bearer valid" }, payload: { playerId: suggestion.id },
    });
    const duplicate = await socialApp.inject({
      method: "POST", url: "/v1/social/friend-requests", headers: { authorization: "Bearer valid" }, payload: { playerId: suggestion.id },
    });
    const clanId = (overview.json().discoverClans[0] as { id: string }).id;
    const joined = await socialApp.inject({ method: "POST", url: `/v1/clans/${clanId}/join`, headers: { authorization: "Bearer valid" } });
    const persisted = await socialApp.inject({ method: "GET", url: "/v1/social/overview", headers: { authorization: "Bearer valid" } });
    expect(overview.statusCode).toBe(200);
    expect(request.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(joined.statusCode).toBe(200);
    expect(persisted.json().currentClan.id).toBe(clanId);
    await socialApp.close();
  });
  it("provisions the social projection for a newly authenticated guest", async () => {
    const newGuestId = randomUUID();
    const socialStore = new InMemorySocialStore(playerId);
    const socialApp = buildApp({
      authenticator: { authenticate: async () => newGuestId },
      spinStore: new InMemorySpinStore(1_000),
      socialStore,
    });
    const overview = await socialApp.inject({
      method: "GET", url: "/v1/social/overview", headers: { authorization: "Bearer valid" },
    });
    const clanId = (overview.json().discoverClans[0] as { id: string }).id;
    const joined = await socialApp.inject({
      method: "POST", url: `/v1/clans/${clanId}/join`, headers: { authorization: "Bearer valid" },
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().player).toMatchObject({ id: newGuestId, level: 12, online: true });
    expect(overview.json().suggestions.length).toBeGreaterThan(0);
    expect(joined.statusCode).toBe(200);
    await socialApp.close();
  });
  it("accepts only friend requests addressed to the authenticated player", async () => {
    const socialStore = new InMemorySocialStore(playerId);
    const senderId = "00000000-0000-4000-8000-000000000101";
    const pending = await socialStore.sendFriendRequest(senderId, playerId);
    const socialApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000), socialStore,
    });
    const accepted = await socialApp.inject({
      method: "POST", url: `/v1/social/friend-requests/${pending.id}/accept`, headers: { authorization: "Bearer valid" },
    });
    const overview = await socialApp.inject({ method: "GET", url: "/v1/social/overview", headers: { authorization: "Bearer valid" } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().friend.displayName).toBe("LuckyLuna");
    expect(overview.json().friends).toHaveLength(1);
    await socialApp.close();
  });
  it("enforces clan invitation roles and exposes a moderated paginated feed", async () => {
    const socialStore = new InMemorySocialStore(playerId);
    const memberId = "00000000-0000-4000-8000-000000000102";
    const ownerApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000), socialStore,
    });
    const memberApp = buildApp({
      authenticator: { authenticate: async () => memberId }, spinStore: new InMemorySpinStore(1_000), socialStore,
    });
    expect((await ownerApp.inject({
      method: "POST", url: "/v1/clans", headers: { authorization: "Bearer valid" }, payload: { name: "Feed Testers", tag: "FEED" },
    })).statusCode).toBe(201);
    const invitation = await ownerApp.inject({
      method: "POST", url: "/v1/clans/invitations", headers: { authorization: "Bearer valid" }, payload: { playerId: memberId },
    });
    expect(invitation.statusCode).toBe(201);
    expect((await ownerApp.inject({
      method: "POST", url: "/v1/clans/invitations", headers: { authorization: "Bearer valid" }, payload: { playerId: memberId },
    })).statusCode).toBe(409);
    expect((await memberApp.inject({
      method: "GET", url: "/v1/social/overview", headers: { authorization: "Bearer valid" },
    })).json().incomingClanInvitations).toHaveLength(1);
    expect((await memberApp.inject({
      method: "POST", url: `/v1/clans/invitations/${invitation.json().invitation.id}/accept`, headers: { authorization: "Bearer valid" },
    })).statusCode).toBe(200);

    const ownerMessage = await ownerApp.inject({
      method: "POST", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" }, payload: { body: "Welcome aboard" },
    });
    const memberMessage = await memberApp.inject({
      method: "POST", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" }, payload: { body: "Ready to spin" },
    });
    const firstPage = await memberApp.inject({
      method: "GET", url: "/v1/clans/feed?limit=1", headers: { authorization: "Bearer valid" },
    });
    const nextPage = await memberApp.inject({
      method: "GET", url: `/v1/clans/feed?limit=1&cursor=${encodeURIComponent(firstPage.json().nextCursor)}`, headers: { authorization: "Bearer valid" },
    });
    expect(firstPage.json().messages).toHaveLength(1);
    expect(nextPage.json().messages).toHaveLength(1);
    expect((await memberApp.inject({
      method: "DELETE", url: `/v1/clans/feed/${ownerMessage.json().message.id}`, headers: { authorization: "Bearer valid" },
    })).statusCode).toBe(403);
    expect((await ownerApp.inject({
      method: "DELETE", url: `/v1/clans/feed/${memberMessage.json().message.id}`, headers: { authorization: "Bearer valid" },
    })).statusCode).toBe(204);
    const moderated = await ownerApp.inject({ method: "GET", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" } });
    expect(moderated.json().messages.find((message: { id: string }) => message.id === memberMessage.json().message.id)
      .body).toBeNull();
    expect((await ownerApp.inject({
      method: "POST", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" }, payload: { body: "bad\nmessage" },
    })).statusCode).toBe(400);
    expect((await ownerApp.inject({
      method: "GET", url: "/v1/clans/feed?cursor=bm90LWEtY3Vyc29y", headers: { authorization: "Bearer valid" },
    })).statusCode).toBe(400);
    for (let index = 0; index < 4; index++) {
      expect((await ownerApp.inject({
        method: "POST", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" }, payload: { body: `Update ${index + 1}` },
      })).statusCode).toBe(201);
    }
    expect((await ownerApp.inject({
      method: "POST", url: "/v1/clans/feed", headers: { authorization: "Bearer valid" }, payload: { body: "One too many" },
    })).statusCode).toBe(429);
    await Promise.all([ownerApp.close(), memberApp.close()]);
  });
  it("publishes targeted LiveOps campaigns through separate editor and publisher identities", async () => {
    const liveOpsStore = new InMemoryLiveOpsStore(false);
    const liveOpsApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000),
      liveOpsStore, adminAuthenticator: new DemoAdminAuthenticator(),
    });
    const now = Date.now();
    const created = await liveOpsApp.inject({
      method: "POST", url: "/admin/v1/liveops/campaigns", headers: { authorization: "Bearer local-admin-editor" },
      payload: { name: "Launch week", startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 86_400_000).toISOString(),
        audience: { minLevel: 1, minVipPoints: 0 }, creative: { title: "LAUNCH WEEK", subtitle: "Seven days of rewards", ctaLabel: "PLAY" } },
    });
    const forbidden = await liveOpsApp.inject({ method: "POST", url: `/admin/v1/liveops/campaigns/${created.json().id}/publish`,
      headers: { authorization: "Bearer local-admin-editor" } });
    const before = await liveOpsApp.inject({ method: "GET", url: "/v1/liveops", headers: { authorization: "Bearer valid" } });
    const published = await liveOpsApp.inject({ method: "POST", url: `/admin/v1/liveops/campaigns/${created.json().id}/publish`,
      headers: { authorization: "Bearer local-admin-publisher" } });
    const after = await liveOpsApp.inject({ method: "GET", url: "/v1/liveops", headers: { authorization: "Bearer valid" } });
    const audit = await liveOpsApp.inject({ method: "GET", url: "/admin/v1/audit", headers: { authorization: "Bearer local-admin-publisher" } });
    expect(created.statusCode).toBe(201);
    expect(forbidden.statusCode).toBe(403);
    expect(before.json().campaigns).toHaveLength(0);
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ status: "published", createdBy: "demo-editor", publishedBy: "demo-publisher" });
    expect(after.json().campaigns[0].creative.title).toBe("LAUNCH WEEK");
    expect(audit.json().entries.map((entry: { action: string }) => entry.action)).toEqual(["campaign.published", "campaign.created"]);
    await liveOpsApp.close();
  });
  it("publishes daily, three-day, unlockable, and weekly mission tracks", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/missions", headers: { authorization: "Bearer valid" } });
    expect(response.statusCode).toBe(200);
    const missions = response.json().missions as Array<{ id: string; cadence: string; tier: string; periodKey: string }>;
    expect(missions.find((mission) => mission.id === "daily-spins-10")).toMatchObject({ cadence: "daily", tier: "standard" });
    expect(missions.find((mission) => mission.id === "pro-spins-40")).toMatchObject({ cadence: "three_day", tier: "pro" });
    expect(missions.find((mission) => mission.id === "super-free-spins-3")).toMatchObject({ unlocked: false, unlockTarget: 3 });
    expect(missions.find((mission) => mission.id === "weekly-bar-7")).toMatchObject({ cadence: "weekly", tier: "crazy" });
    expect(missions.find((mission) => mission.id === "weekly-bar-7")?.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("tracks live-event milestones and credits each reward exactly once", async () => {
    const eventApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000_000),
    });
    for (let index = 0; index < 10; index += 1) {
      const spin = await eventApp.inject({
        method: "POST", url: "/v1/slots/classic-3x3/spins",
        headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" }, payload: { bet: 10 },
      });
      expect(spin.statusCode).toBe(200);
    }
    const status = await eventApp.inject({ method: "GET", url: "/v1/events", headers: { authorization: "Bearer valid" } });
    const sprint = status.json().events.find((event: { id: string }) => event.id === "spin-sprint");
    expect(sprint).toMatchObject({ cadence: "daily", progress: 10 });
    expect(sprint.milestones[0]).toMatchObject({ id: "starter", completed: true, claimed: false, rewardCoins: 75_000 });
    const first = await eventApp.inject({ method: "POST", url: "/v1/events/spin-sprint/milestones/starter/claim", headers: { authorization: "Bearer valid" } });
    const second = await eventApp.inject({ method: "POST", url: "/v1/events/spin-sprint/milestones/starter/claim", headers: { authorization: "Bearer valid" } });
    expect(first.statusCode).toBe(200);
    expect(first.json().coins).toBe(75_000);
    expect(second.statusCode).toBe(409);
    await eventApp.close();
  });
  it("publishes the immutable math and paytable used by the engine", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/slots/dragon-peak/paytable" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "dragon-peak", version: 3, lines: 20, targetRtp: 0.94, volatility: "high",
      maxWinMultiplier: 5_000, mathModelVersion: "3.0.0",
      evaluation: { type: "lines", lines: 20 },
    });
    expect(response.json().bet.steps).toEqual([100, 200, 500, 1_000, 2_000, 5_000, 10_000]);
    expect(response.json().symbols.W.kind).toBe("wild");
    expect(response.json().symbols.A.payouts[5]).toBeGreaterThan(0);
    const ways = await app.inject({ method: "GET", url: "/v1/slots/candy-carnival/paytable" });
    expect(ways.json()).toMatchObject({
      version: 5,
      mathModelVersion: "5.0.0",
      volatility: "very_high",
      evaluation: {
        type: "ways", minimumReels: 3, betDivisor: 165,
        ways: 3_125, minimumWays: 32, maximumWays: 3_125, variable: true,
      },
    });
    const vegas = await app.inject({ method: "GET", url: "/v1/slots/vegas-gold/paytable" });
    expect(vegas.json()).toMatchObject({ version: 3, mathModelVersion: "3.0.0" });
    const pirate = await app.inject({ method: "GET", url: "/v1/slots/pirate-bay/paytable" });
    expect(pirate.json()).toMatchObject({
      version: 4,
      mathModelVersion: "4.0.0",
      symbols: { C: { kind: "coin", payouts: {} } },
    });
    const jungle = await app.inject({ method: "GET", url: "/v1/slots/jungle-temple/paytable" });
    expect(jungle.json()).toMatchObject({ version: 4, mathModelVersion: "4.0.0", volatility: "high" });
    const frozen = await app.inject({ method: "GET", url: "/v1/slots/frozen-kingdom/paytable" });
    expect(frozen.json()).toMatchObject({ version: 4, mathModelVersion: "4.0.0", volatility: "very_high" });
    const neon = await app.inject({ method: "GET", url: "/v1/slots/neon-nights/paytable" });
    expect(neon.json()).toMatchObject({
      version: 3, mathModelVersion: "3.0.0", highRollerExclusive: true,
      symbols: { M: { kind: "multiplier", payouts: {} } },
    });
    const pharaoh = await app.inject({ method: "GET", url: "/v1/slots/pharaoh-oasis/paytable" });
    expect(pharaoh.json()).toMatchObject({
      version: 3, mathModelVersion: "3.0.0",
      symbols: { R: { kind: "mystery", payouts: {} } },
    });
  });
  it("charges the configured play-money price and guarantees a purchased bonus", async () => {
    const bonusApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(10_000),
    });
    const response = await bonusApp.inject({
      method: "POST",
      url: "/v1/slots/jungle-temple/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" },
      payload: { bet: 100, bonusBuy: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().spin).toMatchObject({ baseBet: 100, wager: 5_000, bonusBuy: true });
    expect(response.json().spin.rounds.some((round: { phase: string }) => round.phase === "bonus")).toBe(true);
    expect(response.json().coinBalance).toBe(10_000 - 5_000 + response.json().spin.totalWin);
    await bonusApp.close();
  });
  it("rejects bonus buy for games without a configured bonus", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/slots/classic-3x3/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" },
      payload: { bet: 1, bonusBuy: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "BONUS_BUY_NOT_AVAILABLE" });
  });
  it("rejects a stake outside the published slot bet steps", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/slots/pharaoh-oasis/spins",
      headers: { "idempotency-key": randomUUID(), authorization: "Bearer valid" },
      payload: { bet: 150 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_BET" });
  });
  it("returns immutable wallet transactions without duplicating replayed settlement", async () => {
    const walletApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
    });
    const key = randomUUID();
    const command = {
      method: "POST" as const,
      url: "/v1/slots/classic-3x3/spins",
      headers: { "idempotency-key": key, authorization: "Bearer valid" },
      payload: { bet: 10 },
    };
    await walletApp.inject(command);
    await walletApp.inject(command);
    const wallet = await walletApp.inject({
      method: "GET", url: "/v1/wallet", headers: { authorization: "Bearer valid" },
    });
    const history = await walletApp.inject({
      method: "GET", url: "/v1/wallet/transactions?limit=100", headers: { authorization: "Bearer valid" },
    });
    expect(wallet.statusCode).toBe(200);
    expect(history.statusCode).toBe(200);
    const balances = new Map(
      (wallet.json().balances as Array<{ currency: string; balance: number }>)
        .map((entry) => [entry.currency, entry.balance]),
    );
    expect(balances.size).toBe(14);
    expect(balances.get("coin")).toBeTypeOf("number");
    expect(balances.get("gem")).toBe(320);
    expect(balances.get("vip_point")).toBeGreaterThan(0);
    expect(balances.get("loyalty_point")).toBe(1);
    expect(balances.get("mission_point")).toBe(1);
    expect(balances.get("booster")).toBe(0);
    const transactions = history.json().transactions as Array<{ currency: string; amount: number; balanceBefore: number; balanceAfter: number }>;
    expect(transactions.filter((entry) => entry.amount === -10)).toHaveLength(1);
    expect(transactions.filter((entry) => entry.currency === "loyalty_point")).toHaveLength(1);
    expect(transactions.every((entry) => entry.balanceAfter === entry.balanceBefore + entry.amount)).toBe(true);
    await walletApp.close();
  });
  it("rejects invalid wallet history limits", async () => {
    const response = await app.inject({
      method: "GET", url: "/v1/wallet/transactions?limit=1000", headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("INVALID_REQUEST");
  });
  it("publishes Check-&-Win status and rejects unsafe or premature claims", async () => {
    const checkWinApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
    });
    const status = await checkWinApp.inject({
      method: "GET", url: "/v1/economy/check-win", headers: { authorization: "Bearer valid" },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ marks: 0, requiredMarks: 5, claimable: false,
      rewardCoins: 100_000, rewardStamps: 1 });
    const unsafe = await checkWinApp.inject({
      method: "POST", url: "/v1/economy/check-win/claim", headers: { authorization: "Bearer valid" },
    });
    expect(unsafe.statusCode).toBe(400);
    expect(unsafe.json().code).toBe("INVALID_IDEMPOTENCY_KEY");
    const premature = await checkWinApp.inject({
      method: "POST", url: "/v1/economy/check-win/claim",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(premature.statusCode).toBe(409);
    expect(premature.json().code).toBe("CHECK_WIN_NOT_CLAIMABLE");
    await checkWinApp.close();
  });
  it("publishes booster terms and rejects crafting or activation without inventory", async () => {
    const boosterApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
    });
    const status = await boosterApp.inject({
      method: "GET", url: "/v1/economy/boosters", headers: { authorization: "Bearer valid" },
    });
    expect(status.json()).toEqual({ stamps: 0, stampsPerBooster: 3, boosters: 0, activeSpins: 0,
      boostedSpinsPerToken: 20, xpMultiplier: 2, maxActiveSpins: 200,
      canCraft: false, canActivate: false });
    const craft = await boosterApp.inject({
      method: "POST", url: "/v1/economy/boosters/craft",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(craft.statusCode).toBe(409);
    expect(craft.json().code).toBe("BOOSTER_NOT_CRAFTABLE");
    const activate = await boosterApp.inject({
      method: "POST", url: "/v1/economy/boosters/activate",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(activate.statusCode).toBe(409);
    expect(activate.json().code).toBe("BOOSTER_NOT_AVAILABLE");
    await boosterApp.close();
  });
  it("publishes loyalty terms and rejects invalid or unaffordable exchanges", async () => {
    const loyaltyApp = buildApp({
      authenticator: { authenticate: async () => playerId },
      spinStore: new InMemorySpinStore(1_000),
    });
    const status = await loyaltyApp.inject({
      method: "GET", url: "/v1/economy/loyalty-rewards", headers: { authorization: "Bearer valid" },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ version: 1, loyaltyPoints: 0 });
    expect(status.json().offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "coin-cache", costLoyaltyPoints: 100, rewardCurrency: "coin",
        rewardAmount: 100_000, canRedeem: false }),
    ]));
    const missing = await loyaltyApp.inject({
      method: "POST", url: "/v1/economy/loyalty-rewards/not-real/redeem",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ code: "LOYALTY_REWARD_NOT_FOUND" });
    const unaffordable = await loyaltyApp.inject({
      method: "POST", url: "/v1/economy/loyalty-rewards/coin-cache/redeem",
      headers: { authorization: "Bearer valid", "idempotency-key": randomUUID() },
    });
    expect(unaffordable.statusCode).toBe(409);
    expect(unaffordable.json()).toEqual({ code: "INSUFFICIENT_LOYALTY_POINTS" });
    await loyaltyApp.close();
  });
  it("uses server time and rejects a second timed daily reward", async () => {
    const timedApp = buildApp({
      authenticator: { authenticate: async () => playerId }, spinStore: new InMemorySpinStore(1_000),
    });
    const status = await timedApp.inject({ method: "GET", url: "/v1/rewards/daily", headers: { authorization: "Bearer valid" } });
    const first = await timedApp.inject({ method: "POST", url: "/v1/rewards/daily/claim", headers: { authorization: "Bearer valid" } });
    const second = await timedApp.inject({ method: "POST", url: "/v1/rewards/daily/claim", headers: { authorization: "Bearer valid" } });
    expect(status.json().claimable).toBe(true);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ coins: 100_000, streak: 1, cyclePosition: 1 });
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("REWARD_NOT_AVAILABLE");
    await timedApp.close();
  });
});
