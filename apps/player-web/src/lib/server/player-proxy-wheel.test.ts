import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

/**
 * Das Glucksrad braucht genau zwei Pfade. Alles daneben bleibt zu — insbesondere
 * andere Radtypen, die es serverseitig (noch) gar nicht gibt.
 */
describe("player BFF allowlist: lucky wheel", () => {
  it.each([
    "rewards/wheels/standard",
    "rewards/wheels/standard/spin",
  ])("laesst %s durch", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each([
    "rewards/wheels",
    "rewards/wheels/premium",
    "rewards/wheels/premium/spin",
    "rewards/wheels/standard/spin/spin",
    "rewards/wheels/standard/configure",
  ])("blockiert %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });
});
