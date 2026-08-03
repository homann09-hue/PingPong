import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath, isTrustedMutationRequest, requiresIdempotencyKey } from "./player-proxy";

describe("player BFF allowlist", () => {
  it.each(["lobby", "profile", "wallet", "jackpots", "events", "missions", "auth/account", "auth/sessions", "auth/sessions/00000000-0000-4000-8000-000000000001", "auth/devices", "auth/cloud-save", "auth/privacy-export", "slots/pharaoh-oasis/paytable", "slots/pharaoh-oasis/spins"])("allows %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each(["auth/guest", "auth/provider", "auth/sessions/not-a-uuid", "admin/v1/players", "slots/../../profile/spins", "slots/pharaoh-oasis/config", "https://example.com"])("rejects %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });
});

describe("player BFF idempotency policy", () => {
  it.each([
    "slots/pharaoh-oasis/spins",
    "missions/daily-1/claim",
    "rewards/wheels/standard/spin",
    "economy/boosters/craft",
    "economy/boosters/activate",
    "economy/loyalty-rewards/reward-1/redeem",
    "shop/offers/starter/purchase",
  ])("requires a key for POST %s", (path) => {
    expect(requiresIdempotencyKey("POST", path)).toBe(true);
  });

  it("does not match unrelated mutations by a broad suffix", () => {
    expect(requiresIdempotencyKey("POST", "social/friend-requests")).toBe(false);
    expect(requiresIdempotencyKey("DELETE", "slots/pharaoh-oasis/spins")).toBe(false);
  });
});

describe("player BFF mutation origin protection", () => {
  it("allows safe methods without origin headers", () => {
    const request = new NextRequest("https://casino.example/api/player/profile", { method: "GET" });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });

  it("allows same-origin mutations", () => {
    const request = new NextRequest("https://casino.example/api/player/slots/pharaoh-oasis/spins", {
      method: "POST",
      headers: { origin: "https://casino.example", "sec-fetch-site": "same-origin" },
    });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });

  it("rejects missing or cross-origin mutation headers", () => {
    const missing = new NextRequest("https://casino.example/api/player/profile", { method: "DELETE" });
    const crossOrigin = new NextRequest("https://casino.example/api/player/profile", {
      method: "DELETE",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    });
    expect(isTrustedMutationRequest(missing)).toBe(false);
    expect(isTrustedMutationRequest(crossOrigin)).toBe(false);
  });
});
