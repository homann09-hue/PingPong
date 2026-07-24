import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluateLootTable, validateLootTable, type LootTable } from "./loot-engine.js";

const seed = Buffer.from("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", "hex");

const table: LootTable = {
  tableId: "starter-chest",
  version: 1,
  pityGroup: "starter-avatar",
  pityAfter: 3,
  entries: [
    {
      entryId: "guaranteed-key",
      itemId: "bronze-key",
      itemVersion: 1,
      kind: "guaranteed",
      weight: 0,
      minQuantity: 1,
      maxQuantity: 1,
      pityEligible: false,
    },
    {
      entryId: "common-booster",
      itemId: "spin-booster",
      itemVersion: 1,
      kind: "weighted",
      weight: 99,
      minQuantity: 1,
      maxQuantity: 3,
      pityEligible: false,
    },
    {
      entryId: "rare-avatar",
      itemId: "gold-avatar",
      itemVersion: 1,
      kind: "weighted",
      weight: 1,
      minQuantity: 1,
      maxQuantity: 1,
      pityEligible: true,
    },
  ],
};

describe("loot engine", () => {
  it("replays exactly from the same seed and table version", () => {
    const first = evaluateLootTable(table, seed, 0);
    const second = evaluateLootTable(table, Buffer.from(seed), 0);

    expect(second).toEqual(first);
    expect(first.proof.seedCommitment).toBe(createHash("sha256").update(seed).digest("hex"));
    expect(first.rewards[0]).toMatchObject({ entryId: "guaranteed-key", quantity: 1 });
    expect(first.rewards).toHaveLength(2);
    expect(first.proof.draws.length).toBeGreaterThanOrEqual(1);
    for (const draw of first.proof.draws) {
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(draw.bound);
      expect(draw.counter).toBeGreaterThanOrEqual(0);
      expect(draw.rejectedBlocks).toBeGreaterThanOrEqual(0);
    }
  });

  it("forces the pity-eligible weighted pool at the configured threshold", () => {
    const result = evaluateLootTable(table, seed, 2);

    expect(result).toMatchObject({
      pityBefore: 2,
      pityAfter: 0,
      forcedPity: true,
    });
    expect(result.rewards).toEqual([
      expect.objectContaining({ entryId: "guaranteed-key", quantity: 1 }),
      expect.objectContaining({ entryId: "rare-avatar", quantity: 1 }),
    ]);
    expect(result.proof.draws[0]).toMatchObject({ purpose: "weighted-entry", bound: 1, value: 0 });
  });

  it("resets pity for a natural eligible result and disables counters without a pity policy", () => {
    const eligibleOnly: LootTable = {
      ...table,
      entries: table.entries.filter((entry) => entry.entryId !== "common-booster"),
    };
    expect(evaluateLootTable(eligibleOnly, seed, 1)).toMatchObject({ pityAfter: 0, forcedPity: false });
    expect(evaluateLootTable({ ...eligibleOnly, pityAfter: null }, seed, 200)).toMatchObject({
      pityBefore: 200,
      pityAfter: 0,
      forcedPity: false,
    });
  });

  it("rejects malformed or economically unsafe tables", () => {
    expect(() => validateLootTable({ ...table, entries: [] })).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: table.entries.map((entry) => entry.kind === "weighted" ? { ...entry, weight: 0 } : entry),
    })).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: table.entries.map((entry) => ({ ...entry, pityEligible: false })),
    })).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: [table.entries[0]!, { ...table.entries[0]! }],
    })).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: table.entries.map((entry) => entry.entryId === "guaranteed-key"
        ? { ...entry, pityEligible: true }
        : entry),
    })).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: [
        ...table.entries.filter((entry) => entry.kind === "guaranteed"),
        { ...table.entries[1]!, weight: Number.MAX_SAFE_INTEGER },
        { ...table.entries[2]!, weight: 1 },
      ],
    })).toThrow(RangeError);
  });

  it("rejects invalid seeds, pity counters, and quantity ranges", () => {
    expect(() => evaluateLootTable(table, Buffer.alloc(31), 0)).toThrow(RangeError);
    expect(() => evaluateLootTable(table, seed, -1)).toThrow(RangeError);
    expect(() => validateLootTable({
      ...table,
      entries: table.entries.map((entry) => entry.entryId === "common-booster"
        ? { ...entry, minQuantity: 4, maxQuantity: 3 }
        : entry),
    })).toThrow(RangeError);
  });
});
