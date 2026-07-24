import { randomUUID, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AchievementCategory, AchievementMetric, AchievementTier, AchievementView } from "./achievement-system.js";
import {
  AchievementAlreadyClaimedError,
  AchievementIdempotencyConflictError,
  AchievementNotClaimableError,
  AchievementNotFoundError,
  AchievementPlayerNotFoundError,
  achievementClaimRequestHash,
  assertValidAchievementDate,
  validateAchievementBackfill,
  validateClaimAchievementCommand,
  type AchievementBackfillResult,
  type AchievementClaimResult,
  type AchievementStore,
  type ClaimAchievementCommand,
} from "./achievement-store.js";

interface DefinitionRow {
  readonly achievement_id: string;
  readonly version: number;
  readonly category: AchievementCategory;
  readonly tier: AchievementTier;
  readonly name: string;
  readonly description: string;
  readonly metric: AchievementMetric;
  readonly target: string;
  readonly reward_coins: string;
  readonly prerequisite_achievement_id: string | null;
  readonly prerequisite_version: number | null;
}

interface ProgressRow {
  readonly progress: string;
  readonly completed_at: Date | null;
  readonly completion_evidence: unknown;
}

interface ClaimReplayRow {
  readonly request_hash: Buffer;
  readonly result: AchievementClaimResult;
}

interface AchievementViewRow extends DefinitionRow {
  readonly progress: string;
  readonly completed: boolean;
  readonly claimed: boolean;
  readonly unlocked: boolean;
}

/** PostgreSQL implementation for versioned progress, evidence, and exactly-once claims. */
export class PostgresAchievementStore implements AchievementStore {
  public constructor(private readonly pool: Pool) {}

  public static connect(connectionString: string): PostgresAchievementStore {
    return new PostgresAchievementStore(new Pool({ connectionString, max: 20, idleTimeoutMillis: 30_000 }));
  }

  public async list(playerId: string, now: Date): Promise<readonly AchievementView[]> {
    assertUuid(playerId, "playerId");
    assertValidAchievementDate(now, "now");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1", [playerId]);
      if (player.rowCount !== 1) throw new AchievementPlayerNotFoundError();
      await client.query("SELECT backfill_player_achievement_progress($1,$2)", [playerId, now]);
      const result = await client.query<AchievementViewRow>(
        `SELECT definition.achievement_id,definition.version,definition.category,definition.tier,
                definition.name,definition.description,definition.metric,definition.target,
                definition.reward_coins,definition.prerequisite_achievement_id,definition.prerequisite_version,
                COALESCE(progress.progress,0) AS progress,
                progress.completed_at IS NOT NULL AS completed,
                claim.id IS NOT NULL AS claimed,
                definition.prerequisite_achievement_id IS NULL OR prerequisite_claim.id IS NOT NULL AS unlocked
           FROM achievement_definition_versions definition
           LEFT JOIN player_achievement_progress progress
             ON progress.player_id=$1
            AND progress.achievement_id=definition.achievement_id
            AND progress.achievement_version=definition.version
           LEFT JOIN achievement_claims_v1 claim
             ON claim.player_id=$1 AND claim.achievement_id=definition.achievement_id
           LEFT JOIN achievement_claims_v1 prerequisite_claim
             ON prerequisite_claim.player_id=$1
            AND prerequisite_claim.achievement_id=definition.prerequisite_achievement_id
          WHERE definition.active=true
            AND definition.published_at IS NOT NULL
            AND definition.published_at <= $2
          ORDER BY CASE definition.category
                     WHEN 'journey' THEN 1 WHEN 'spins' THEN 2 WHEN 'wins' THEN 3
                     WHEN 'free_spins' THEN 4 ELSE 5 END,
                   CASE definition.tier WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END`,
        [playerId, now],
      );
      await client.query("COMMIT");
      return result.rows.map(rowToView);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async claim(command: ClaimAchievementCommand, now: Date): Promise<AchievementClaimResult> {
    validateClaimAchievementCommand(command);
    assertValidAchievementDate(now, "now");
    const requestHash = achievementClaimRequestHash(command);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new AchievementPlayerNotFoundError();

      const replay = await readReplay(client, command, requestHash);
      if (replay !== null) {
        await client.query("COMMIT");
        return replay;
      }

      await client.query("SELECT backfill_player_achievement_progress($1,$2)", [command.playerId, now]);
      const definitionResult = await client.query<DefinitionRow>(
        `SELECT achievement_id,version,category,tier,name,description,metric,target,reward_coins,
                prerequisite_achievement_id,prerequisite_version
           FROM achievement_definition_versions
          WHERE achievement_id=$1 AND active=true
            AND published_at IS NOT NULL AND published_at <= $2
          FOR SHARE`,
        [command.achievementId, now],
      );
      const definition = definitionResult.rows[0];
      if (!definition) throw new AchievementNotFoundError();

      const priorClaim = await client.query(
        "SELECT 1 FROM achievement_claims_v1 WHERE player_id=$1 AND achievement_id=$2",
        [command.playerId, command.achievementId],
      );
      if (priorClaim.rowCount) throw new AchievementAlreadyClaimedError();

      const progressResult = await client.query<ProgressRow>(
        `SELECT progress,completed_at,completion_evidence
           FROM player_achievement_progress
          WHERE player_id=$1 AND achievement_id=$2 AND achievement_version=$3
          FOR UPDATE`,
        [command.playerId, definition.achievement_id, definition.version],
      );
      const progressRow = progressResult.rows[0];
      const progress = progressRow ? toSafeInteger(progressRow.progress, "achievement progress") : 0;
      const target = toSafeInteger(definition.target, "achievement target");
      if (!progressRow?.completed_at || progress < target || !isRecord(progressRow.completion_evidence)) {
        throw new AchievementNotClaimableError();
      }

      if (definition.prerequisite_achievement_id !== null) {
        const prerequisite = await client.query(
          "SELECT 1 FROM achievement_claims_v1 WHERE player_id=$1 AND achievement_id=$2",
          [command.playerId, definition.prerequisite_achievement_id],
        );
        if (!prerequisite.rowCount) throw new AchievementNotClaimableError();
      }

      const wallet = await client.query<{ readonly balance: string }>(
        "SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin' FOR UPDATE",
        [command.playerId],
      );
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");
      const coinBefore = toSafeInteger(wallet.rows[0].balance, "achievement coin balance");
      const coins = toSafeInteger(definition.reward_coins, "achievement reward coins");
      if (!Number.isSafeInteger(coinBefore + coins)) throw new RangeError("Achievement coin balance exceeds safe integer range");
      const claimId = randomUUID();
      const coinBalance = coinBefore + coins;
      const completionEvidence = progressRow.completion_evidence;
      const result: AchievementClaimResult = {
        claimId,
        achievementId: definition.achievement_id,
        achievementVersion: definition.version,
        coins,
        coinBalance,
        progress,
        completionEvidence,
        replayed: false,
      };

      if (coins > 0) {
        await client.query(
          "UPDATE wallets SET balance=$1,version=version+1 WHERE player_id=$2 AND currency='coin'",
          [coinBalance, command.playerId],
        );
        await client.query(
          `INSERT INTO wallet_ledger
             (id,player_id,currency,amount,reason,source,reference_id,idempotency_key,
              balance_before,balance_after,metadata)
           VALUES ($1,$2,'coin',$3,'achievement_reward','achievement',$1,$4,$5,$6,$7::jsonb)`,
          [claimId, command.playerId, coins, `achievement:${definition.achievement_id}:v${definition.version}`,
            coinBefore, coinBalance, JSON.stringify({
              achievementId: definition.achievement_id,
              achievementVersion: definition.version,
              progress,
              target,
            })],
        );
      }

      await client.query(
        `INSERT INTO achievement_claims_v1
           (id,player_id,achievement_id,achievement_version,idempotency_key,request_hash,
            progress_at_claim,completion_evidence,reward_coins,coin_balance_after,result,claimed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12)`,
        [claimId, command.playerId, definition.achievement_id, definition.version,
          command.idempotencyKey, requestHash, progress, JSON.stringify(completionEvidence), coins,
          coinBalance, JSON.stringify(result), now],
      );
      await client.query(
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'achievement',$2,'achievement.claimed',$3::jsonb)`,
        [randomUUID(), claimId, JSON.stringify({ playerId: command.playerId, result })],
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") {
        throw new AchievementAlreadyClaimedError();
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async backfillBatch(
    afterPlayerId: string | null,
    limit: number,
    now: Date,
  ): Promise<AchievementBackfillResult> {
    validateAchievementBackfill(afterPlayerId, limit, now);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const players = await client.query<{ readonly id: string }>(
        `SELECT id FROM players
          WHERE ($1::uuid IS NULL OR id > $1::uuid)
          ORDER BY id
          LIMIT $2`,
        [afterPlayerId, limit + 1],
      );
      const selected = players.rows.slice(0, limit);
      for (const player of selected) {
        await client.query("SELECT backfill_player_achievement_progress($1,$2)", [player.id, now]);
      }
      await client.query("COMMIT");
      return {
        processed: selected.length,
        nextPlayerId: players.rows.length > limit ? selected[selected.length - 1]?.id ?? null : null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

async function readReplay(
  client: PoolClient,
  command: ClaimAchievementCommand,
  requestHash: Buffer,
): Promise<AchievementClaimResult | null> {
  const existing = await client.query<ClaimReplayRow>(
    "SELECT request_hash,result FROM achievement_claims_v1 WHERE player_id=$1 AND idempotency_key=$2",
    [command.playerId, command.idempotencyKey],
  );
  const row = existing.rows[0];
  if (!row) return null;
  if (row.request_hash.length !== requestHash.length || !timingSafeEqual(row.request_hash, requestHash)) {
    throw new AchievementIdempotencyConflictError();
  }
  return { ...row.result, replayed: true };
}

function rowToView(row: AchievementViewRow): AchievementView {
  return {
    id: row.achievement_id,
    version: row.version,
    category: row.category,
    tier: row.tier,
    name: row.name,
    description: row.description,
    metric: row.metric,
    target: toSafeInteger(row.target, "achievement target"),
    coins: toSafeInteger(row.reward_coins, "achievement reward coins"),
    ...(row.prerequisite_achievement_id === null ? {} : { prerequisiteId: row.prerequisite_achievement_id }),
    rewardId: row.achievement_id,
    progress: toSafeInteger(row.progress, "achievement progress"),
    completed: row.completed,
    claimed: row.claimed,
    unlocked: row.unlocked,
  };
}

function toSafeInteger(value: string | number, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  return parsed;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertUuid(value: string, name: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RangeError(`${name} must be a UUID`);
  }
}
