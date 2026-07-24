import { createHash } from "node:crypto";
import type { LootDrawEvidence } from "./loot-engine.js";
import { assertLootUuid, canonicalLootJson } from "./loot-entitlement.js";

export interface OpenLootCommand {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly entitlementId: string;
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
  readonly entitlementId: string;
  readonly tableId: string;
  readonly tableVersion: number;
  readonly source: string;
  readonly referenceId: string;
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
    super("Entitlement-bound loot table version was not found");
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

export class LootEntitlementNotFoundError extends Error {
  public constructor() {
    super("Loot entitlement was not found for this player");
    this.name = "LootEntitlementNotFoundError";
  }
}

export class LootEntitlementNotAvailableError extends Error {
  public constructor() {
    super("Loot entitlement is not available");
    this.name = "LootEntitlementNotAvailableError";
  }
}

export class LootEntitlementExpiredError extends Error {
  public constructor() {
    super("Loot entitlement has expired");
    this.name = "LootEntitlementExpiredError";
  }
}

export function validateOpenLootCommand(command: OpenLootCommand): void {
  assertLootUuid(command.playerId, "playerId");
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
  assertLootUuid(command.entitlementId, "entitlementId");
}

export function lootOpeningRequestHash(command: OpenLootCommand): Buffer {
  validateOpenLootCommand(command);
  return createHash("sha256").update(canonicalLootJson({
    playerId: command.playerId,
    entitlementId: command.entitlementId,
  })).digest();
}

function assertBoundedText(value: string, name: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain between 1 and ${maximumLength} characters`);
  }
}
