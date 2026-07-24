import { describe, expect, it } from "vitest";
import { lootOpeningRequestHash, validateOpenLootCommand, type OpenLootCommand } from "./loot-opening.js";

const command: OpenLootCommand = {
  playerId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "chest:open:1",
  tableId: "starter-chest",
  source: "chest",
  referenceId: "starter-chest-instance:1",
};

describe("loot opening contract", () => {
  it("creates stable hashes independent of metadata key order", () => {
    const left = lootOpeningRequestHash({ ...command, metadata: { chestLevel: 2, context: { a: 1, b: true } } });
    const right = lootOpeningRequestHash({ ...command, metadata: { context: { b: true, a: 1 }, chestLevel: 2 } });
    expect(left.equals(right)).toBe(true);
  });

  it("changes the hash when opening semantics change", () => {
    expect(lootOpeningRequestHash(command).equals(lootOpeningRequestHash({
      ...command,
      tableId: "premium-chest",
    }))).toBe(false);
    expect(lootOpeningRequestHash(command).equals(lootOpeningRequestHash({
      ...command,
      referenceId: "starter-chest-instance:2",
    }))).toBe(false);
  });

  it("rejects invalid identifiers and non-JSON metadata", () => {
    expect(() => validateOpenLootCommand({ ...command, idempotencyKey: "" })).toThrow(RangeError);
    expect(() => validateOpenLootCommand({ ...command, tableId: "x".repeat(129) })).toThrow(RangeError);
    expect(() => validateOpenLootCommand({ ...command, metadata: { invalid: undefined } })).toThrow(TypeError);
    expect(() => validateOpenLootCommand({ ...command, metadata: { invalid: Number.POSITIVE_INFINITY } })).toThrow(RangeError);
  });
});
