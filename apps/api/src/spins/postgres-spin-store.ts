import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { SpinResult } from "@aurora/slot-engine";
import type { EventMilestoneClaim, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, SettleSpinCommand, SettledSpin, ShopPurchase, SpinStore, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";
import { EventMilestoneNotClaimableError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, WheelNotAvailableError } from "./spin-store.js";
import { nextRewardState, rewardStatus, type TimedRewardState } from "../rewards/timed-rewards.js";
import { selectWheelSegment, standardWheel } from "../rewards/bonus-wheel.js";
import { eventIncrement, eventWindow, liveEventDefinitions } from "../events/live-events.js";
import { activeTournamentDefinition, tournamentPoints, tournamentWindow } from "../tournaments/tournaments.js";
import { applyProgressiveAward, jackpotContribution, jackpotDefinitions, triggeredJackpotTier, type JackpotPoolView, type JackpotTier } from "../jackpots/progressive-jackpots.js";
import type { ShopOffer } from "../shop/shop-catalog.js";

interface ReplayRow { result: SpinResult; balance_after: string; progression_after: PlayerProgression }
interface WalletRow { balance: string }
interface PlayerRow { level: number; xp: string; vip_points: string }
interface WalletTransactionRow {
  id: string;
  currency: "coin" | "gem";
  amount: string;
  reason: string;
  source: string;
  reference_id: string;
  balance_before: string;
  balance_after: string;
  created_at: Date;
}
interface TimedRewardRow { level: number; last_claimed_at: Date | null; streak: number; cycle_position: number; claims_toward_wheel: number }

/** Atomically settles wagers, wins, ledger entries, spin audit and outbox event. */
export class PostgresSpinStore implements SpinStore {
  public constructor(private readonly pool: Pool) {}

  public static connect(connectionString: string): PostgresSpinStore {
    return new PostgresSpinStore(new Pool({ connectionString, max: 20, idleTimeoutMillis: 30_000 }));
  }

  public async settle(command: SettleSpinCommand, calculate: () => SpinResult): Promise<SettledSpin> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const wallet = await client.query<WalletRow>(
        "SELECT balance FROM wallets WHERE player_id = $1 AND currency = 'coin' FOR UPDATE", [command.playerId],
      );
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");

      const replay = await this.findReplay(client, command);
      if (replay) { await client.query("COMMIT"); return replay; }
      const balance = Number(wallet.rows[0].balance);
      if (!Number.isSafeInteger(balance)) throw new Error("Wallet balance exceeds API safe integer range");
      if (balance < command.bet) throw new InsufficientFundsError();

      let spin = calculate();
      const pools = await client.query<{ tier: JackpotTier; pool_amount: string; seed_amount: string }>(
        "SELECT tier, pool_amount, seed_amount FROM progressive_jackpots ORDER BY tier FOR UPDATE",
      );
      if (pools.rows.length !== jackpotDefinitions.length) throw new Error("Progressive jackpot pools are not initialized");
      const updatedPools = new Map<JackpotTier, { amount: number; seedAmount: number }>();
      for (const pool of pools.rows) {
        const contribution = jackpotContribution(pool.tier, command.bet);
        const updated = await client.query<{ pool_amount: string }>(
          `UPDATE progressive_jackpots
              SET pool_amount=pool_amount+$1, version=version+1, updated_at=now()
            WHERE tier=$2 RETURNING pool_amount`,
          [contribution, pool.tier],
        );
        updatedPools.set(pool.tier, {
          amount: this.safeInteger(updated.rows[0]!.pool_amount, "Jackpot pool"),
          seedAmount: this.safeInteger(pool.seed_amount, "Jackpot seed"),
        });
      }
      const triggeredTier = triggeredJackpotTier(spin);
      if (triggeredTier) {
        const pool = updatedPools.get(triggeredTier);
        if (!pool) throw new Error("Triggered jackpot pool does not exist");
        spin = applyProgressiveAward(spin, triggeredTier, pool.amount);
        await client.query(
          "UPDATE progressive_jackpots SET pool_amount=seed_amount, version=version+1, updated_at=now() WHERE tier=$1",
          [triggeredTier],
        );
      }
      const balanceAfter = balance - command.bet + spin.totalWin;
      const playerResult = await client.query<PlayerRow>(
        "SELECT level, xp, vip_points FROM players WHERE id = $1 FOR UPDATE", [command.playerId],
      );
      if (!playerResult.rows[0]) throw new Error("Player does not exist");
      const previousXp = Number(playerResult.rows[0].xp);
      const accumulatedXp = previousXp + Math.max(10, Math.floor(command.bet / 10));
      const activity = await client.query<{ spins: string; total_won: string; free_spins: string }>(
        `SELECT COUNT(*) AS spins, COALESCE(SUM(win), 0) AS total_won,
                COALESCE(SUM((result->>'freeSpinsPlayed')::integer), 0) AS free_spins
           FROM spins WHERE player_id = $1`, [command.playerId],
      );
      const progression: PlayerProgression = {
        level: playerResult.rows[0].level + Math.floor(accumulatedXp / 1_000),
        xp: accumulatedXp % 1_000,
        spins: Number(activity.rows[0]?.spins ?? 0) + 1,
        totalWon: Number(activity.rows[0]?.total_won ?? 0) + spin.totalWin,
        freeSpins: Number(activity.rows[0]?.free_spins ?? 0) + spin.freeSpinsPlayed,
        vipPoints: Number(playerResult.rows[0].vip_points) + Math.max(1, Math.floor(command.bet / 100)),
      };
      const spinId = randomUUID();
      await client.query(
        `INSERT INTO spins (
           id, player_id, idempotency_key, slot_id, config_version, bet, win,
           rng_seed, result, balance_before, balance_after, server_version,
           math_model_version, progression_after
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [spinId, command.playerId, command.idempotencyKey, command.slotId, command.configVersion, command.bet,
          spin.totalWin, command.seed.toString(), JSON.stringify(spin), balance, balanceAfter,
          process.env.SERVER_VERSION ?? "dev", spin.mathModelVersion, JSON.stringify(progression)],
      );
      const events = spin.rounds.flatMap((round) => round.events.map((event) => ({
        phase: round.phase,
        roundIndex: round.index,
        type: event.type,
        data: event.data,
      })));
      if (events.length > 0) {
        await client.query(
          `INSERT INTO spin_events (spin_id, sequence, phase, round_index, event_type, payload)
           SELECT $1, ordinal::integer - 1, value->>'phase', (value->>'roundIndex')::integer,
                  value->>'type', value->'data'
             FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS source(value, ordinal)`,
          [spinId, JSON.stringify(events)],
        );
      }
      await client.query("UPDATE wallets SET balance = $1, version = version + 1 WHERE player_id = $2 AND currency = 'coin'", [balanceAfter, command.playerId]);
      await client.query("UPDATE players SET level = $1, xp = $2, vip_points = $3 WHERE id = $4", [progression.level, progression.xp, progression.vipPoints, command.playerId]);
      await client.query(
        `INSERT INTO mission_progress (player_id, mission_id, period_key, progress, completed_at)
         SELECT $1, id, CASE cadence WHEN 'weekly' THEN date_trunc('week', now() AT TIME ZONE 'UTC')::date
                              ELSE (now() AT TIME ZONE 'UTC')::date END,
                LEAST(target, CASE metric WHEN 'spin_count' THEN 1 WHEN 'wager_total' THEN $2
                  WHEN 'win_total' THEN $3 WHEN 'free_spin_count' THEN $4 ELSE 0 END),
                CASE WHEN CASE metric WHEN 'spin_count' THEN 1 WHEN 'wager_total' THEN $2
                  WHEN 'win_total' THEN $3 WHEN 'free_spin_count' THEN $4 ELSE 0 END >= target THEN now() END
           FROM mission_definitions WHERE active=true AND (starts_at IS NULL OR starts_at<=now())
             AND (ends_at IS NULL OR ends_at>now())
         ON CONFLICT (player_id, mission_id, period_key) DO UPDATE
           SET progress=LEAST((SELECT target FROM mission_definitions WHERE id=EXCLUDED.mission_id), mission_progress.progress+EXCLUDED.progress),
               completed_at=CASE WHEN mission_progress.progress+EXCLUDED.progress >=
                 (SELECT target FROM mission_definitions WHERE id=EXCLUDED.mission_id)
                 THEN COALESCE(mission_progress.completed_at, now()) ELSE mission_progress.completed_at END,
               version=mission_progress.version+1`,
        [command.playerId, command.bet, spin.totalWin, spin.freeSpinsPlayed],
      );
      const eventNow = new Date();
      for (const event of liveEventDefinitions) {
        const window = eventWindow(event.cadence, eventNow);
        const increment = eventIncrement(event.metric, command.bet, spin.totalWin, spin.freeSpinsPlayed);
        const maximum = event.milestones[event.milestones.length - 1]!.target;
        await client.query(
          `INSERT INTO live_event_progress (player_id, event_id, period_key, progress)
           VALUES ($1,$2,$3,LEAST($4::bigint,$5::bigint))
           ON CONFLICT (player_id, event_id, period_key) DO UPDATE
             SET progress=LEAST($4::bigint, live_event_progress.progress + EXCLUDED.progress),
                 version=live_event_progress.version+1, updated_at=now()`,
          [command.playerId, event.id, window.periodKey, maximum, increment],
        );
      }
      const tournamentPeriod = tournamentWindow(eventNow).periodKey;
      await client.query(
        `INSERT INTO tournament_scores (player_id, tournament_id, period_key, score)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (player_id, tournament_id, period_key) DO UPDATE
           SET score=tournament_scores.score+EXCLUDED.score,
               version=tournament_scores.version+1, updated_at=now()`,
        [command.playerId, activeTournamentDefinition.id, tournamentPeriod, tournamentPoints(command.bet, spin.totalWin)],
      );
      const balanceAfterWager = balance - command.bet;
      await this.ledger(client, {
        playerId: command.playerId,
        amount: -command.bet,
        reason: "slot_wager",
        source: "slot",
        referenceId: spinId,
        idempotencyKey: command.idempotencyKey,
        balanceBefore: balance,
        balanceAfter: balanceAfterWager,
        metadata: { slotId: command.slotId, configVersion: command.configVersion },
      });
      if (spin.totalWin > 0) {
        await this.ledger(client, {
          playerId: command.playerId,
          amount: spin.totalWin,
          reason: "slot_win",
          source: "slot",
          referenceId: spinId,
          idempotencyKey: `${command.idempotencyKey}:win`,
          balanceBefore: balanceAfterWager,
          balanceAfter,
          metadata: { slotId: command.slotId, configVersion: command.configVersion },
        });
      }
      await client.query(
        "INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload) VALUES ($1,'spin',$2,'spin.settled',$3)",
        [randomUUID(), spinId, JSON.stringify({ playerId: command.playerId, slotId: command.slotId, bet: command.bet, win: spin.totalWin })],
      );
      await client.query("COMMIT");
      return { spin, coinBalance: balanceAfter, progression };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async close(): Promise<void> { await this.pool.end(); }

  public async getJackpots(): Promise<readonly JackpotPoolView[]> {
    const result = await this.pool.query<{ tier: JackpotTier; pool_amount: string; seed_amount: string }>(
      "SELECT tier, pool_amount, seed_amount FROM progressive_jackpots ORDER BY CASE tier WHEN 'MINI' THEN 1 WHEN 'MINOR' THEN 2 ELSE 3 END",
    );
    return result.rows.map((row) => ({
      tier: row.tier,
      amount: this.safeInteger(row.pool_amount, "Jackpot pool"),
      seedAmount: this.safeInteger(row.seed_amount, "Jackpot seed"),
    }));
  }

  public async purchaseShopOffer(playerId: string, offer: ShopOffer, idempotencyKey: string): Promise<ShopPurchase> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const replay = await client.query<{ id: string; offer_id: string; coins: string; gems_spent: string; coin_balance_after: string; gem_balance_after: string }>(
        `SELECT id, offer_id, coins, gems_spent, coin_balance_after, gem_balance_after
           FROM shop_purchases WHERE player_id=$1 AND idempotency_key=$2`,
        [playerId, idempotencyKey],
      );
      if (replay.rows[0]) {
        await client.query("COMMIT");
        const row = replay.rows[0];
        return { purchaseId: row.id, offerId: row.offer_id, coins: this.safeInteger(row.coins, "Shop coins"),
          gemsSpent: this.safeInteger(row.gems_spent, "Shop gem cost"),
          coinBalance: this.safeInteger(row.coin_balance_after, "Shop coin balance"),
          gemBalance: this.safeInteger(row.gem_balance_after, "Shop gem balance") };
      }
      const wallets = await client.query<{ currency: "coin" | "gem"; balance: string }>(
        `SELECT currency, balance FROM wallets
          WHERE player_id=$1 AND currency IN ('coin','gem') ORDER BY currency FOR UPDATE`, [playerId],
      );
      const coinRow = wallets.rows.find((row) => row.currency === "coin");
      const gemRow = wallets.rows.find((row) => row.currency === "gem");
      if (!coinRow || !gemRow) throw new Error("Player shop wallets do not exist");
      if (offer.periodKey) {
        const claimed = await client.query(
          "SELECT 1 FROM shop_purchases WHERE player_id=$1 AND offer_id=$2 AND period_key=$3",
          [playerId, offer.id, offer.periodKey],
        );
        if (claimed.rowCount) throw new ShopOfferLimitReachedError();
      }
      const coinBefore = this.safeInteger(coinRow.balance, "Shop coin balance");
      const gemBefore = this.safeInteger(gemRow.balance, "Shop gem balance");
      if (gemBefore < offer.costGems) throw new InsufficientGemsError();
      const purchase: ShopPurchase = { purchaseId: randomUUID(), offerId: offer.id, coins: offer.coins,
        gemsSpent: offer.costGems, coinBalance: coinBefore + offer.coins, gemBalance: gemBefore - offer.costGems };
      await client.query(
        `INSERT INTO shop_purchases
          (id,player_id,offer_id,period_key,idempotency_key,coins,gems_spent,coin_balance_after,gem_balance_after)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [purchase.purchaseId, playerId, offer.id, offer.periodKey, idempotencyKey, offer.coins, offer.costGems,
          purchase.coinBalance, purchase.gemBalance],
      );
      await client.query(
        `UPDATE wallets SET balance=CASE currency WHEN 'coin' THEN $1 ELSE $2 END, version=version+1
          WHERE player_id=$3 AND currency IN ('coin','gem')`,
        [purchase.coinBalance, purchase.gemBalance, playerId],
      );
      await this.ledger(client, { playerId, currency: "gem", amount: -offer.costGems, reason: "shop_purchase",
        source: "shop", referenceId: purchase.purchaseId, idempotencyKey: `${idempotencyKey}:gems`,
        balanceBefore: gemBefore, balanceAfter: purchase.gemBalance, metadata: { offerId: offer.id } });
      await this.ledger(client, { playerId, currency: "coin", amount: offer.coins, reason: "shop_purchase",
        source: "shop", referenceId: purchase.purchaseId, idempotencyKey: `${idempotencyKey}:coins`,
        balanceBefore: coinBefore, balanceAfter: purchase.coinBalance, metadata: { offerId: offer.id } });
      await client.query("COMMIT");
      return purchase;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async claimReward(playerId: string, rewardId: string, coins: number): Promise<RewardClaim> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const wallet = await client.query<WalletRow>(
        "SELECT balance FROM wallets WHERE player_id = $1 AND currency = 'coin' FOR UPDATE", [playerId],
      );
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");
      const referenceId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO reward_claims (id, player_id, reward_id, coins)
         VALUES ($1, $2, $3, $4) ON CONFLICT (player_id, reward_id) DO NOTHING`,
        [referenceId, playerId, rewardId, coins],
      );
      if (inserted.rowCount !== 1) throw new RewardAlreadyClaimedError();
      const coinBalance = Number(wallet.rows[0].balance) + coins;
      await client.query(
        "UPDATE wallets SET balance = $1, version = version + 1 WHERE player_id = $2 AND currency = 'coin'",
        [coinBalance, playerId],
      );
      await this.ledger(client, {
        playerId,
        amount: coins,
        reason: "reward_claim",
        source: "reward",
        referenceId,
        idempotencyKey: `reward:${rewardId}`,
        balanceBefore: coinBalance - coins,
        balanceAfter: coinBalance,
        metadata: { rewardId },
      });
      await client.query("COMMIT");
      return { rewardId, coins, coinBalance };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async getProfile(playerId: string): Promise<PlayerProfile> {
    const result = await this.pool.query<{
      balance: string;
      gem_balance: string;
      level: number;
      xp: string;
      vip_points: string;
      progression_after: PlayerProgression | null;
      claimed_rewards: string[];
    }>(
      `SELECT w.balance, COALESCE((SELECT balance FROM wallets WHERE player_id=p.id AND currency='gem'), 0) AS gem_balance,
              p.level, p.xp, p.vip_points,
              (SELECT progression_after FROM spins WHERE player_id = p.id ORDER BY created_at DESC LIMIT 1) AS progression_after,
              COALESCE((SELECT array_agg(reward_id) FROM reward_claims WHERE player_id = p.id), '{}') AS claimed_rewards
         FROM players p JOIN wallets w ON w.player_id = p.id AND w.currency = 'coin'
        WHERE p.id = $1`,
      [playerId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Player profile does not exist");
    const previous = row.progression_after;
    return {
      coinBalance: Number(row.balance),
      gemBalance: Number(row.gem_balance),
      progression: {
        level: row.level,
        xp: Number(row.xp),
        spins: previous?.spins ?? 0,
        totalWon: previous?.totalWon ?? 0,
        freeSpins: previous?.freeSpins ?? 0,
        vipPoints: Number(row.vip_points),
      },
      claimedRewards: row.claimed_rewards,
    };
  }

  public async listWalletTransactions(playerId: string, limit: number): Promise<readonly WalletTransaction[]> {
    const result = await this.pool.query<WalletTransactionRow>(
      `SELECT id, currency, amount, reason, source, reference_id,
              balance_before, balance_after, created_at
         FROM wallet_ledger
        WHERE player_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [playerId, limit],
    );
    return result.rows.map((row) => {
      const amount = this.safeInteger(row.amount, "Ledger amount");
      return {
        id: row.id,
        currency: row.currency,
        amount,
        direction: amount > 0 ? "credit" : "debit",
        reason: row.reason,
        source: row.source,
        referenceId: row.reference_id,
        balanceBefore: this.safeInteger(row.balance_before, "Ledger balance_before"),
        balanceAfter: this.safeInteger(row.balance_after, "Ledger balance_after"),
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  public async getTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardStatus> {
    return rewardStatus(type, await this.timedState(this.pool, playerId, type), now);
  }

  public async claimTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardClaim> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO timed_reward_states (player_id, reward_type) VALUES ($1,$2)
         ON CONFLICT (player_id, reward_type) DO NOTHING`, [playerId, type],
      );
      const state = await this.timedState(client, playerId, type, true);
      const next = nextRewardState(type, state, now);
      if (!next) throw new RewardNotAvailableError(new Date(rewardStatus(type, state, now).availableAt));
      const wallet = await client.query<WalletRow>(
        "SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin' FOR UPDATE", [playerId],
      );
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");
      const before = this.safeInteger(wallet.rows[0].balance, "Wallet balance");
      const coinBalance = before + next.coins;
      const referenceId = randomUUID();
      const claimKey = `${type}:${type === "daily" ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 13)}`;
      await client.query(
        `INSERT INTO reward_claims (id, player_id, reward_id, coins) VALUES ($1,$2,$3,$4)`,
        [referenceId, playerId, claimKey, next.coins],
      );
      await client.query(
        `UPDATE timed_reward_states SET last_claimed_at=$3, streak=$4, cycle_position=$5,
                claims_toward_wheel=$6, version=version+1
          WHERE player_id=$1 AND reward_type=$2`,
        [playerId, type, now, next.streak, next.cyclePosition, next.claimsTowardWheel],
      );
      await client.query(
        "UPDATE wallets SET balance=$1, version=version+1 WHERE player_id=$2 AND currency='coin'",
        [coinBalance, playerId],
      );
      await this.ledger(client, {
        playerId, currency: "coin", amount: next.coins, reason: `${type}_reward`, source: "timed_reward",
        referenceId, idempotencyKey: `timed:${claimKey}`, balanceBefore: before,
        balanceAfter: coinBalance, metadata: { type, streak: next.streak, wheelUnlocked: next.wheelUnlocked },
      });
      if (next.wheelUnlocked) {
        await client.query(
          `INSERT INTO wheel_entitlements (id, player_id, wheel_type, source_reference_id, expires_at)
           VALUES ($1,$2,'standard',$3,$4)`,
          [randomUUID(), playerId, referenceId, new Date(now.getTime() + 30 * 86_400_000)],
        );
      }
      await client.query("COMMIT");
      const status = rewardStatus(type, {
        level: state.level, lastClaimedAt: now, streak: next.streak,
        cyclePosition: next.cyclePosition, claimsTowardWheel: next.claimsTowardWheel,
      }, now);
      return { ...status, coins: next.coins, coinBalance, wheelUnlocked: next.wheelUnlocked };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async getWheelStatus(playerId: string, now: Date): Promise<WheelStatus> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM wheel_entitlements
        WHERE player_id=$1 AND wheel_type='standard' AND status='available' AND expires_at>$2`, [playerId, now],
    );
    return { type: "standard", version: standardWheel.version, availableSpins: Number(result.rows[0]?.count ?? 0) };
  }

  public async spinWheel(playerId: string, idempotencyKey: string, randomUnit: number, now: Date): Promise<WheelSpinResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const replay = await client.query<{ id: string; segment_id: string; reward_currency: "coin" | "gem"; reward_amount: string; balance_after: string }>(
        "SELECT id, segment_id, reward_currency, reward_amount, balance_after FROM wheel_spins WHERE player_id=$1 AND idempotency_key=$2",
        [playerId, idempotencyKey],
      );
      if (replay.rows[0]) {
        await client.query("COMMIT");
        const status = await this.getWheelStatus(playerId, now);
        return { spinId: replay.rows[0].id, type: "standard", version: standardWheel.version,
          segmentId: replay.rows[0].segment_id, rewardCurrency: replay.rows[0].reward_currency,
          rewardAmount: this.safeInteger(replay.rows[0].reward_amount, "Wheel reward"),
          balanceAfter: this.safeInteger(replay.rows[0].balance_after, "Wheel balance"), availableSpins: status.availableSpins };
      }
      const entitlement = await client.query<{ id: string }>(
        `SELECT id FROM wheel_entitlements WHERE player_id=$1 AND wheel_type='standard'
          AND status='available' AND expires_at>$2 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [playerId, now],
      );
      if (!entitlement.rows[0]) throw new WheelNotAvailableError();
      const segment = selectWheelSegment(randomUnit);
      const wallet = await client.query<WalletRow>(
        "SELECT balance FROM wallets WHERE player_id=$1 AND currency=$2 FOR UPDATE", [playerId, segment.currency],
      );
      if (!wallet.rows[0]) throw new Error("Player reward wallet does not exist");
      const before = this.safeInteger(wallet.rows[0].balance, "Wheel wallet balance");
      const balanceAfter = before + segment.amount;
      const spinId = randomUUID();
      await client.query(
        `INSERT INTO wheel_spins (id, player_id, entitlement_id, idempotency_key, wheel_type,
          wheel_version, segment_id, reward_currency, reward_amount, balance_before, balance_after)
         VALUES ($1,$2,$3,$4,'standard',$5,$6,$7,$8,$9,$10)`,
        [spinId, playerId, entitlement.rows[0].id, idempotencyKey, standardWheel.version,
          segment.id, segment.currency, segment.amount, before, balanceAfter],
      );
      await client.query("UPDATE wheel_entitlements SET status='consumed', consumed_at=$2 WHERE id=$1", [entitlement.rows[0].id, now]);
      await client.query("UPDATE wallets SET balance=$1, version=version+1 WHERE player_id=$2 AND currency=$3", [balanceAfter, playerId, segment.currency]);
      await this.ledger(client, { playerId, currency: segment.currency, amount: segment.amount,
        reason: "wheel_reward", source: "bonus_wheel", referenceId: spinId,
        idempotencyKey: `wheel:${idempotencyKey}`, balanceBefore: before, balanceAfter,
        metadata: { wheelType: "standard", wheelVersion: standardWheel.version, segmentId: segment.id } });
      await client.query("COMMIT");
      const status = await this.getWheelStatus(playerId, now);
      return { spinId, type: "standard", version: standardWheel.version, segmentId: segment.id,
        rewardCurrency: segment.currency, rewardAmount: segment.amount, balanceAfter, availableSpins: status.availableSpins };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  public async getMissions(playerId: string, now: Date): Promise<readonly MissionView[]> {
    const result = await this.pool.query<{ id: string; cadence: "daily" | "weekly" | "event"; tier: "standard" | "pro" | "super" | "crazy"; translation_key: string; metric: string; target: string; reward_coins: string; progress: string; claimed_at: Date | null; period_key: string }>(
      `SELECT definitions.id, definitions.cadence, definitions.tier, definitions.translation_key,
              definitions.metric, definitions.target, definitions.reward_coins,
              COALESCE(progress.progress,0) AS progress, progress.claimed_at,
              CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC')::date
                   ELSE ($2::timestamptz AT TIME ZONE 'UTC')::date END AS period_key
         FROM mission_definitions AS definitions LEFT JOIN mission_progress AS progress
           ON progress.mission_id=definitions.id AND progress.player_id=$1
          AND progress.period_key=CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC')::date
                                   ELSE ($2::timestamptz AT TIME ZONE 'UTC')::date END
        WHERE definitions.active=true AND (definitions.starts_at IS NULL OR definitions.starts_at<=$2)
          AND (definitions.ends_at IS NULL OR definitions.ends_at>$2) ORDER BY definitions.id`, [playerId, now],
    );
    return result.rows.map((row) => { const target = this.safeInteger(row.target, "Mission target"); const progress = this.safeInteger(row.progress, "Mission progress");
      return { id: row.id, cadence: row.cadence, tier: row.tier, translationKey: row.translation_key,
        metric: row.metric, target, progress, rewardCoins: this.safeInteger(row.reward_coins, "Mission reward"),
        completed: progress >= target, claimed: Boolean(row.claimed_at), periodKey: row.period_key }; });
  }

  public async claimMission(playerId: string, missionId: string, now: Date): Promise<MissionClaim> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const mission = await client.query<{ reward_coins: string; progress: string; target: string; claimed_at: Date | null; period_key: string }>(
        `SELECT definitions.reward_coins, definitions.target, progress.progress, progress.claimed_at, progress.period_key
           FROM mission_progress AS progress JOIN mission_definitions AS definitions ON definitions.id=progress.mission_id
          WHERE progress.player_id=$1 AND progress.mission_id=$2
            AND progress.period_key=CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $3::timestamptz AT TIME ZONE 'UTC')::date
                                     ELSE ($3::timestamptz AT TIME ZONE 'UTC')::date END FOR UPDATE OF progress`,
        [playerId, missionId, now],
      );
      const row = mission.rows[0];
      if (!row || row.claimed_at || Number(row.progress) < Number(row.target)) throw new MissionNotClaimableError();
      const period = row.period_key;
      const coins = this.safeInteger(row.reward_coins, "Mission reward");
      const wallet = await client.query<WalletRow>("SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin' FOR UPDATE", [playerId]);
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");
      const before = this.safeInteger(wallet.rows[0].balance, "Mission wallet balance"); const coinBalance = before + coins; const referenceId = randomUUID();
      await client.query("UPDATE mission_progress SET claimed_at=$4, version=version+1 WHERE player_id=$1 AND mission_id=$2 AND period_key=$3", [playerId, missionId, period, now]);
      await client.query("UPDATE wallets SET balance=$1, version=version+1 WHERE player_id=$2 AND currency='coin'", [coinBalance, playerId]);
      await this.ledger(client, { playerId, currency: "coin", amount: coins, reason: "mission_claim", source: "mission",
        referenceId, idempotencyKey: `mission:${missionId}:${period}`, balanceBefore: before, balanceAfter: coinBalance,
        metadata: { missionId, period } });
      await client.query("COMMIT"); return { missionId, coins, coinBalance };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async getLiveEvents(playerId: string, now: Date): Promise<readonly LiveEventView[]> {
    const ids = liveEventDefinitions.map((event) => event.id);
    const progressResult = await this.pool.query<{ event_id: string; period_key: string; progress: string }>(
      `SELECT event_id, period_key::text AS period_key, progress FROM live_event_progress
        WHERE player_id=$1 AND event_id=ANY($2::text[])`, [playerId, ids],
    );
    const claimsResult = await this.pool.query<{ event_id: string; period_key: string; milestone_id: string }>(
      `SELECT event_id, period_key::text AS period_key, milestone_id FROM live_event_claims
        WHERE player_id=$1 AND event_id=ANY($2::text[])`, [playerId, ids],
    );
    return liveEventDefinitions.map((definition) => {
      const window = eventWindow(definition.cadence, now);
      const progressRow = progressResult.rows.find((row) => row.event_id === definition.id && row.period_key === window.periodKey);
      const progress = progressRow ? this.safeInteger(progressRow.progress, "Event progress") : 0;
      return {
        ...definition, periodKey: window.periodKey, startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString(), progress,
        milestones: definition.milestones.map((milestone) => ({ ...milestone, completed: progress >= milestone.target,
          claimed: claimsResult.rows.some((row) => row.event_id === definition.id && row.period_key === window.periodKey && row.milestone_id === milestone.id) })),
      };
    });
  }

  public async claimEventMilestone(
    playerId: string,
    eventId: string,
    milestoneId: string,
    now: Date,
  ): Promise<EventMilestoneClaim> {
    const definition = liveEventDefinitions.find((event) => event.id === eventId);
    const milestone = definition?.milestones.find((item) => item.id === milestoneId);
    if (!definition || !milestone) throw new EventMilestoneNotClaimableError();
    const window = eventWindow(definition.cadence, now);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const progressResult = await client.query<{ progress: string }>(
        `SELECT progress FROM live_event_progress
          WHERE player_id=$1 AND event_id=$2 AND period_key=$3 FOR UPDATE`,
        [playerId, eventId, window.periodKey],
      );
      if (!progressResult.rows[0] || Number(progressResult.rows[0].progress) < milestone.target) {
        throw new EventMilestoneNotClaimableError();
      }
      const claimId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO live_event_claims (id, player_id, event_id, period_key, milestone_id, reward_coins)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (player_id, event_id, period_key, milestone_id) DO NOTHING`,
        [claimId, playerId, eventId, window.periodKey, milestoneId, milestone.rewardCoins],
      );
      if (inserted.rowCount !== 1) throw new EventMilestoneNotClaimableError();
      const wallet = await client.query<WalletRow>(
        "SELECT balance FROM wallets WHERE player_id=$1 AND currency='coin' FOR UPDATE", [playerId],
      );
      if (!wallet.rows[0]) throw new Error("Player coin wallet does not exist");
      const before = this.safeInteger(wallet.rows[0].balance, "Event wallet balance");
      const coinBalance = before + milestone.rewardCoins;
      await client.query(
        "UPDATE wallets SET balance=$1, version=version+1 WHERE player_id=$2 AND currency='coin'", [coinBalance, playerId],
      );
      await this.ledger(client, { playerId, currency: "coin", amount: milestone.rewardCoins,
        reason: "event_milestone_claim", source: "live_event", referenceId: claimId,
        idempotencyKey: `event:${eventId}:${window.periodKey}:${milestoneId}`,
        balanceBefore: before, balanceAfter: coinBalance,
        metadata: { eventId, periodKey: window.periodKey, milestoneId } });
      await client.query("COMMIT");
      return { eventId, milestoneId, coins: milestone.rewardCoins, coinBalance };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  public async getActiveTournament(playerId: string, now: Date): Promise<TournamentView> {
    const window = tournamentWindow(now);
    const result = await this.pool.query<{ player_id: string; score: string; rank: string; entrants: string }>(
      `WITH ranked AS (
         SELECT player_id, score,
                RANK() OVER (ORDER BY score DESC, updated_at ASC) AS rank,
                COUNT(*) OVER () AS entrants
           FROM tournament_scores
          WHERE tournament_id=$1 AND period_key=$2
       )
       SELECT player_id, score, rank, entrants FROM ranked
        WHERE rank <= 50 OR player_id=$3
       ORDER BY rank ASC`,
      [activeTournamentDefinition.id, window.periodKey, playerId],
    );
    const player = result.rows.find((row) => row.player_id === playerId);
    const leaders = result.rows.slice(0, 5).map((row) => ({
      name: row.player_id === playerId ? "YOU" : `PLAYER-${row.player_id.replaceAll("-", "").slice(0, 6).toUpperCase()}`,
      score: this.safeInteger(row.score, "Tournament score"),
    }));
    return {
      ...activeTournamentDefinition,
      periodKey: window.periodKey,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      score: player ? this.safeInteger(player.score, "Tournament score") : 0,
      rank: player ? Number(player.rank) : Number(result.rows[0]?.entrants ?? 0) + 1,
      entrants: player ? Number(player.entrants) : Number(result.rows[0]?.entrants ?? 0) + 1,
      leaders,
    };
  }

  private async findReplay(client: PoolClient, command: SettleSpinCommand): Promise<SettledSpin | null> {
    const result = await client.query<ReplayRow>("SELECT result, balance_after, progression_after FROM spins WHERE player_id=$1 AND idempotency_key=$2", [command.playerId, command.idempotencyKey]);
    return result.rows[0] ? {
      spin: result.rows[0].result,
      coinBalance: Number(result.rows[0].balance_after),
      progression: {
        ...result.rows[0].progression_after,
        vipPoints: result.rows[0].progression_after.vipPoints ?? 0,
      },
    } : null;
  }

  private async ledger(client: PoolClient, entry: {
    readonly playerId: string;
    readonly currency?: "coin" | "gem";
    readonly amount: number;
    readonly reason: string;
    readonly source: string;
    readonly referenceId: string;
    readonly idempotencyKey: string;
    readonly balanceBefore: number;
    readonly balanceAfter: number;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await client.query(
      `INSERT INTO wallet_ledger (
         id, player_id, currency, amount, reason, source, reference_id,
         idempotency_key, balance_before, balance_after, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID(), entry.playerId, entry.currency ?? "coin", entry.amount, entry.reason, entry.source,
        entry.referenceId, entry.idempotencyKey, entry.balanceBefore, entry.balanceAfter, JSON.stringify(entry.metadata)],
    );
  }

  private safeInteger(value: string, label: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds API safe integer range`);
    return parsed;
  }

  private async timedState(
    queryable: Pick<Pool, "query"> | Pick<PoolClient, "query">,
    playerId: string,
    type: TimedRewardType,
    lock = false,
  ): Promise<TimedRewardState> {
    const result = await queryable.query<TimedRewardRow>(
      `SELECT players.level, states.last_claimed_at, COALESCE(states.streak,0) AS streak,
              COALESCE(states.cycle_position,0) AS cycle_position,
              COALESCE(states.claims_toward_wheel,0) AS claims_toward_wheel
         FROM players ${lock ? "JOIN" : "LEFT JOIN"} timed_reward_states AS states
           ON states.player_id=players.id AND states.reward_type=$2
        WHERE players.id=$1 ${lock ? "FOR UPDATE OF states" : ""}`,
      [playerId, type],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Player does not exist");
    return {
      level: row.level, lastClaimedAt: row.last_claimed_at, streak: row.streak,
      cyclePosition: row.cycle_position, claimsTowardWheel: row.claims_toward_wheel,
    };
  }
}
