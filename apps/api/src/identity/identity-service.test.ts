import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../http-app.js";
import { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { IdentityService } from "./identity-service.js";
import { InMemoryIdentityStore } from "./in-memory-identity-store.js";
import type { ExternalIdentityVerifier } from "./external-identity-verifier.js";

const secret = "identity-test-secret-with-at-least-32-bytes";
const verifiedIdentities: ExternalIdentityVerifier = {
  async verify(accessToken, provider) {
    return accessToken === "valid-provider-token-with-at-least-32-characters" ? { provider, subject: `subject-${provider}` } : null;
  },
};

describe("identity sessions", () => {
  it("creates a guest, rotates refresh tokens, and rejects token replay", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret);
    const installationId = randomUUID();
    const first = await identity.createGuest(installationId, "ios");
    expect(await identity.authenticate(`Bearer ${first.accessToken}`)).toBe(first.playerId);

    const rotated = await identity.refresh(first.refreshToken);
    expect(rotated?.playerId).toBe(first.playerId);
    expect(rotated?.refreshToken).not.toBe(first.refreshToken);
    expect(await identity.authenticate(`Bearer ${first.accessToken}`)).toBeNull();
    expect(await identity.authenticate(`Bearer ${rotated!.accessToken}`)).toBe(first.playerId);

    expect(await identity.refresh(first.refreshToken)).toBeNull();
    expect(await identity.authenticate(`Bearer ${rotated!.accessToken}`)).toBeNull();
  });

  it("reuses the guest account for the same installation and revokes logout", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret);
    const installationId = randomUUID();
    const first = await identity.createGuest(installationId, "web");
    const second = await identity.createGuest(installationId, "web");
    expect(second.playerId).toBe(first.playerId);
    await identity.logout(second.refreshToken);
    expect(await identity.authenticate(`Bearer ${second.accessToken}`)).toBeNull();
  });

  it("lists, revokes, logs out all sessions, and deletes an account", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret);
    const installationId = randomUUID();
    const first = await identity.createGuest(installationId, "ios");
    const second = await identity.createGuest(installationId, "web");
    const sessions = await identity.listSessions(first.playerId);
    expect(sessions).toHaveLength(2);
    expect(await identity.revokeSession(first.playerId, sessions[0]!.id)).toBe(true);
    expect(await identity.listSessions(first.playerId)).toHaveLength(1);
    expect(await identity.logoutAll(first.playerId)).toBe(1);
    expect(await identity.authenticate(`Bearer ${first.accessToken}`)).toBeNull();
    expect(await identity.authenticate(`Bearer ${second.accessToken}`)).toBeNull();

    const third = await identity.createGuest(installationId, "android");
    expect(await identity.deleteAccount(third.playerId)).toBe(true);
    expect(await identity.authenticate(`Bearer ${third.accessToken}`)).toBeNull();
    const replacement = await identity.createGuest(installationId, "android");
    expect(replacement.playerId).not.toBe(third.playerId);
  });

  it("exposes the complete guest, refresh, authenticated request, and logout flow", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret);
    const app = buildApp({
      authenticator: identity,
      identityService: identity,
      spinStore: new InMemorySpinStore(100_000),
    });
    const guest = await app.inject({
      method: "POST",
      url: "/v1/auth/guest",
      payload: { installationId: randomUUID(), platform: "android" },
    });
    expect(guest.statusCode).toBe(201);
    expect(guest.headers["x-content-type-options"]).toBe("nosniff");
    expect(guest.headers["cache-control"]).toBe("no-store");
    const first = guest.json() as { accessToken: string; refreshToken: string; playerId: string };
    const profile = await app.inject({
      method: "GET", url: "/v1/profile", headers: { authorization: `Bearer ${first.accessToken}` },
    });
    expect(profile.statusCode).toBe(200);

    const refresh = await app.inject({
      method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: first.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    const second = refresh.json() as { accessToken: string; refreshToken: string };
    const oldProfile = await app.inject({
      method: "GET", url: "/v1/profile", headers: { authorization: `Bearer ${first.accessToken}` },
    });
    expect(oldProfile.statusCode).toBe(401);

    const logout = await app.inject({
      method: "POST", url: "/v1/auth/logout", payload: { refreshToken: second.refreshToken },
    });
    expect(logout.statusCode).toBe(204);
    expect(await identity.authenticate(`Bearer ${second.accessToken}`)).toBeNull();
    await app.close();
  });

  it("rate limits repeated guest-account requests", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret);
    const app = buildApp({ identityService: identity, authenticator: identity, spinStore: new InMemorySpinStore() });
    const responses = [];
    for (let index = 0; index < 6; index++) {
      responses.push(await app.inject({
        method: "POST", url: "/v1/auth/guest",
        payload: { installationId: randomUUID(), platform: "web" },
      }));
    }
    expect(responses.slice(0, 5).every((response) => response.statusCode === 201)).toBe(true);
    expect(responses[5]!.statusCode).toBe(429);
    expect(responses[5]!.json()).toEqual({ code: "RATE_LIMITED" });
    expect(responses[5]!.headers["retry-after"]).toBeTruthy();
    await app.close();
  });

  it("links a verified provider, restores it on another device, and syncs versioned cloud state", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret, verifiedIdentities);
    const guest = await identity.createGuest(randomUUID(), "web");
    const linked = await identity.signInWithProvider({
      provider: "google", providerAccessToken: "valid-provider-token-with-at-least-32-characters",
      currentPlayerId: guest.playerId, installationId: randomUUID(), platform: "web",
    });
    expect(linked.playerId).toBe(guest.playerId);
    expect(await identity.authenticate(`Bearer ${guest.accessToken}`)).toBeNull();
    expect((await identity.getAccount(linked.playerId))?.providers).toEqual(["google"]);
    const firstSave = await identity.updateCloudSave(linked.playerId, 0, { sound: false, locale: "de" });
    expect(firstSave?.version).toBe(1);
    expect(await identity.updateCloudSave(linked.playerId, 0, { sound: true })).toBeNull();

    const restored = await identity.signInWithProvider({
      provider: "google", providerAccessToken: "valid-provider-token-with-at-least-32-characters",
      currentPlayerId: null, installationId: randomUUID(), platform: "ios",
    });
    expect(restored.playerId).toBe(linked.playerId);
    expect((await identity.listDevices(linked.playerId)).map((device) => device.platform).sort()).toEqual(["ios", "web", "web"]);
    expect((await identity.exportAccount(linked.playerId))?.cloudSave).toEqual(firstSave);
  });

  it("rejects an unverified external provider token", async () => {
    const identity = new IdentityService(new InMemoryIdentityStore(), secret, verifiedIdentities);
    await expect(identity.signInWithProvider({
      provider: "apple", providerAccessToken: "invalid-provider-token-that-is-long-enough",
      currentPlayerId: null, installationId: randomUUID(), platform: "ios",
    })).rejects.toThrow("External identity token is invalid");
  });
});
