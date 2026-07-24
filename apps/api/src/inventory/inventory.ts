import { createHash } from "node:crypto";

export const inventoryCategories = [
  "booster", "ticket", "chest", "key", "collectible", "cosmetic", "pet", "event_item",
] as const;

export const inventoryRarities = ["common", "rare", "epic", "legendary", "mythic"] as const;

export type InventoryCategory = typeof inventoryCategories[number];
export type InventoryRarity = typeof inventoryRarities[number];
export type InventoryMetadata = Readonly<Record<string, unknown>>;

export interface InventoryItemDefinition {
  readonly itemId: string;
  readonly version: number;
  readonly category: InventoryCategory;
  readonly rarity: InventoryRarity;
  readonly maxStack: number;
  readonly tradable: boolean;
  readonly active: boolean;
  readonly metadata: InventoryMetadata;
}

export interface InventoryStackView {
  readonly stackId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly quantity: number;
  readonly maxStack: number;
  readonly stackIndex: number;
  readonly expiresAt: string | null;
  readonly eventId: string | null;
  readonly acquiredAt: string;
  readonly updatedAt: string;
}

export interface InventoryMutationContext {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly source: string;
  readonly referenceId: string;
  readonly metadata?: InventoryMetadata;
}

export interface GrantInventoryCommand extends InventoryMutationContext {
  readonly operationType: "grant";
  readonly itemId: string;
  readonly itemVersion: number;
  readonly quantity: number;
  readonly expiresAt: Date | null;
  readonly eventId: string | null;
}

export interface ConsumeInventoryCommand extends InventoryMutationContext {
  readonly operationType: "consume";
  readonly itemId: string;
  readonly itemVersion: number;
  readonly quantity: number;
  readonly eventId: string | null;
}

export type InventoryMutationCommand = GrantInventoryCommand | ConsumeInventoryCommand;

export interface InventoryMutationResult {
  readonly operationId: string;
  readonly operationType: "grant" | "consume";
  readonly itemId: string;
  readonly itemVersion: number;
  readonly quantity: number;
  readonly remainingQuantity: number;
  readonly changedStacks: readonly InventoryStackView[];
  readonly replayed: boolean;
}

export class InventoryItemNotFoundError extends Error {
  public constructor() {
    super("Inventory item definition was not found or is inactive");
    this.name = "InventoryItemNotFoundError";
  }
}

export class InventoryInsufficientQuantityError extends Error {
  public constructor() {
    super("Inventory quantity is insufficient");
    this.name = "InventoryInsufficientQuantityError";
  }
}

export class InventoryIdempotencyConflictError extends Error {
  public constructor() {
    super("Inventory idempotency key was already used for a different request");
    this.name = "InventoryIdempotencyConflictError";
  }
}

export function validateInventoryMutation(command: InventoryMutationCommand): void {
  assertBoundedText(command.playerId, "playerId", 128);
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
  assertBoundedText(command.reason, "reason", 100);
  assertBoundedText(command.source, "source", 100);
  assertBoundedText(command.referenceId, "referenceId", 200);
  assertBoundedText(command.itemId, "itemId", 128);
  assertPositiveSafeInteger(command.itemVersion, "itemVersion");
  assertPositiveSafeInteger(command.quantity, "quantity");

  if (command.eventId !== null) assertBoundedText(command.eventId, "eventId", 128);
  if (command.operationType === "grant" && command.expiresAt !== null) {
    if (!Number.isFinite(command.expiresAt.getTime())) throw new RangeError("expiresAt must be a valid date");
  }

  canonicalJson(command.metadata ?? {});
}

export function inventoryRequestHash(command: InventoryMutationCommand): Buffer {
  validateInventoryMutation(command);
  const normalized = command.operationType === "grant"
    ? {
        operationType: command.operationType,
        playerId: command.playerId,
        itemId: command.itemId,
        itemVersion: command.itemVersion,
        quantity: command.quantity,
        expiresAt: command.expiresAt?.toISOString() ?? null,
        eventId: command.eventId,
        reason: command.reason,
        source: command.source,
        referenceId: command.referenceId,
        metadata: command.metadata ?? {},
      }
    : {
        operationType: command.operationType,
        playerId: command.playerId,
        itemId: command.itemId,
        itemVersion: command.itemVersion,
        quantity: command.quantity,
        eventId: command.eventId,
        reason: command.reason,
        source: command.source,
        referenceId: command.referenceId,
        metadata: command.metadata ?? {},
      };

  return createHash("sha256").update(canonicalJson(normalized)).digest();
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

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Inventory metadata numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Inventory metadata must contain only JSON-compatible values");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => {
      const entry = record[key];
      if (entry === undefined) throw new TypeError("Inventory metadata cannot contain undefined values");
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    }).join(",")}}`;
  }
  throw new TypeError("Inventory metadata must contain only JSON-compatible values");
}
