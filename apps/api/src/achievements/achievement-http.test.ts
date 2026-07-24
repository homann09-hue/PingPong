import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../http-app.js";
import { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { InMemoryAchievementStore } from "./in-memory-achievement-store.js";

const playerId = "00000000-0000-4000-8000-000000000001";
const openApps: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("achievement HTTP integration", () => {
  it("requires an idempotency key and replays an accepted claim", async () => {
    const { app } = testApp();
    const url = "/v1/rewards/achievement-journey-2/claims";
    const unauthorizedKey = await app.inject({ method: "POST", url, headers: { authorization: "Bearer valid" } });
    expect(unauthorizedKey.statusCode).toBe(400);
    expect(unauthorizedKey.json()).toEqual({ code: "INVALID_IDEMPOTENCY_KEY" });

    const request = {
      method: "POST" as const,
      url,
      headers: {
        authorization: "Bearer valid",
        "idempotency-key": "00000000-0000-4000-8000-000000000101",
      },
    };
    const first = await app.inject(request);
    const replay = await app.inject(request);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      achievementId: "achievement-journey-2",
      achievementVersion: 1,
      coins: 100_000,
      coinBalance: 101_000,
      replayed: false,
    });
    expect(replay.json()).toMatchObject({
      claimId: first.json().claimId,
      coinBalance: 101_000,
      replayed: true,
    });
  });

  it("enforces prerequisites and detects idempotency conflicts", async () => {
    const { app } = testApp();
    const headers = {
      authorization: "Bearer valid",
      "idempotency-key": "00000000-0000-4000-8000-000000000201",
    };
    const locked = await app.inject({
      method: "POST",
      url: "/v1/rewards/achievement-journey-10/claims",
      headers,
    });
    expect(locked.statusCode).toBe(409);
    expect(locked.json()).toEqual({ code: "REWARD_REQUIREMENT_NOT_MET" });

    expect((await app.inject({
      method: "POST",
      url: "/v1/rewards/achievement-journey-2/claims",
      headers,
    })).statusCode).toBe(200);
    const conflict = await app.inject({
      method: "POST",
      url: "/v1/rewards/achievement-journey-10/claims",
      headers,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ code: "IDEMPOTENCY_CONFLICT" });

    const accepted = await app.inject({
      method: "POST",
      url: "/v1/rewards/achievement-journey-10/claims",
      headers: {
        ...headers,
        "idempotency-key": "00000000-0000-4000-8000-000000000202",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ coins: 750_000, coinBalance: 851_000 });
  });

  it("returns achievement views from the dedicated store", async () => {
    const { app } = testApp();
    const before = await app.inject({ method: "GET", url: "/v1/profile", headers: { authorization: "Bearer valid" } });
    expect(before.statusCode).toBe(200);
    expect(before.json().achievements.find((item: { id: string }) => item.id === "achievement-journey-10"))
      .toMatchObject({ version: 1, completed: true, claimed: false, unlocked: false });

    await app.inject({
      method: "POST",
      url: "/v1/rewards/achievement-journey-2/claims",
      headers: {
        authorization: "Bearer valid",
        "idempotency-key": "00000000-0000-4000-8000-000000000301",
      },
    });
    const after = await app.inject({ method: "GET", url: "/v1/profile", headers: { authorization: "Bearer valid" } });
    expect(after.json().achievements.find((item: { id: string }) => item.id === "achievement-journey-10"))
      .toMatchObject({ completed: true, claimed: false, unlocked: true });
  });
});

function testApp() {
  const spinStore = new InMemorySpinStore(1_000);
  const achievementStore = new InMemoryAchievementStore(spinStore);
  const app = buildApp({
    authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
    spinStore,
    achievementStore,
  });
  openApps.push(app);
  return { app, spinStore, achievementStore };
}
