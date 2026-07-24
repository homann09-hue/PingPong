import { timingSafeEqual } from "node:crypto";
import type { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { RewardAlreadyClaimedError } from "../spins/spin-store.js";
import { achievementById, achievementViews, canClaimAchievement } from "./achievement-system.js";
import {
  AchievementAlreadyClaimedError,
  AchievementIdempotencyConflictError,
  AchievementNotClaimableError,
  AchievementNotFoundError,
  achievementClaimRequestHash,
  assertValidAchievementDate,
  validateAchievementBackfill,
  validateClaimAchievementCommand,
  type AchievementBackfillResult,
  type AchievementClaimResult,
  type AchievementStore,
  type ClaimAchievementCommand,
} from "./achievement-store.js";

interface ReplayEntry {
  readonly requestHash: Buffer;
  readonly result: AchievementClaimResult;
}

/** Demo adapter that preserves the production contract while reusing the local spin wallet. */
export class InMemoryAchievementStore implements AchievementStore {
  private readonly replays = new Map<string, ReplayEntry>();
  private readonly playerQueues = new Map<string, Promise<void>>();

  public constructor(private readonly spinStore: InMemorySpinStore) {}

  public async list(playerId: string, now: Date) {
    assertValidAchievementDate(now, "now");
    const profile = await this.spinStore.getProfile(playerId);
    return achievementViews(profile.progression, new Set(profile.claimedRewards));
  }

  public async claim(command: ClaimAchievementCommand, now: Date): Promise<AchievementClaimResult> {
    validateClaimAchievementCommand(command);
    assertValidAchievementDate(now, "now");
    return this.serialized(command.playerId, async () => {
      const requestHash = achievementClaimRequestHash(command);
      const replayKey = `${command.playerId}:${command.idempotencyKey}`;
      const replay = this.replays.get(replayKey);
      if (replay) {
        if (replay.requestHash.length !== requestHash.length || !timingSafeEqual(replay.requestHash, requestHash)) {
          throw new AchievementIdempotencyConflictError();
        }
        return { ...replay.result, replayed: true };
      }

      const definition = achievementById(command.achievementId);
      if (!definition) throw new AchievementNotFoundError();
      const profile = await this.spinStore.getProfile(command.playerId);
      const claimed = new Set(profile.claimedRewards);
      if (!canClaimAchievement(definition, profile.progression, claimed)) {
        throw new AchievementNotClaimableError();
      }
      const progress = metricProgress(definition.metric, profile.progression);
      const completionEvidence = {
        sourceType: "demo_snapshot",
        sourceId: command.idempotencyKey,
        occurredAt: now.toISOString(),
        metric: definition.metric,
        progress,
        progression: profile.progression,
      };
      try {
        const reward = await this.spinStore.claimReward(command.playerId, definition.id, definition.coins);
        const result: AchievementClaimResult = {
          claimId: `demo:${command.playerId}:${definition.id}`,
          achievementId: definition.id,
          achievementVersion: definition.version,
          coins: reward.coins,
          coinBalance: reward.coinBalance,
          lootEntitlement: null,
          progress,
          completionEvidence,
          replayed: false,
        };
        this.replays.set(replayKey, { requestHash, result });
        return result;
      } catch (error) {
        if (error instanceof RewardAlreadyClaimedError) throw new AchievementAlreadyClaimedError();
        throw error;
      }
    });
  }

  public async backfillBatch(
    afterPlayerId: string | null,
    limit: number,
    now: Date,
  ): Promise<AchievementBackfillResult> {
    validateAchievementBackfill(afterPlayerId, limit, now);
    return { processed: 0, nextPlayerId: null };
  }

  public async close(): Promise<void> {}

  private async serialized<T>(playerId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.playerQueues.get(playerId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    this.playerQueues.set(playerId, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.playerQueues.get(playerId) === tail) this.playerQueues.delete(playerId);
    }
  }
}

function metricProgress(
  metric: "level" | "spins" | "total_won" | "free_spins" | "vip_points",
  progression: { readonly level: number; readonly spins: number; readonly totalWon: number; readonly freeSpins: number; readonly vipPoints: number },
): number {
  switch (metric) {
    case "level": return progression.level;
    case "spins": return progression.spins;
    case "total_won": return progression.totalWon;
    case "free_spins": return progression.freeSpins;
    case "vip_points": return progression.vipPoints;
  }
}
