import { describe, expect, it } from "vitest";
import { lootOpeningRequestHash, validateOpenLootCommand, type OpenLootCommand } from "./loot-opening.js";

const command: OpenLootCommand = {
  playerId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "chest:open:1",
  entitlementId: "22222222-2222-4222-8222-222222222222",
};

describe("loot opening contract", () => {
  it("creates a stable semantic hash independent of the retry key", () => {
    const left = lootOpeningRequestHash(command);
    const right = lootOpeningRequestHash({ ...command, idempotencyKey: "retry:2" });
    expect(left.equals(right)).toBe(true);
  });

  it("changes the hash when the player or entitlement changes", () => {
    expect(lootOpeningRequestHash(command).equals(lootOpeningRequestHash({
      ...command,
      entitlementId: "33333333-3333-4333-8333-333333333333",
    }))).toBe(false);
    expect(lootOpeningRequestHash(command).equals(lootOpeningRequestHash({
      ...command,
      playerId: "44444444-4444-4444-8444-444444444444",
    }))).toBe(false);
  });

  it("rejects invalid player, entitlement, and idempotency identifiers", () => {
    expect(() => validateOpenLootCommand({ ...command, idempotencyKey: "" })).toThrow(RangeError);
    expect(() => validateOpenLootCommand({ ...command, playerId: "not-a-uuid" })).toThrow(RangeError);
    expect(() => validateOpenLootCommand({ ...command, entitlementId: "not-a-uuid" })).toThrow(RangeError);
  });
});
