import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemorySpinStore } from "./spins/in-memory-spin-store.js";

const playerId = "00000000-0000-4000-8000-000000000001";
const app = buildApp({
  authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
  spinStore: new InMemorySpinStore(100),
});
afterAll(async () => app.close());

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
  it("returns an authoritative VIP, achievement, and tournament profile", async () => {
    const response = await app.inject({
      method: "GET", url: "/v1/profile", headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().vip.tier).toBe("SILVER");
    expect(response.json().achievements).toHaveLength(3);
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
    expect(spin.json().jackpots).toHaveLength(3);
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
  it("publishes tiered daily and weekly missions with cadence-specific periods", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/missions", headers: { authorization: "Bearer valid" } });
    expect(response.statusCode).toBe(200);
    const missions = response.json().missions as Array<{ id: string; cadence: string; tier: string; periodKey: string }>;
    expect(missions.find((mission) => mission.id === "daily-spins-10")).toMatchObject({ cadence: "daily", tier: "standard" });
    expect(missions.find((mission) => mission.id === "weekly-spins-100")).toMatchObject({ cadence: "weekly", tier: "pro" });
    expect(missions.find((mission) => mission.id === "weekly-spins-100")?.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
      id: "dragon-peak", version: 2, lines: 20, targetRtp: 0.94, volatility: "high",
      maxWinMultiplier: 5_000, mathModelVersion: "2.0.0",
    });
    expect(response.json().bet.steps).toEqual([100, 200, 500, 1_000, 2_000, 5_000, 10_000]);
    expect(response.json().symbols.W.kind).toBe("wild");
    expect(response.json().symbols.A.payouts[5]).toBeGreaterThan(0);
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
    const transactions = history.json().transactions as Array<{ amount: number; balanceBefore: number; balanceAfter: number }>;
    expect(transactions.filter((entry) => entry.amount === -10)).toHaveLength(1);
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
