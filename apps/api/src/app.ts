import { randomBytes } from "node:crypto";
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
import { ClanMembershipError, ClanNotFoundError, FriendRequestNotFoundError, SocialConflictError, SocialPlayerNotFoundError } from "./social/social-store.js";
import type { AdminAuthenticator, AdminRole } from "./admin/admin-auth.js";
import type { LiveOpsStore } from "./liveops/liveops-store.js";
import { CampaignNotFoundError, CampaignStateError, FourEyesViolationError } from "./liveops/liveops-store.js";

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
}

/** Builds the HTTP composition root with explicit, replaceable infrastructure ports. */
export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.headers.cookie"] } });
  void app.register(cors, {
    origin: process.env.DEMO_MODE === "true" ? true : false,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "idempotency-key"],
    exposedHeaders: ["x-request-id"],
  });
  const authRateLimiter = new FixedWindowRateLimiter();
  app.addHook("onRequest", async (request, reply) => {
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
    if (request.url.startsWith("/admin/")) {
      const rate = authRateLimiter.consume(`admin:${request.ip}`, 120, 60_000);
      reply.header("x-ratelimit-remaining", rate.remaining);
      if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    }
  });
  const configs = new Map<string, SlotConfig>([classicConfig, auroraConfig, ...themedConfigs].map((config) => [config.id, config]));

  app.get("/health/live", async () => ({ status: "ok" }));
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
  app.get("/admin/v1/audit", async (request, reply) => {
    if (!dependencies.liveOpsStore || !dependencies.adminAuthenticator) return reply.code(503).send({ code: "ADMIN_UNAVAILABLE" });
    const principal = await dependencies.adminAuthenticator.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ code: "UNAUTHORIZED" });
    if (!hasAdminRole(principal.roles, "liveops_auditor")) return reply.code(403).send({ code: "FORBIDDEN" });
    const query = adminAuditQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_REQUEST" });
    return { entries: await dependencies.liveOpsStore.listAudit(query.data.limit) };
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
  app.delete("/v1/profile", async (request, reply) => {
    if (!dependencies.identityService) return reply.code(503).send({ code: "IDENTITY_UNAVAILABLE" });
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const deleted = await dependencies.identityService.deleteAccount(playerId);
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
  if (process.env.NODE_ENV !== "test" && existsSync(webRoot)) {
    void app.register(staticFiles, { root: webRoot, prefix: "/" });
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
      const { seed: _privateSeed, ...publicSpin } = settled.spin;
      return { ...settled, spin: publicSpin, jackpots: await dependencies.spinStore.getJackpots() };
    } catch (error) {
      if (error instanceof InsufficientFundsError) return reply.code(409).send({ code: "INSUFFICIENT_FUNDS" });
      throw error;
    }
  });
  app.addHook("onClose", async () => {
    await dependencies.spinStore.close();
    await dependencies.identityService?.close();
    await dependencies.socialStore?.close();
    await dependencies.liveOpsStore?.close();
  });
  return app;
}

function hasAdminRole(roles: readonly AdminRole[], required: AdminRole): boolean { return roles.includes(required); }

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
