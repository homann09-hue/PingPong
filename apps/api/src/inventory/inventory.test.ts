import { describe, expect, it } from "vitest";
import { inventoryRequestHash, validateInventoryMutation, type GrantInventoryCommand } from "./inventory.js";

const baseGrant: GrantInventoryCommand = {
  operationType: "grant",
  playerId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "loot:opening:1",
  itemId: "golden-key",
  itemVersion: 1,
  quantity: 3,
  expiresAt: null,
  eventId: null,
  reason: "loot_reward",
  source: "loot",
  referenceId: "opening:1",
};

describe("inventory domain", () => {
  it("creates stable fingerprints independent of metadata key order", () => {
    const left = inventoryRequestHash({
      ...baseGrant,
      metadata: { tableVersion: 2, evidence: { seedCommitment: "abc", roll: 0.25 } },
    });
    const right = inventoryRequestHash({
      ...baseGrant,
      metadata: { evidence: { roll: 0.25, seedCommitment: "abc" }, tableVersion: 2 },
    });

    expect(left.equals(right)).toBe(true);
  });

  it("changes the fingerprint when mutation semantics change", () => {
    const original = inventoryRequestHash(baseGrant);
    const changedQuantity = inventoryRequestHash({ ...baseGrant, quantity: 4 });
    const changedExpiry = inventoryRequestHash({ ...baseGrant, expiresAt: new Date("2026-08-01T00:00:00.000Z") });

    expect(original.equals(changedQuantity)).toBe(false);
    expect(original.equals(changedExpiry)).toBe(false);
  });

  it("rejects unsafe quantities, invalid dates, and non-JSON metadata", () => {
    expect(() => validateInventoryMutation({ ...baseGrant, quantity: 0 })).toThrow(RangeError);
    expect(() => validateInventoryMutation({ ...baseGrant, quantity: Number.MAX_SAFE_INTEGER + 1 })).toThrow(RangeError);
    expect(() => validateInventoryMutation({ ...baseGrant, expiresAt: new Date("invalid") })).toThrow(RangeError);
    expect(() => validateInventoryMutation({ ...baseGrant, metadata: { invalid: undefined } })).toThrow(TypeError);
    expect(() => validateInventoryMutation({ ...baseGrant, metadata: { invalid: 1n } })).toThrow(TypeError);
  });

  it("rejects empty and unbounded external identifiers", () => {
    expect(() => validateInventoryMutation({ ...baseGrant, idempotencyKey: "" })).toThrow(RangeError);
    expect(() => validateInventoryMutation({ ...baseGrant, eventId: "x".repeat(129) })).toThrow(RangeError);
    expect(() => validateInventoryMutation({ ...baseGrant, referenceId: "x".repeat(201) })).toThrow(RangeError);
  });
});
