import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

describe("player BFF allowlist", () => {
  it.each(["lobby", "profile", "wallet", "jackpots", "events", "missions", "slots/pharaoh-oasis/paytable", "slots/pharaoh-oasis/spins"])("allows %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each(["auth/guest", "admin/v1/players", "slots/../../profile/spins", "slots/pharaoh-oasis/config", "https://example.com"])("rejects %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });
});
