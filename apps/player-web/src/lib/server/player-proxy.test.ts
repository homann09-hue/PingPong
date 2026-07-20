import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

describe("player BFF allowlist", () => {
  it.each(["lobby", "profile", "wallet", "jackpots", "events", "missions", "auth/account", "auth/sessions", "auth/sessions/00000000-0000-4000-8000-000000000001", "auth/devices", "auth/cloud-save", "auth/privacy-export", "slots/pharaoh-oasis/paytable", "slots/pharaoh-oasis/spins"])("allows %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each(["auth/guest", "auth/provider", "auth/sessions/not-a-uuid", "admin/v1/players", "slots/../../profile/spins", "slots/pharaoh-oasis/config", "https://example.com"])("rejects %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });
});
