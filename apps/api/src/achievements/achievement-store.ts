import { createHash } from "node:crypto";
import type { AchievementView } from "./achievement-system.js";

export interface ClaimAchievementCommand {
  readonly playerId: string;
  readonly achievementId: string;
  readonly idempotencyKey: string;
}

export interface AchievementClaimResult {
  readonly claimId: string;
  readonly achievementId: string;
  readonly achievementVersion: number;
  readonly coins: number;
  readonly coinBalance: number;
  readonly progress: number;
  readonly completionEvidence: Readonly<Record<string, unknown>>;
  readonly replayed: boolean;
}

export interface AchievementBackfillResult {
  readonly processed: number;
  readonly nextPlayerId: string | null;
}

export interface AchievementStore {
  list(playerId: string, now: Date): Promise<readonly AchievementView[]>;
  claim(command: ClaimAchievementCommand, now: Date): Promise<AchievementClaimResult>;
  backfillBatch(afterPlayerId: string | null, limit: number, now: Date): Promise<AchievementBackfillResult>;
  close(): Promise<void>;
}

export class AchievementNotFoundError extends Error {
  public constructor() {
    super("Active achievement definition was not found");
    this.name = "AchievementNotFoundError";
  }
}

export class AchievementNotClaimableError extends Error {
  public constructor() {
    super("Achievement is incomplete or its prerequisite is not claimed");
    this.name = "AchievementNotClaimableError";
  }
}

export class AchievementAlreadyClaimedError extends Error {
  public constructor() {
    super("Achievement was already claimed");
    this.name = "AchievementAlreadyClaimedError";
  }
}

export class AchievementIdempotencyConflictError extends Error {
  public constructor() {
    super("Achievement idempotency key was already used for another request");
    this.name = "AchievementIdempotencyConflictError";
  }
}

export class AchievementPlayerNotFoundError extends Error {
  public constructor() {
    super("Achievement player was not found");
    this.name = "AchievementPlayerNotFoundError";
  }
}

export function validateClaimAchievementCommand(command: ClaimAchievementCommand): void {
  assertUuid(command.playerId, "playerId");
  assertBoundedSlug(command.achievementId, "achievementId", 128);
  assertBoundedText(command.idempotencyKey, "idempotencyKey", 200);
}

export function achievementClaimRequestHash(command: ClaimAchievementCommand): Buffer {
  validateClaimAchievementCommand(command);
  return createHash("sha256").update(JSON.stringify({
    playerId: command.playerId,
    achievementId: command.achievementId,
  })).digest();
}

export function validateAchievementBackfill(
  afterPlayerId: string | null,
  limit: number,
  now: Date,
): void {
  if (afterPlayerId !== null) assertUuid(afterPlayerId, "afterPlayerId");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new RangeError("limit must be a safe integer between 1 and 1000");
  }
  assertValidDate(now, "now");
}

export function assertValidAchievementDate(value: Date, name: string): void {
  assertValidDate(value, name);
}

function assertUuid(value: string, name: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RangeError(`${name} must be a UUID`);
  }
}

function assertBoundedSlug(value: string, name: string, maximumLength: number): void {
  if (value.length < 3 || value.length > maximumLength || !/^[a-z0-9-]+$/.test(value)) {
    throw new RangeError(`${name} must be a lowercase slug between 3 and ${maximumLength} characters`);
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
