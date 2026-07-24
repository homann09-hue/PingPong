import { createHash } from "node:crypto";

export type LootEntitlementStatus = "available" | "consumed" | "expired" | "revoked";

export interface IssueLootEntitlementCommand {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly tableId: string;
  readonly source: string;
  readonly referenceId: string;
  readonly expiresAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LootEntitlementResult {
  readonly entitlementId: string;
  readonly tableId: string;
  readonly tableVersion: number;
  readonly source: string;
  readonly referenceId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly status: LootEntitlementStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly replayed: boolean;
}

export class LootEntitlementPlayerNotFoundError extends Error {
  public constructor() {
    super("Loot entitlement player was not found");
    this.name = "LootEntitlementPlayerNotFoundError";
  }
}

export class LootEntitlementTableNotFoundError extends Error {
  public constructor() {
    super("Active loot table was not found for entitlement issuance");
    this.name = "LootEntitlementTableNotFoundError";
  }
}

export class LootEntitlementIdempotencyConflictError extends Error {
  public constructor() {
    super("Loot entitlement idempotency key was already used for another request");
    this.name = "LootEntitlementIdempotencyConflictError";
  }
}

export class LootEntitlementSourceConflictError extends Error {
  public constructor() {
    super("Loot entitlement source reference was already used for another request");
    this.name = "LootEntitlementSourceConflictError";
  }
}

export function validateIssueLootEntitlementCommand(command: IssueLootEntitlementCommand, now: Date): void {
  assertUuid(command.playerId, "playerId");
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
  assertBoundedText(command.tableId, "tableId", 128);
  assertBoundedText(command.source, "source", 100);
  assertBoundedText(command.referenceId, "referenceId", 200);
  assertValidDate(command.expiresAt, "expiresAt");
  assertValidDate(now, "now");
  if (command.expiresAt.getTime() <= now.getTime()) throw new RangeError("expiresAt must be in the future");
  canonicalLootJson(command.metadata ?? {});
}

export function lootEntitlementRequestHash(command: IssueLootEntitlementCommand): Buffer {
  return createHash("sha256").update(canonicalLootJson({
    playerId: command.playerId,
    tableId: command.tableId,
    source: command.source,
    referenceId: command.referenceId,
    expiresAt: command.expiresAt.toISOString(),
    metadata: command.metadata ?? {},
  })).digest();
}

export function canonicalLootJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Loot metadata numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalLootJson(entry)).join(",")}]`;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Loot metadata must contain only JSON-compatible values");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => {
      const entry = record[key];
      if (entry === undefined) throw new TypeError("Loot metadata cannot contain undefined values");
      return `${JSON.stringify(key)}:${canonicalLootJson(entry)}`;
    }).join(",")}}`;
  }
  throw new TypeError("Loot metadata must contain only JSON-compatible values");
}

export function assertLootUuid(value: string, name: string): void {
  assertUuid(value, name);
}

export function assertLootDate(value: Date, name: string): void {
  assertValidDate(value, name);
}

function assertUuid(value: string, name: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RangeError(`${name} must be a UUID`);
  }
}

function assertBoundedText(value: string, name: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain between 1 and ${maximumLength} characters`);
  }
}

function assertValidDate(value: Date, name: string): void {
  if (!Number.isFinite(value.getTime())) throw new RangeError(`${name} must be a valid date`);
}
