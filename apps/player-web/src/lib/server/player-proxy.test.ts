import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  isAllowedPlayerPath,
  isSameOriginMutation,
  playerResponseHeaders,
  playerUpstreamUrl,
  proxyPlayerRequest,
  validInstallationId,
} from "./player-proxy";

describe("player BFF allowlist", () => {
  it.each(["lobby", "profile", "wallet", "jackpots", "events", "missions", "auth/account", "auth/sessions", "auth/sessions/00000000-0000-4000-8000-000000000001", "auth/devices", "auth/cloud-save", "auth/privacy-export", "slots/pharaoh-oasis/paytable", "slots/pharaoh-oasis/spins"])("allows %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each(["auth/guest", "auth/provider", "auth/sessions/not-a-uuid", "admin/v1/players", "slots/../../profile/spins", "slots/pharaoh-oasis/config", "https://example.com"])("rejects %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });

  it("forwards validated query parameters to the player API", () => {
    const request = new NextRequest("https://casino.example/api/player/wallet/transactions?limit=40");
    const upstream = playerUpstreamUrl(request, "wallet/transactions");
    expect(upstream.pathname).toBe("/v1/wallet/transactions");
    expect(upstream.search).toBe("?limit=40");
  });

  it("forwards only safe response metadata needed by clients", () => {
    const upstream = new Response("{}", { headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="export.json"',
      "retry-after": "12",
      "x-ratelimit-remaining": "0",
      "set-cookie": "secret=never-forward",
    } });
    const headers = playerResponseHeaders(upstream);
    expect(Object.fromEntries(headers)).toEqual({
      "content-disposition": 'attachment; filename="export.json"',
      "content-type": "application/json",
      "retry-after": "12",
      "x-ratelimit-remaining": "0",
    });
  });

  it("accepts reads and same-origin writes but rejects cross-origin mutations", () => {
    expect(isSameOriginMutation(new NextRequest("https://casino.example/api/player/profile"))).toBe(true);
    expect(isSameOriginMutation(new NextRequest("https://casino.example/api/player/profile", {
      method: "POST", headers: { origin: "https://casino.example" },
    }))).toBe(true);
    expect(isSameOriginMutation(new NextRequest("https://casino.example/api/player/profile", {
      method: "POST", headers: { origin: "https://attacker.example" },
    }))).toBe(false);
    expect(isSameOriginMutation(new NextRequest("https://casino.example/api/player/profile", {
      method: "POST",
    }))).toBe(false);
  });

  it("accepts only canonical UUID installation cookies", () => {
    expect(validInstallationId("00000000-0000-4000-8000-000000000001"))
      .toBe("00000000-0000-4000-8000-000000000001");
    expect(validInstallationId("not-a-uuid")).toBeUndefined();
    expect(validInstallationId(undefined)).toBeUndefined();
  });

  it("blocks a cross-origin write before contacting the player service", async () => {
    const request = new NextRequest("https://casino.example/api/player/rewards/daily/claim", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: "{}",
    });
    const response = await proxyPlayerRequest(request, "rewards/daily/claim");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "CROSS_ORIGIN_REQUEST" });
  });
});
