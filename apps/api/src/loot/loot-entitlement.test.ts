import { describe, expect, it } from "vitest";
import {
  lootEntitlementRequestHash,
  validateIssueLootEntitlementCommand,
  type IssueLootEntitlementCommand,
} from "./loot-entitlement.js";

const now = new Date("2026-07-24T12:00:00.000Z");
const command: IssueLootEntitlementCommand = {
  playerId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "issue:1",
  tableId: "starter-chest",
  source: "achievement",
  referenceId: "achievement:first-spin",
  expiresAt: new Date("2026-07-25T12:00:00.000Z"),
  metadata: { achievementVersion: 1, context: { a: 1, b: true } },
};

describe("loot entitlement contract", () => {
  it("creates canonical fingerprints independent of metadata key order and retry key", () => {
    const left = lootEntitlementRequestHash(command);
    const right = lootEntitlementRequestHash({
      ...command,
      idempotencyKey: "issue:retry",
      metadata: { context: { b: true, a: 1 }, achievementVersion: 1 },
    });
    expect(left.equals(right)).toBe(true);
  });

  it("changes the fingerprint for table, source reference, or expiry changes", () => {
    expect(lootEntitlementRequestHash(command).equals(lootEntitlementRequestHash({
      ...command, tableId: "premium-chest",
    }))).toBe(false);
    expect(lootEntitlementRequestHash(command).equals(lootEntitlementRequestHash({
      ...command, referenceId: "achievement:high-roller",
    }))).toBe(false);
    expect(lootEntitlementRequestHash(command).equals(lootEntitlementRequestHash({
      ...command, expiresAt: new Date("2026-07-26T12:00:00.000Z"),
    }))).toBe(false);
  });

  it("rejects invalid UUIDs, expired grants, and non-JSON metadata", () => {
    expect(() => validateIssueLootEntitlementCommand({ ...command, playerId: "invalid" }, now)).toThrow(RangeError);
    expect(() => validateIssueLootEntitlementCommand({ ...command, expiresAt: now }, now)).toThrow(RangeError);
    expect(() => validateIssueLootEntitlementCommand({ ...command, metadata: { invalid: undefined } }, now)).toThrow(TypeError);
    expect(() => validateIssueLootEntitlementCommand({
      ...command, metadata: { invalid: Number.POSITIVE_INFINITY },
    }, now)).toThrow(RangeError);
  });
});
