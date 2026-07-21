import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

/**
 * Die Oekonomie-Routen versorgen das Boost-Center. Sie muessen durchgelassen
 * werden, duerfen die Allowlist aber nicht aufweichen: benachbarte Pfade und
 * Traversal-Versuche bleiben blockiert.
 */
describe("player BFF allowlist: economy", () => {
  it.each([
    "economy/check-win",
    "economy/check-win/claim",
    "economy/boosters",
    "economy/boosters/craft",
    "economy/boosters/activate",
    "economy/loyalty-rewards",
    "economy/loyalty-rewards/gem-pack-small/redeem",
    "economy/high-roller-club",
    "economy/high-roller-club/activate",
  ])("laesst %s durch", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each([
    "economy",
    "economy/ledger",
    "economy/boosters/delete",
    "economy/check-win/claim/all",
    "economy/high-roller-club/cancel",
    "economy/loyalty-rewards/redeem",
    "economy/loyalty-rewards/../../admin",
    "economy/loyalty-rewards/GEM_PACK/redeem",
  ])("blockiert %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });
});
