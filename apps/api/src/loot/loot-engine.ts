import { createHash, createHmac } from "node:crypto";

export type LootEntryKind = "weighted" | "guaranteed";

export interface LootEntry {
  readonly entryId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly kind: LootEntryKind;
  readonly weight: number;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly pityEligible: boolean;
}

export interface LootTable {
  readonly tableId: string;
  readonly version: number;
  readonly pityGroup: string;
  readonly pityAfter: number | null;
  readonly entries: readonly LootEntry[];
}

export interface LootReward {
  readonly entryId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly kind: LootEntryKind;
  readonly quantity: number;
}

export interface LootDrawEvidence {
  readonly purpose: string;
  readonly counter: number;
  readonly bound: number;
  readonly value: number;
  readonly rejectedBlocks: number;
}

export interface LootEvaluation {
  readonly tableId: string;
  readonly tableVersion: number;
  readonly pityGroup: string;
  readonly pityBefore: number;
  readonly pityAfter: number;
  readonly forcedPity: boolean;
  readonly rewards: readonly LootReward[];
  readonly proof: {
    readonly version: 1;
    readonly seedCommitment: string;
    readonly draws: readonly LootDrawEvidence[];
  };
}

const RNG_DOMAIN = Buffer.from("aurora-loot-v1", "utf8");
const UINT64_RANGE = 1n << 64n;
const MAX_ENTRIES = 200;

export function evaluateLootTable(
  table: LootTable,
  serverSeed: Buffer,
  pityMisses: number,
): LootEvaluation {
  validateLootTable(table);
  assertSafeNonNegativeInteger(pityMisses, "pityMisses");
  if (serverSeed.length !== 32) throw new RangeError("serverSeed must contain exactly 32 bytes");

  const rng = new AuditedLootRng(serverSeed);
  const guaranteed = table.entries.filter((entry) => entry.kind === "guaranteed");
  const weighted = table.entries.filter((entry) => entry.kind === "weighted");
  const forcedPity = table.pityAfter !== null && pityMisses >= table.pityAfter - 1;
  const selectionPool = forcedPity ? weighted.filter((entry) => entry.pityEligible) : weighted;
  const selected = selectWeightedEntry(selectionPool, rng);

  const rewards = [
    ...guaranteed.map((entry) => rewardForEntry(entry, rng)),
    rewardForEntry(selected, rng),
  ];
  const pityAfter = table.pityAfter === null
    ? 0
    : selected.pityEligible
      ? 0
      : checkedAdd(pityMisses, 1, "pity misses");

  return {
    tableId: table.tableId,
    tableVersion: table.version,
    pityGroup: table.pityGroup,
    pityBefore: pityMisses,
    pityAfter,
    forcedPity,
    rewards,
    proof: {
      version: 1,
      seedCommitment: createHash("sha256").update(serverSeed).digest("hex"),
      draws: rng.evidence,
    },
  };
}

export function validateLootTable(table: LootTable): void {
  assertBoundedText(table.tableId, "tableId", 128);
  assertPositiveSafeInteger(table.version, "version");
  assertBoundedText(table.pityGroup, "pityGroup", 128);
  if (table.pityAfter !== null) assertPositiveSafeInteger(table.pityAfter, "pityAfter");
  if (table.entries.length < 1 || table.entries.length > MAX_ENTRIES) {
    throw new RangeError(`loot table must contain between 1 and ${MAX_ENTRIES} entries`);
  }

  const entryIds = new Set<string>();
  let totalWeight = 0;
  let weightedEntries = 0;
  let pityEligibleEntries = 0;

  for (const entry of table.entries) {
    assertBoundedText(entry.entryId, "entryId", 128);
    assertBoundedText(entry.itemId, "itemId", 128);
    assertPositiveSafeInteger(entry.itemVersion, "itemVersion");
    assertPositiveSafeInteger(entry.minQuantity, "minQuantity");
    assertPositiveSafeInteger(entry.maxQuantity, "maxQuantity");
    if (entry.maxQuantity < entry.minQuantity) {
      throw new RangeError("maxQuantity must be greater than or equal to minQuantity");
    }
    if (entryIds.has(entry.entryId)) throw new RangeError(`duplicate loot entry id: ${entry.entryId}`);
    entryIds.add(entry.entryId);

    if (entry.kind === "weighted") {
      assertPositiveSafeInteger(entry.weight, "weight");
      totalWeight = checkedAdd(totalWeight, entry.weight, "total loot weight");
      weightedEntries += 1;
      if (entry.pityEligible) pityEligibleEntries += 1;
    } else if (entry.kind === "guaranteed") {
      if (entry.weight !== 0) throw new RangeError("guaranteed entries must have zero weight");
      if (entry.pityEligible) throw new RangeError("guaranteed entries cannot reset weighted pity state");
    } else {
      throw new RangeError("unsupported loot entry kind");
    }
  }

  if (weightedEntries < 1) throw new RangeError("loot table must contain at least one weighted entry");
  if (totalWeight < 1) throw new RangeError("loot table total weight must be positive");
  if (table.pityAfter !== null && pityEligibleEntries < 1) {
    throw new RangeError("pity-enabled loot table must contain a pity-eligible weighted entry");
  }
}

function selectWeightedEntry(entries: readonly LootEntry[], rng: AuditedLootRng): LootEntry {
  if (entries.length < 1) throw new RangeError("weighted selection pool cannot be empty");
  const totalWeight = entries.reduce(
    (total, entry) => checkedAdd(total, entry.weight, "selection pool weight"),
    0,
  );
  const sample = rng.nextInt(totalWeight, "weighted-entry");
  let cumulative = 0;
  for (const entry of entries) {
    cumulative = checkedAdd(cumulative, entry.weight, "cumulative loot weight");
    if (sample < cumulative) return entry;
  }
  throw new Error("weighted loot selection did not resolve an entry");
}

function rewardForEntry(entry: LootEntry, rng: AuditedLootRng): LootReward {
  const range = entry.maxQuantity - entry.minQuantity + 1;
  if (!Number.isSafeInteger(range) || range < 1) throw new RangeError("loot quantity range is invalid");
  const quantity = range === 1
    ? entry.minQuantity
    : entry.minQuantity + rng.nextInt(range, `quantity:${entry.entryId}`);
  return {
    entryId: entry.entryId,
    itemId: entry.itemId,
    itemVersion: entry.itemVersion,
    kind: entry.kind,
    quantity,
  };
}

class AuditedLootRng {
  private counter = 0;
  private readonly draws: LootDrawEvidence[] = [];

  public constructor(private readonly seed: Buffer) {}

  public get evidence(): readonly LootDrawEvidence[] {
    return this.draws;
  }

  public nextInt(bound: number, purpose: string): number {
    assertPositiveSafeInteger(bound, "RNG bound");
    assertBoundedText(purpose, "RNG purpose", 160);
    const bigBound = BigInt(bound);
    const acceptanceLimit = UINT64_RANGE - (UINT64_RANGE % bigBound);
    let rejectedBlocks = 0;

    while (true) {
      if (!Number.isSafeInteger(this.counter)) throw new RangeError("loot RNG counter exhausted");
      const counter = this.counter;
      const counterBytes = Buffer.allocUnsafe(8);
      counterBytes.writeBigUInt64BE(BigInt(counter));
      const block = createHmac("sha256", this.seed)
        .update(RNG_DOMAIN)
        .update(counterBytes)
        .digest();
      this.counter += 1;
      const raw = block.readBigUInt64BE(0);
      if (raw >= acceptanceLimit) {
        rejectedBlocks += 1;
        continue;
      }
      const value = Number(raw % bigBound);
      this.draws.push({ purpose, counter, bound, value, rejectedBlocks });
      return value;
    }
  }
}

function checkedAdd(left: number, right: number, name: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) throw new RangeError(`${name} exceeds the safe integer range`);
  return result;
}

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function assertBoundedText(value: string, name: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain between 1 and ${maximumLength} characters`);
  }
}
