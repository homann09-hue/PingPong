import { createHash } from "node:crypto";
import type { LootDrawEvidence } from "./loot-engine.js";

export interface OpenLootCommand {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly tableId: string;
  readonly source: string;
  readonly referenceId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LootOpeningReward {
  readonly entryId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly quantity: number;
  readonly inventoryOperationId: string;
}

export interface LootOpeningResult {
  readonly openingId: string;
  readonly tableId: string;
  readonly tableVersion: number;
  readonly pityGroup: string;
  readonly pityBefore: number;
  readonly pityAfter: number;
  readonly forcedPity: boolean;
  readonly rewards: readonly LootOpeningReward[];
  readonly proof: {
    readonly version: 1;
    readonly seedCommitment: string;
    readonly draws: readonly LootDrawEvidence[];
  };
  readonly replayed: boolean;
}

export class LootTableNotFoundError extends Error {
  public constructor() {
    super("Active loot table was not found");
    this.name = "LootTableNotFoundError";
  }
}

export class LootIdempotencyConflictError extends Error {
  public constructor() {
    super("Loot idempotency key was already used for a different request");
    this.name = "LootIdempotencyConflictError";
  }
}

export class LootPlayerNotFoundError extends Error {
  public constructor() {
    super("Loot player was not found");
    this.name = "LootPlayerNotFoundError";
  }
}

export function validateOpenLootCommand(command: OpenLootCommand): void {
  assertBoundedText(command.playerId, "playerId", 128);
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
  assertBoundedText(command.tableId, "tableId", 128);
  assertBoundedText(command.source, "source", 100);
  assertBoundedText(command.referenceId, "referenceId", 200);
  canonicalJson(command.metadata ?? {});
}

export function lootOpeningRequestHash(command: OpenLootCommand): Buffer {
  validateOpenLootCommand(command);
  return createHash("sha256").update(canonicalJson({
    playerId: command.playerId,
    tableId: command.tableId,
    source: command.source,
    referenceId: command.referenceId,
    metadata: command.metadata ?? {},
  })).digest();
}

function assertBoundedText(value: string, name: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain between 1 and ${maximumLength} characters`);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Loot metadata numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Loot metadata must contain only JSON-compatible values");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => {
      const entry = record[key];
      if (entry === undefined) throw new TypeError("Loot metadata cannot contain undefined values");
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    }).join(",")}}`;
  }
  throw new TypeError("Loot metadata must contain only JSON-compatible values");
}
