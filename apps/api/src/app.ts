import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { z } from "zod";
import { SlotEngine, auroraConfig, classicConfig, themedConfigs, type SlotConfig } from "@aurora/slot-engine";
import type { Authenticator } from "./auth.js";
import type { IdentityService } from "./identity/identity-service.js";
import type { SpinStore } from "./spins/spin-store.js";
import { EventMilestoneNotClaimableError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, WheelNotAvailableError } from "./spins/spin-store.js";
import { FixedWindowRateLimiter } from "./security/fixed-window-rate-limiter.js";
import { standardWheel } from "./rewards/bonus-wheel.js";
import { activeShopOffers } from "./shop/shop-catalog.js";
import type { SocialStore } from "./social/social-store.js";
import { ClanInvitationNotFoundError, ClanMemberNotFoundError, ClanMembershipError, ClanMessageNotFoundError, ClanMessageRateLimitError, ClanMessageReportConflictError, ClanNotFoundError, ClanOfficerLimitError, ClanPermissionError, FriendRequestNotFoundError, ModerationCaseNotFoundError, ModerationCaseStateError, SocialConflictError, SocialPlayerNotFoundError } from "./social/social-store.js";
import type { AdminAuthenticator, AdminRole } from "./admin/admin-auth.js";
import type { LiveOpsStore } from "./liveops/liveops-store.js";
import { CampaignNotFoundError, CampaignStateError, FourEyesViolationError } from "./liveops/liveops-store.js";
import type { AnalyticsStore, ClientAnalyticsEvent } from "./analytics/analytics-store.js";
import { analyticsEventNames } from "./analytics/analytics-store.js";
import type { OperationalMetrics } from "./observability/operational-metrics.js";
import type { ReadinessProbe } from "./observability/readiness.js";
import type { MessagingStore } from "./messaging/messaging-store.js";
import { PushCampaignNotPublishableError } from "./messaging/messaging-store.js";
import type { PushDeliveryWorker } from "./messaging/push-delivery-worker.js";
import type { MonetizationService } from "./monetization/monetization-service.js";
import { ReceiptGatewayUnavailableError, ReceiptInvalidError, ReceiptPendingError } from "./monetization/receipt-verifier.js";
import { StoreProductLimitReachedError, StorePurchaseDebtError, StorePurchaseRevokedError, StoreTransactionConflictError } from "./spins/spin-store.js";

const spinBody = z.object({
  bet: z.number().int().min(1).max(1_000_000),
  bonusBuy: z.boolean().optional().default(false),
});
const idempotencyKey = z.string().uuid();
const walletTransactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const guestAuthBody = z.object({
  installationId: z.string().uuid(),
  platform: z.enum(["ios", "android", "web"]),
});
const refreshAuthBody = z.object({ refreshToken: z.string().min(32).max(512) });
const friendRequestBody = z.object({ playerId: z.string().uuid() });
const clanBody = z.object({
  name: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9 _-]+$/),
  tag: z.string().trim().min(3).max(8).regex(/^[A-Za-z0-9]+$/),
});
const clanInvitationBody = z.object({ playerId: z.string().uuid() }).strict();
const clanMemberRoleBody = z.object({ role: z.enum(["officer", "member"]) }).strict();
const clanOwnershipTransferBody = z.object({ playerId: z.string().uuid() }).strict();
const clanMessageBody = z.object({
  body: z.string().trim().min(1).max(280).refine((value) => !/[\u0000-\u001F\u007F]/u.test(value), "Control characters are not allowed"),
}).strict();
const clanFeedQuery = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
const clanMessageReportBody = z.object({
  reason: z.enum(["spam", "harassment", "hate", "sexual", "personal_data", "other"]),
  details: z.string().trim().min(3).max(500).refine((value) => !/[\u0000-\u001F\u007F]/u.test(value), "Control characters are not allowed").nullable().optional().default(null),
}).strict();
const campaignBody = z.object({
  name: z.string().trim().min(3).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  audience: z.object({ minLevel: z.number().int().min(1).max(10_000), minVipPoints: z.number().int().min(0).max(1_000_000_000) }),
  creative: z.object({
    title: z.string().trim().min(3).max(60), subtitle: z.string().trim().min(3).max(140), ctaLabel: z.string().trim().min(2).max(24),
  }),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { message: "endsAt must be after startsAt" });
const adminAuditQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) });
const moderationCasesQuery = z.object({
  status: z.enum(["open", "actioned", "dismissed"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const moderationResolutionBody = z.object({
  decision: z.enum(["remove_message", "dismiss"]),
  note: z.string().trim().min(3).max(500).refine((value) => !/[\u0000-\u001F\u007F]/u.test(value), "Control characters are not allowed"),
}).strict();
const analyticsBatchBody = z.object({ events: z.array(z.object({
  eventId: z.string().uuid(), name: z.enum(analyticsEventNames), occurredAt: z.string().datetime(),
  platform: z.enum(["ios", "android", "web"]), appVersion: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._+-]+$/),
  screen: z.string().trim().min(1).max(64).regex(/^[a-z0-9._-]+$/).optional(),
  slotId: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(), campaignId: z.string().uuid().optional(),
}).strict()).min(1).max(50) }).strict();
const pushPreferencesBody = z.object({
  enabled: z.boolean(), marketing: z.boolean(), rewards: z.boolean(), social: z.boolean(),
  quietHoursStartMinutes: z.number().int().min(0).max(1439).nullable(),
  quietHoursEndMinutes: z.number().int().min(0).max(1439).nullable(),
  timeZone: z.string().min(1).max(64).regex(/^[A-Za-z0-9_+/-]+$/).refine(isValidTimeZone, "Invalid IANA time zone"),
}).strict().refine((value) => (value.quietHoursStartMinutes === null) === (value.quietHoursEndMinutes === null), {
  message: "Quiet-hour boundaries must both be set or both be null",
}).refine((value) => value.quietHoursStartMinutes === null || value.quietHoursStartMinutes !== value.quietHoursEndMinutes, {
  message: "Quiet-hour boundaries must differ",
});
const pushInstallationBody = z.object({
  installationId: z.string().uuid(), platform: z.enum(["ios", "android", "web"]),
  provider: z.enum(["apns", "fcm", "web_push"]), token: z.string().min(16).max(4096),
}).strict().refine((value) => value.provider === "fcm" || (value.provider === "apns" && value.platform === "ios")
  || (value.provider === "web_push" && value.platform === "web"), { message: "Provider is incompatible with platform" });
const storePlatform = z.enum(["ios", "android"]);
const storePurchaseBody = z.object({
  platform: storePlatform, storeProductId: z.string().min(1).max(200), transactionId: z.string().min(1).max(256),
  verificationToken: z.string().min(1).max(16_384),
}).strict();
const storeRefundBody = z.object({
  eventId: z.string().uuid(), platform: storePlatform, transactionId: z.string().min(1).max(256),
  occurredAt: z.string().datetime(), providerPayloadHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
const rewardAmounts = new Map([
  ["daily", 250_000],
  ["spin-10", 100_000],
  ["win-50000", 150_000],
  ["free-3", 300_000],
  ["achievement-first-spin", 75_000],
  ["achievement-collector", 250_000],
  ["achievement-high-roller", 500_000],
]);
const rewardRequirements = new Map<string, (progression: Awaited<ReturnType<SpinStore["getProfile"]>>["progression"]) => boolean>([
  ["spin-10", (value) => value.spins >= 10],
  ["win-50000", (value) => value.totalWon >= 50_000],
  ["free-3", (value) => value.freeSpins >= 3],
  ["achievement-first-spin", (value) => value.spins >= 1],
  ["achievement-collector", (value) => value.totalWon >= 250_000],
  ["achievement-high-roller", (value) => value.spins >= 100],
]);

export interface AppDependencies {
  readonly authenticator: Authenticator;
  readonly spinStore: SpinStore;
  readonly identityService?: IdentityService;
  readonly socialStore?: SocialStore;
  readonly adminAuthenticator?: AdminAuthenticator;
  readonly liveOpsStore?: LiveOpsStore;
  readonly analyticsStore?: AnalyticsStore;
  readonly metrics?: OperationalMetrics;
  readonly metricsToken?: string;
  readonly readiness?: ReadinessProbe;
  readonly messagingStore?: MessagingStore;
  readonly pushWorker?: PushDeliveryWorker;
  readonly monetizationService?: MonetizationService;
  readonly storeWebhookToken?: string;
}

/** Builds the HTTP composition root with explicit, replaceable infrastructure ports. */
export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.headers.cookie"] } });
  void app.register(cors, {
    origin: process.env.DEMO_MODE === "true" ? true : false,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "idempotency-key"],
    exposedHeaders: ["x-request-id"],
  });
  const authRateLimiter = new FixedWindowRateLimiter();
  const requestStarted = new WeakMap<object, bigint>();
  app.addHook("onRequest", async (request, reply) => {
    requestStarted.set(request, process.hrtime.bigint());
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("content-security-policy", "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:");
    if (request.url.startsWith("/v1/auth/")) {
      reply.header("cache-control", "no-store");
      const guest = request.url.startsWith("/v1/auth/guest");
      const rate = authRateLimiter.consume(`${request.ip}:${guest ? "guest" : "auth"}`, guest ? 5 : 30, 60_000);
      reply.header("x-ratelimit-remaining", rate.remaining);
      if (!rate.allowed) {
        return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
      }
    }
    if (request.url === "/admin" || request.url.startsWith("/admin/")) {
      reply.header("cache-control", "no-store");
      reply.header("content-security-policy", "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'");
    }
    if (request.url.startsWith("/admin/v1/")) {
      const rate = authRateLimiter.consume(`admin:${request.ip}`, 120, 60_000);
      reply.header("x-ratelimit-remaining", rate.remaining);
      if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    }
  });
  app.addHook("onResponse", async (request, reply) => {
    if (!dependencies.metrics || request.url.startsWith("/internal/metrics")) return;
    const started = requestStarted.get(request);
    const seconds = started ? Number(process.hrtime.bigint() - started) / 1_000_000_000 : 0;
    dependencies.metrics.observeHttp(request.method, request.routeOptions.url ?? "unmatched", reply.statusCode, seconds);
  });
  const configs = new Map<string, SlotConfig>([classicConfig, auroraConfig, ...themedConfigs].map((config) => [config.id, config]));

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    if (!dependencies.readiness) return reply.code(503).send({ status: "not_ready", checks: { configuration: "down" } });
    const result = await dependencies.readiness.check();
    return reply.code(result.ready ? 200 : 503).send({ status: result.ready ? "ready" : "not_ready", checks: result.checks });
  });
  app.get("/internal/metrics", async (request, reply) => {
    if (!dependencies.metrics || !dependencies.metricsToken || !secureBearerMatch(request.headers.authorization, dependencies.metricsToken)) {
      return reply.code(404).send({ code: "NOT_FOUND" });
    }
    return reply.header("content-type", dependencies.metrics.contentType).send(await dependencies.metrics.render());
  });
  app.post("/internal/v1/store/refunds", async (request, reply) => {
    if (!dependencies.monetizationService || !dependencies.storeWebhookToken
      || !secureBearerMatch(request.headers.authorization, dependencies.storeWebhookToken)) {
      return reply.code(404).send({ code: "NOT_FOUND" });
    }
    const body = storeRefundBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    const accepted = await dependencies.monetizationService.processRefund({
      ...body.data, occurredAt: new Date(body.data.occurredAt),
    });
    return reply.code(202).send({ accepted });
  });
  app.post("/v1/auth/guest", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const body = guestAuthBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    return reply.code(201).send(
      await dependencies.identityService.createGuest(body.data.installationId, body.data.platform),
    );
  });
  app.post("/v1/auth/refresh", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const body = refreshAuthBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    const tokens = await dependencies.identityService.refresh(body.data.refreshToken);
    return tokens ?? reply.code(401).send({ code: "INVALID_REFRESH_TOKEN" });
  });
  app.post("/v1/auth/logout", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const body = refreshAuthBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    await dependencies.identityService.logout(body.data.refreshToken);
    return reply.code(204).send();
  });
  app.get("/v1/auth/sessions", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return { sessions: await dependencies.identityService.listSessions(playerId) };
  });
  app.delete("/v1/auth/sessions/:sessionId", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const parsed = z.string().uuid().safeParse((request.params as { sessionId: string }).sessionId);
    if (!parsed.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    const revoked = await dependencies.identityService.revokeSession(playerId, parsed.data);
    return revoked ? reply.code(204).send() : reply.code(404).send({ code: "SESSION_NOT_FOUND" });
  });
  app.post("/v1/auth/logout-all", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return { revokedSessions: await dependencies.identityService.logoutAll(playerId) };
  });
  app.get("/v1/lobby", async () => ({
    games: [...configs.values()].map((config) => ({
      id: config.id,
      name: config.name,
      reels: config.reels.length,
      rows: config.rows,
      bonusBuyMultiplier: config.features?.bonusBuy?.costMultiplier ?? null,
    })),
  }));
  app.get("/v1/slots/:slotId/paytable", async (request, reply) => {
    const { slotId } = request.params as { slotId: string };
    const config = configs.get(slotId);
    if (!config) return reply.code(404).send({ code: "SLOT_NOT_FOUND" });
    return {
      id: config.id,
      name: config.name,
      version: config.version,
      lines: config.paylines.length,
      targetRtp: config.math.targetRtp,
      volatility: config.math.volatility,
      expectedHitFrequency: config.math.expectedHitFrequency,
      maxWinMultiplier: config.math.maxWinMultiplier,
      mathModelVersion: config.math.mathModelVersion,
      bet: config.bet ?? null,
      winClasses: config.winClasses ?? [],
      symbols: Object.fromEntries(Object.entries(config.symbols).map(([symbol, definition]) => [
        symbol,
        { kind: definition.kind, payouts: definition.payouts },
      ])),
    };
  });
  app.get("/v1/profile", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const profile = await dependencies.spinStore.getProfile(playerId);
    const tournament = await dependencies.spinStore.getActiveTournament(playerId, new Date());
    const { progression } = profile;
    const vip = vipStatus(progression.vipPoints);
    const claimed = new Set(profile.claimedRewards);
    return {
      playerId,
      ...profile,
      vip,
      achievements: [
        achievement("FIRST SPIN", "Starte deine Casino-Reise", "achievement-first-spin", progression.spins, 1, 75_000, claimed),
        achievement("COIN COLLECTOR", "Gewinne insgesamt 250.000 Coins", "achievement-collector", progression.totalWon, 250_000, 250_000, claimed),
        achievement("HIGH ROLLER", "Spiele 100 Spins", "achievement-high-roller", progression.spins, 100, 500_000, claimed),
      ],
      tournament,
    };
  });
  app.get("/v1/tournaments/active", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return dependencies.spinStore.getActiveTournament(playerId, new Date());
  });
  app.get("/v1/jackpots", async () => ({ jackpots: await dependencies.spinStore.getJackpots() }));
  app.get("/v1/shop/offers", async () => ({ offers: activeShopOffers(new Date()) }));
  app.get("/v1/store/products", async (request, reply) => {
    if (!dependencies.monetizationService) return reply.code(503).send({ code: "STORE_UNAVAILABLE" });
    const platform = storePlatform.safeParse((request.query as { platform?: string }).platform);
    if (!platform.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    return { products: dependencies.monetizationService.catalog(platform.data) };
  });
  app.post("/v1/store/purchases/verify", async (request, reply) => {
    if (!dependencies.monetizationService) return reply.code(503).send({ code: "STORE_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const rate = authRateLimiter.consume(`store-purchase:${playerId}`, 20, 60_000);
    if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    const body = storePurchaseBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    try { return await dependencies.monetizationService.verifyAndGrant(playerId, body.data); }
    catch (error) {
      if (error instanceof ReceiptInvalidError) return reply.code(422).send({ code: "PURCHASE_INVALID" });
      if (error instanceof ReceiptPendingError) return reply.code(409).send({ code: "PURCHASE_PENDING" });
      if (error instanceof ReceiptGatewayUnavailableError) return reply.code(503).send({ code: "STORE_VERIFICATION_UNAVAILABLE" });
      if (error instanceof StoreTransactionConflictError) return reply.code(409).send({ code: "TRANSACTION_CONFLICT" });
      if (error instanceof StoreProductLimitReachedError) return reply.code(409).send({ code: "PRODUCT_LIMIT_REACHED" });
      if (error instanceof StorePurchaseRevokedError) return reply.code(409).send({ code: "PURCHASE_REVOKED" });
      if (error instanceof StorePurchaseDebtError) return reply.code(409).send({ code: "PURCHASE_REVIEW_REQUIRED" });
      throw error;
    }
  });
  app.post("/v1/analytics/events", async (request, reply) => {
    if (!dependencies.analyticsStore) return reply.code(503).send({ code: "ANALYTICS_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const rate = authRateLimiter.consume(`analytics:${playerId}`, 60, 60_000);
    if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    const body = analyticsBatchBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    const receivedAt = new Date();
    const events: ClientAnalyticsEvent[] = body.data.events.map((event) => ({
      eventId: event.eventId, name: event.name, occurredAt: new Date(event.occurredAt),
      platform: event.platform, appVersion: event.appVersion,
      ...(event.screen === undefined ? {} : { screen: event.screen }),
      ...(event.slotId === undefined ? {} : { slotId: event.slotId }),
      ...(event.campaignId === undefined ? {} : { campaignId: event.campaignId }),
    }));
    if (events.some((event) => event.occurredAt > new Date(receivedAt.getTime() + 5 * 60_000)
      || event.occurredAt < new Date(receivedAt.getTime() - 24 * 60 * 60_000))) {
      return reply.code(400).send({ code: "EVENT_TIME_OUT_OF_RANGE" });
    }
    const result = await dependencies.analyticsStore.ingest(playerId, events, receivedAt);
    dependencies.metrics?.recordAnalytics(result.accepted, result.duplicates);
    return reply.code(202).send(result);
  });
  app.get("/v1/messaging/preferences", async (request, reply) => {
    if (!dependencies.messagingStore) return reply.code(503).send({ code: "MESSAGING_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return dependencies.messagingStore.getPreferences(playerId);
  });
  app.put("/v1/messaging/preferences", async (request, reply) => {
    if (!dependencies.messagingStore) return reply.code(503).send({ code: "MESSAGING_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = pushPreferencesBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    return dependencies.messagingStore.updatePreferences(playerId, body.data, new Date());
  });
  app.get("/v1/messaging/installations", async (request, reply) => {
    if (!dependencies.messagingStore) return reply.code(503).send({ code: "MESSAGING_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return { installations: await dependencies.messagingStore.listInstallations(playerId) };
  });
  app.put("/v1/messaging/installations/current", async (request, reply) => {
    if (!dependencies.messagingStore) return reply.code(503).send({ code: "MESSAGING_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const rate = authRateLimiter.consume(`push-installation:${playerId}`, 20, 60_000);
    if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    const body = pushInstallationBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    return dependencies.messagingStore.registerInstallation(playerId, body.data, new Date());
  });
  app.delete("/v1/messaging/installations/:installationId", async (request, reply) => {
    if (!dependencies.messagingStore) return reply.code(503).send({ code: "MESSAGING_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const installationId = z.string().uuid().safeParse((request.params as { installationId: string }).installationId);
    if (!installationId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    const removed = await dependencies.messagingStore.removeInstallation(playerId, installationId.data);
    return removed ? reply.code(204).send() : reply.code(404).send({ code: "INSTALLATION_NOT_FOUND" });
  });
  app.get("/v1/liveops", async (request, reply) => {
    if (!dependencies.liveOpsStore) return reply.code(503).send({ code: "LIVEOPS_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const profile = await dependencies.spinStore.getProfile(playerId);
    return { campaigns: await dependencies.liveOpsStore.listActive(profile.progression.level, profile.progression.vipPoints, new Date()) };
  });
  app.get("/admin/v1/liveops/campaigns", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_auditor")) return reply.code(403).send({ code: "FORBIDDEN" });
    return { campaigns: await dependencies.liveOpsStore.listCampaigns() };
  });
  app.post("/admin/v1/liveops/campaigns", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_editor")) return reply.code(403).send({ code: "FORBIDDEN" });
    const body = campaignBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    return reply.code(201).send(await dependencies.liveOpsStore.createDraft({
      ...body.data, startsAt: new Date(body.data.startsAt), endsAt: new Date(body.data.endsAt), actor: principal.subject,
    }));
  });
  app.post("/admin/v1/liveops/campaigns/:campaignId/publish", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_publisher")) return reply.code(403).send({ code: "FORBIDDEN" });
    const campaignId = z.string().uuid().safeParse((request.params as { campaignId: string }).campaignId);
    if (!campaignId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return await dependencies.liveOpsStore.publish(campaignId.data, principal.subject, new Date()); }
    catch (error) {
      if (error instanceof CampaignNotFoundError) return reply.code(404).send({ code: "CAMPAIGN_NOT_FOUND" });
      if (error instanceof CampaignStateError) return reply.code(409).send({ code: "CAMPAIGN_STATE_CONFLICT" });
      if (error instanceof FourEyesViolationError) return reply.code(409).send({ code: "FOUR_EYES_REQUIRED" });
      throw error;
    }
  });
  app.post("/admin/v1/liveops/campaigns/:campaignId/push-dispatch", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.messagingStore || !dependencies.adminAuthenticator) {
      return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    }
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_publisher")) return reply.code(403).send({ code: "FORBIDDEN" });
    const campaignId = z.string().uuid().safeParse((request.params as { campaignId: string }).campaignId);
    if (!campaignId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    const campaign = (await dependencies.liveOpsStore.listCampaigns()).find((item) => item.id === campaignId.data);
    if (!campaign) return reply.code(404).send({ code: "CAMPAIGN_NOT_FOUND" });
    try { return reply.code(202).send(await dependencies.messagingStore.queueLiveOpsCampaign(campaign, principal.subject, new Date())); }
    catch (error) {
      if (error instanceof PushCampaignNotPublishableError) return reply.code(409).send({ code: "CAMPAIGN_NOT_PUBLISHED" });
      throw error;
    }
  });
  app.get("/admin/v1/audit", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_auditor")) return reply.code(403).send({ code: "FORBIDDEN" });
    const query = adminAuditQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    return { entries: await dependencies.liveOpsStore.listAudit(query.data.limit) };
  });
  app.get("/admin/v1/moderation/cases", async (request, reply) => {
    if (!dependencies.socialStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "social_moderator")) return reply.code(403).send({ code: "FORBIDDEN" });
    const query = moderationCasesQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: query.error.issues });
    return { cases: await dependencies.socialStore.listModerationCases(query.data.status, query.data.limit) };
  });
  app.post("/admin/v1/moderation/cases/:caseId/resolve", async (request, reply) => {
    if (!dependencies.socialStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "social_moderator")) return reply.code(403).send({ code: "FORBIDDEN" });
    const caseId = z.string().uuid().safeParse((request.params as { caseId: string }).caseId);
    const body = moderationResolutionBody.safeParse(request.body);
    if (!caseId.success || !body.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { case: await dependencies.socialStore.resolveModerationCase(caseId.data, principal.subject, body.data.decision, body.data.note) }; }
    catch (error) {
      if (error instanceof ModerationCaseNotFoundError) return reply.code(404).send({ code: "MODERATION_CASE_NOT_FOUND" });
      if (error instanceof ModerationCaseStateError) return reply.code(409).send({ code: "MODERATION_CASE_ALREADY_RESOLVED" });
      throw error;
    }
  });
  app.get("/admin/v1/moderation/audit", async (request, reply) => {
    if (!dependencies.socialStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "social_moderator")) return reply.code(403).send({ code: "FORBIDDEN" });
    const query = adminAuditQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    return { entries: await dependencies.socialStore.listModerationAudit(query.data.limit) };
  });
  app.post("/v1/shop/offers/:offerId/purchase", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const keyResult = idempotencyKey.safeParse(request.headers["idempotency-key"]);
    if (!keyResult.success) return reply.code(400).send({ code: "INVALID_IDEMPOTENCY_KEY" });
    const { offerId } = request.params as { offerId: string };
    const offer = activeShopOffers(new Date()).find((item) => item.id === offerId);
    if (!offer) return reply.code(404).send({ code: "SHOP_OFFER_NOT_FOUND" });
    try {
      return await dependencies.spinStore.purchaseShopOffer(playerId, offer, keyResult.data);
    } catch (error) {
      if (error instanceof InsufficientGemsError) return reply.code(409).send({ code: "INSUFFICIENT_GEMS" });
      if (error instanceof ShopOfferLimitReachedError) return reply.code(409).send({ code: "SHOP_OFFER_LIMIT_REACHED" });
      throw error;
    }
  });
  app.get("/v1/social/overview", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return dependencies.socialStore.getOverview(playerId);
  });
  app.post("/v1/social/friend-requests", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = friendRequestBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    try { return reply.code(201).send(await dependencies.socialStore.sendFriendRequest(playerId, body.data.playerId)); }
    catch (error) {
      if (error instanceof SocialPlayerNotFoundError) return reply.code(404).send({ code: "PLAYER_NOT_FOUND" });
      if (error instanceof SocialConflictError) return reply.code(409).send({ code: "FRIEND_REQUEST_CONFLICT" });
      throw error;
    }
  });
  app.post("/v1/social/friend-requests/:requestId/accept", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const requestId = z.string().uuid().safeParse((request.params as { requestId: string }).requestId);
    if (!requestId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { friend: await dependencies.socialStore.acceptFriendRequest(playerId, requestId.data) }; }
    catch (error) {
      if (error instanceof FriendRequestNotFoundError) return reply.code(404).send({ code: "FRIEND_REQUEST_NOT_FOUND" });
      throw error;
    }
  });
  app.post("/v1/clans", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = clanBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    try { return reply.code(201).send({ clan: await dependencies.socialStore.createClan(playerId, body.data.name, body.data.tag) }); }
    catch (error) {
      if (error instanceof ClanMembershipError || error instanceof SocialConflictError) return reply.code(409).send({ code: "CLAN_CONFLICT" });
      throw error;
    }
  });
  app.post("/v1/clans/:clanId/join", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const clanId = z.string().uuid().safeParse((request.params as { clanId: string }).clanId);
    if (!clanId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { clan: await dependencies.socialStore.joinClan(playerId, clanId.data) }; }
    catch (error) {
      if (error instanceof ClanNotFoundError) return reply.code(404).send({ code: "CLAN_NOT_FOUND" });
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_CONFLICT" });
      throw error;
    }
  });
  app.post("/v1/clans/leave", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    try { await dependencies.socialStore.leaveClan(playerId); return reply.code(204).send(); }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_CONFLICT" });
      throw error;
    }
  });
  app.post("/v1/clans/invitations", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = clanInvitationBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    try { return reply.code(201).send({ invitation: await dependencies.socialStore.inviteToClan(playerId, body.data.playerId) }); }
    catch (error) {
      if (error instanceof SocialPlayerNotFoundError) return reply.code(404).send({ code: "PLAYER_NOT_FOUND" });
      if (error instanceof ClanPermissionError) return reply.code(403).send({ code: "CLAN_PERMISSION_DENIED" });
      if (error instanceof ClanMembershipError || error instanceof SocialConflictError) return reply.code(409).send({ code: "CLAN_INVITATION_CONFLICT" });
      throw error;
    }
  });
  app.post("/v1/clans/invitations/:invitationId/accept", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const invitationId = z.string().uuid().safeParse((request.params as { invitationId: string }).invitationId);
    if (!invitationId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { clan: await dependencies.socialStore.acceptClanInvitation(playerId, invitationId.data) }; }
    catch (error) {
      if (error instanceof ClanInvitationNotFoundError) return reply.code(404).send({ code: "CLAN_INVITATION_NOT_FOUND" });
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_CONFLICT" });
      throw error;
    }
  });
  app.get("/v1/clans/members", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    try { return { members: await dependencies.socialStore.listClanMembers(playerId) }; }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      throw error;
    }
  });
  app.put("/v1/clans/members/:playerId/role", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const actorId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!actorId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const targetId = z.string().uuid().safeParse((request.params as { playerId: string }).playerId);
    const body = clanMemberRoleBody.safeParse(request.body);
    if (!targetId.success || !body.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { member: await dependencies.socialStore.updateClanMemberRole(actorId, targetId.data, body.data.role) }; }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof ClanMemberNotFoundError) return reply.code(404).send({ code: "CLAN_MEMBER_NOT_FOUND" });
      if (error instanceof ClanPermissionError) return reply.code(403).send({ code: "CLAN_PERMISSION_DENIED" });
      if (error instanceof ClanOfficerLimitError) return reply.code(409).send({ code: "CLAN_OFFICER_LIMIT_REACHED" });
      throw error;
    }
  });
  app.delete("/v1/clans/members/:playerId", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const actorId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!actorId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const targetId = z.string().uuid().safeParse((request.params as { playerId: string }).playerId);
    if (!targetId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { await dependencies.socialStore.removeClanMember(actorId, targetId.data); return reply.code(204).send(); }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof ClanMemberNotFoundError) return reply.code(404).send({ code: "CLAN_MEMBER_NOT_FOUND" });
      if (error instanceof ClanPermissionError) return reply.code(403).send({ code: "CLAN_PERMISSION_DENIED" });
      throw error;
    }
  });
  app.post("/v1/clans/ownership-transfer", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const actorId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!actorId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = clanOwnershipTransferBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return { members: await dependencies.socialStore.transferClanOwnership(actorId, body.data.playerId) }; }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof ClanMemberNotFoundError) return reply.code(404).send({ code: "CLAN_MEMBER_NOT_FOUND" });
      if (error instanceof ClanPermissionError) return reply.code(403).send({ code: "CLAN_PERMISSION_DENIED" });
      throw error;
    }
  });
  app.get("/v1/clans/feed", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const query = clanFeedQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: query.error.issues });
    try { return await dependencies.socialStore.listClanFeed(playerId, query.data.cursor, query.data.limit); }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof RangeError) return reply.code(400).send({ code: "INVALID_CURSOR" });
      throw error;
    }
  });
  app.post("/v1/clans/feed", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const body = clanMessageBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    try { return reply.code(201).send({ message: await dependencies.socialStore.postClanMessage(playerId, body.data.body) }); }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof ClanMessageRateLimitError) return reply.code(429).send({ code: "CLAN_MESSAGE_RATE_LIMITED" });
      throw error;
    }
  });
  app.delete("/v1/clans/feed/:messageId", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const messageId = z.string().uuid().safeParse((request.params as { messageId: string }).messageId);
    if (!messageId.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { await dependencies.socialStore.removeClanMessage(playerId, messageId.data); return reply.code(204).send(); }
    catch (error) {
      if (error instanceof ClanMessageNotFoundError) return reply.code(404).send({ code: "CLAN_MESSAGE_NOT_FOUND" });
      if (error instanceof ClanPermissionError) return reply.code(403).send({ code: "CLAN_PERMISSION_DENIED" });
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      throw error;
    }
  });
  app.post("/v1/clans/feed/:messageId/reports", async (request, reply) => {
    if (!dependencies.socialStore) return reply.code(503).send({ code: "SOCIAL_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const messageId = z.string().uuid().safeParse((request.params as { messageId: string }).messageId);
    const body = clanMessageReportBody.safeParse(request.body);
    if (!messageId.success || !body.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return reply.code(201).send({ report: await dependencies.socialStore.reportClanMessage(playerId, messageId.data, body.data.reason, body.data.details) }); }
    catch (error) {
      if (error instanceof ClanMembershipError) return reply.code(409).send({ code: "CLAN_MEMBERSHIP_REQUIRED" });
      if (error instanceof ClanMessageNotFoundError) return reply.code(404).send({ code: "CLAN_MESSAGE_NOT_FOUND" });
      if (error instanceof ClanMessageReportConflictError) return reply.code(409).send({ code: "CLAN_MESSAGE_REPORT_CONFLICT" });
      throw error;
    }
  });
  app.delete("/v1/profile", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const deleted = await dependencies.identityService.deleteAccount(playerId);
    if (deleted) await dependencies.messagingStore?.disablePlayer(playerId, new Date());
    return deleted ? reply.code(204).send() : reply.code(404).send({ code: "ACCOUNT_NOT_FOUND" });
  });
  app.get("/v1/wallet", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const profile = await dependencies.spinStore.getProfile(playerId);
    return {
      balances: [{ currency: "coin", balance: profile.coinBalance }],
    };
  });
  app.get("/v1/wallet/transactions", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const query = walletTransactionsQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: query.error.issues });
    const transactions = await dependencies.spinStore.listWalletTransactions(playerId, query.data.limit);
    return { transactions };
  });
  for (const type of ["hourly", "daily"] as const) {
    app.get(`/v1/rewards/${type}`, async (request, reply) => {
      const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
      if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
      return dependencies.spinStore.getTimedReward(playerId, type, new Date());
    });
    app.post(`/v1/rewards/${type}/claim`, async (request, reply) => {
      const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
      if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
      try {
        return await dependencies.spinStore.claimTimedReward(playerId, type, new Date());
      } catch (error) {
        if (error instanceof RewardNotAvailableError) {
          return reply.code(409).send({ code: "REWARD_NOT_AVAILABLE", availableAt: error.availableAt.toISOString() });
        }
        throw error;
      }
    });
  }
  app.get("/v1/rewards/wheels/standard", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const status = await dependencies.spinStore.getWheelStatus(playerId, new Date());
    return { ...status, segments: standardWheel.segments };
  });
  app.post("/v1/rewards/wheels/standard/spin", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const keyResult = idempotencyKey.safeParse(request.headers["idempotency-key"]);
    if (!keyResult.success) return reply.code(400).send({ code: "INVALID_IDEMPOTENCY_KEY" });
    const randomUnit = randomBytes(4).readUInt32LE() / 0x1_0000_0000;
    try {
      return await dependencies.spinStore.spinWheel(playerId, keyResult.data, randomUnit, new Date());
    } catch (error) {
      if (error instanceof WheelNotAvailableError) return reply.code(409).send({ code: "WHEEL_NOT_AVAILABLE" });
      throw error;
    }
  });
  app.post("/v1/rewards/:rewardId/claims", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const { rewardId: requestedReward } = request.params as { rewardId: string };
    const coins = rewardAmounts.get(requestedReward);
    if (!coins) return reply.code(404).send({ code: "REWARD_NOT_FOUND" });
    const requirement = rewardRequirements.get(requestedReward);
    if (requirement) {
      const profile = await dependencies.spinStore.getProfile(playerId);
      if (!requirement(profile.progression)) {
        return reply.code(409).send({ code: "REWARD_REQUIREMENT_NOT_MET" });
      }
    }
    const rewardId = requestedReward === "daily"
      ? `daily:${new Date().toISOString().slice(0, 10)}`
      : requestedReward;
    try {
      return await dependencies.spinStore.claimReward(playerId, rewardId, coins);
    } catch (error) {
      if (error instanceof RewardAlreadyClaimedError) {
        return reply.code(409).send({ code: "REWARD_ALREADY_CLAIMED" });
      }
      throw error;
    }
  });
  app.get("/v1/missions", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return { missions: await dependencies.spinStore.getMissions(playerId, new Date()) };
  });
  app.post("/v1/missions/:missionId/claim", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const missionId = (request.params as { missionId: string }).missionId;
    if (!/^[a-z0-9-]{3,64}$/.test(missionId)) return reply.code(400).send({ code: "INVALID_REQUEST" });
    try { return await dependencies.spinStore.claimMission(playerId, missionId, new Date()); }
    catch (error) {
      if (error instanceof MissionNotClaimableError) return reply.code(409).send({ code: "MISSION_NOT_CLAIMABLE" });
      throw error;
    }
  });
  app.get("/v1/events", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    return { events: await dependencies.spinStore.getLiveEvents(playerId, new Date()) };
  });
  app.post("/v1/events/:eventId/milestones/:milestoneId/claim", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const { eventId, milestoneId } = request.params as { eventId: string; milestoneId: string };
    if (!/^[a-z0-9-]{2,64}$/.test(eventId) || !/^[a-z0-9-]{2,64}$/.test(milestoneId)) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      return await dependencies.spinStore.claimEventMilestone(playerId, eventId, milestoneId, new Date());
    } catch (error) {
      if (error instanceof EventMilestoneNotClaimableError) {
        return reply.code(409).send({ code: "EVENT_MILESTONE_NOT_CLAIMABLE" });
      }
      throw error;
    }
  });
  const webRoot = fileURLToPath(new URL("../../../apps/mobile/build/web", import.meta.url));
  const adminRoot = fileURLToPath(new URL("../../admin", import.meta.url));
  if (process.env.NODE_ENV !== "test") {
    if (existsSync(adminRoot)) {
      void app.register(staticFiles, { root: adminRoot, prefix: "/admin/", decorateReply: false, cacheControl: false });
      app.get("/admin", async (_request, reply) => reply.redirect("/admin/"));
    }
    if (existsSync(webRoot)) void app.register(staticFiles, { root: webRoot, prefix: "/" });
  }
  app.post("/v1/slots/:slotId/spins", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const keyResult = idempotencyKey.safeParse(request.headers["idempotency-key"]);
    if (!keyResult.success) return reply.code(400).send({ code: "INVALID_IDEMPOTENCY_KEY" });
    const body = spinBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "INVALID_REQUEST", issues: body.error.issues });
    const { slotId } = request.params as { slotId: string };
    const config = configs.get(slotId);
    if (!config) return reply.code(404).send({ code: "SLOT_NOT_FOUND" });
    if (config.bet && !config.bet.steps.includes(body.data.bet)) {
      return reply.code(400).send({ code: "INVALID_BET", allowedSteps: config.bet.steps });
    }
    if (body.data.bonusBuy && !config.features?.bonusBuy) {
      return reply.code(400).send({ code: "BONUS_BUY_NOT_AVAILABLE" });
    }
    const engine = new SlotEngine(config);
    const wager = body.data.bet * (body.data.bonusBuy ? config.features!.bonusBuy!.costMultiplier : 1);

    // Production seeds come from a server secret/nonce derivation and are persisted for audit/replay.
    const seed = randomBytes(8).readBigUInt64LE();
    try {
      const settled = await dependencies.spinStore.settle({
        playerId, idempotencyKey: keyResult.data, slotId, configVersion: config.version,
        bet: wager, seed,
      }, () => engine.spin({ bet: body.data.bet, seed, bonusBuy: body.data.bonusBuy }));
      dependencies.metrics?.recordSpin(slotId, "returned");
      const { seed: _privateSeed, ...publicSpin } = settled.spin;
      return { ...settled, spin: publicSpin, jackpots: await dependencies.spinStore.getJackpots() };
    } catch (error) {
      dependencies.metrics?.recordSpin(slotId, "rejected");
      if (error instanceof InsufficientFundsError) return reply.code(409).send({ code: "INSUFFICIENT_FUNDS" });
      throw error;
    }
  });
  app.addHook("onClose", async () => {
    await dependencies.spinStore.close();
    await dependencies.identityService?.close();
    await dependencies.socialStore?.close();
    await dependencies.liveOpsStore?.close();
    await dependencies.analyticsStore?.close();
    await dependencies.readiness?.close();
    await dependencies.pushWorker?.close();
    await dependencies.messagingStore?.close();
    await dependencies.monetizationService?.close();
  });
  return app;
}

function hasAdminRole(roles: readonly AdminRole[], required: AdminRole): boolean { return roles.includes(required); }

function secureBearerMatch(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(authorization.slice(7)); const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function isValidTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; }
  catch { return false; }
}

function vipStatus(points: number) {
  const tiers = [
    { name: "BRONZE", minimum: 0, next: 1_000 },
    { name: "SILVER", minimum: 1_000, next: 3_000 },
    { name: "GOLD", minimum: 3_000, next: 7_500 },
    { name: "PLATINUM", minimum: 7_500, next: 15_000 },
    { name: "DIAMOND", minimum: 15_000, next: 30_000 },
  ];
  const tier = [...tiers].reverse().find((value) => points >= value.minimum) ?? tiers[0]!;
  return { tier: tier.name, points, tierStart: tier.minimum, nextTierPoints: tier.next };
}

function achievement(name: string, description: string, rewardId: string, progress: number, target: number, coins: number, claimed: Set<string>) {
  return { name, description, rewardId, progress, target, coins, completed: progress >= target, claimed: claimed.has(rewardId) };
}
