from pathlib import Path
import re

PATH = Path("apps/api/src/spins/postgres-spin-store.ts")


def replace_once(old: str, new: str, marker: str) -> None:
    text = PATH.read_text()
    if marker in text:
        print(f"skip postgres store: {marker}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"postgres store: expected one exact anchor for {marker}, found {count}")
    PATH.write_text(text.replace(old, new))
    print(f"patched postgres store: {marker}")


def replace_regex_once(pattern: str, replacement: str, marker: str) -> None:
    text = PATH.read_text()
    if marker in text:
        print(f"skip postgres store: {marker}")
        return
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"postgres store: expected one regex anchor for {marker}, found {count}")
    PATH.write_text(updated)
    print(f"patched postgres store: {marker}")


replace_once(
    'import { randomUUID } from "node:crypto";',
    'import { randomUUID, timingSafeEqual } from "node:crypto";',
    "timingSafeEqual",
)
replace_once(
    'import type { EventMilestoneClaim, GrantStorePurchaseCommand, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, SettleSpinCommand, SettledSpin, ShopPurchase, SpinStore, StorePurchaseSettlement, StoreRefundCommand, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";',
    'import type { ClaimMissionCommand, EventMilestoneClaim, GrantStorePurchaseCommand, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, SettleSpinCommand, SettledSpin, ShopPurchase, SpinStore, StorePurchaseSettlement, StoreRefundCommand, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";',
    "ClaimMissionCommand, EventMilestoneClaim",
)
replace_once(
    'import { InsufficientLoyaltyPointsError, LoyaltyRedemptionConflictError, LoyaltyRewardNotFoundError } from "./spin-store.js";\n',
    'import { InsufficientLoyaltyPointsError, LoyaltyRedemptionConflictError, LoyaltyRewardNotFoundError } from "./spin-store.js";\nimport { MissionIdempotencyConflictError, missionClaimRequestHash } from "./spin-store.js";\nimport { issueBoundLootEntitlementWithinTransaction } from "../loot/postgres-loot-entitlement-issuer.js";\n',
    "issueBoundLootEntitlementWithinTransaction",
)
replace_regex_once(
    r'''interface StorePurchaseRow \{\n  id: string; player_id: string; product_key: string; store_product_id: string; transaction_id: string;\n  coins_granted: string; gems_granted: string; coin_balance_after: string; gem_balance_after: string;\n  high_roller_points_granted: string; high_roller_point_balance_after: string;\n\}\n''',
    '''interface StorePurchaseRow {
  id: string; player_id: string; product_key: string; store_product_id: string; transaction_id: string;
  coins_granted: string; gems_granted: string; coin_balance_after: string; gem_balance_after: string;
  high_roller_points_granted: string; high_roller_point_balance_after: string;
}
interface MissionClaimReplayRow { request_hash: Buffer; result: MissionClaim }
''',
    "interface MissionClaimReplayRow",
)
replace_once(
    "INSERT INTO mission_progress (player_id, mission_id, period_key, progress, completed_at)\n         SELECT $1, id, CASE cadence",
    "INSERT INTO mission_progress (player_id, mission_id, mission_version, period_key, progress, completed_at)\n         SELECT $1, id, version, CASE cadence",
    "mission_id, mission_version, period_key, progress",
)
replace_once(
    '''SET progress=LEAST((SELECT target FROM mission_definitions WHERE id=EXCLUDED.mission_id), mission_progress.progress+EXCLUDED.progress),
               completed_at=CASE WHEN mission_progress.progress+EXCLUDED.progress >=
                 (SELECT target FROM mission_definitions WHERE id=EXCLUDED.mission_id)''',
    '''SET progress=LEAST((SELECT target FROM mission_definition_versions
                 WHERE mission_id=EXCLUDED.mission_id AND version=mission_progress.mission_version),
                 mission_progress.progress+EXCLUDED.progress),
               completed_at=CASE WHEN mission_progress.progress+EXCLUDED.progress >=
                 (SELECT target FROM mission_definition_versions
                   WHERE mission_id=EXCLUDED.mission_id AND version=mission_progress.mission_version)''',
    "version=mission_progress.mission_version",
)

replacement = r'''  public async getMissions(playerId: string, now: Date): Promise<readonly MissionView[]> {
    const result = await this.pool.query<{
      id: string; version: number; cadence: MissionCadence; tier: "standard" | "pro" | "super" | "crazy";
      translation_key: string; metric: string; target: string; reward_coins: string;
      reward_mission_points: string; reward_loyalty_points: string; reward_stamps: string;
      reward_toolboxes: string; reward_boosters: string; reward_loot_table_id: string;
      reward_loot_table_version: number; reward_loot_expires_in_seconds: number;
      unlock_daily_claims: number; unlock_pro_claims: number; daily_claims: string; pro_claims: string;
      progress: string; claimed_at: Date | null; period_key: string; starts_at: Date; ends_at: Date;
    }>(
      `WITH counts AS (
         SELECT
           count(*) FILTER (WHERE d.cadence='daily' AND d.tier='standard'
             AND p.period_key=($2::timestamptz AT TIME ZONE 'UTC')::date) AS daily_claims,
           count(*) FILTER (WHERE d.cadence='three_day' AND d.tier='pro'
             AND p.period_key=date '1970-01-01' + (((($2::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3)) AS pro_claims
         FROM mission_progress p
         JOIN mission_definition_versions d ON d.mission_id=p.mission_id AND d.version=p.mission_version
         WHERE p.player_id=$1 AND p.claimed_at IS NOT NULL
       )
       SELECT definitions.id, definitions.version, definitions.cadence, definitions.tier,
              definitions.translation_key, definitions.metric, definitions.target, definitions.reward_coins,
              definitions.reward_mission_points, definitions.reward_loyalty_points, definitions.reward_stamps,
              definitions.reward_toolboxes, definitions.reward_boosters, versioned.reward_loot_table_id,
              versioned.reward_loot_table_version, versioned.reward_loot_expires_in_seconds,
              definitions.unlock_daily_claims, definitions.unlock_pro_claims, counts.daily_claims, counts.pro_claims,
              COALESCE(progress.progress,0) AS progress, progress.claimed_at,
              CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC')::date
                   WHEN 'three_day' THEN date '1970-01-01' + (((($2::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3)
                   ELSE ($2::timestamptz AT TIME ZONE 'UTC')::date END AS period_key,
              CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC')
                   WHEN 'three_day' THEN (date '1970-01-01' + (((($2::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3))::timestamp
                   ELSE date_trunc('day',$2::timestamptz AT TIME ZONE 'UTC') END AT TIME ZONE 'UTC' AS starts_at,
              CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC') + interval '7 days'
                   WHEN 'three_day' THEN (date '1970-01-01' + (((($2::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3) + 3)::timestamp
                   ELSE date_trunc('day',$2::timestamptz AT TIME ZONE 'UTC') + interval '1 day' END AT TIME ZONE 'UTC' AS ends_at
         FROM mission_definitions AS definitions
         JOIN mission_definition_versions AS versioned
           ON versioned.mission_id=definitions.id AND versioned.version=definitions.version
         CROSS JOIN counts
         LEFT JOIN mission_progress AS progress
           ON progress.mission_id=definitions.id AND progress.mission_version=definitions.version
          AND progress.player_id=$1
          AND progress.period_key=CASE definitions.cadence WHEN 'weekly' THEN date_trunc('week', $2::timestamptz AT TIME ZONE 'UTC')::date
                                   WHEN 'three_day' THEN date '1970-01-01' + (((($2::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3)
                                   ELSE ($2::timestamptz AT TIME ZONE 'UTC')::date END
        WHERE definitions.active=true AND (definitions.starts_at IS NULL OR definitions.starts_at<=$2)
          AND (definitions.ends_at IS NULL OR definitions.ends_at>$2)
        ORDER BY definitions.id`, [playerId, now],
    );
    return result.rows.map((row) => {
      const target = this.safeInteger(row.target, "Mission target");
      const progress = this.safeInteger(row.progress, "Mission progress");
      const rewards: MissionRewards = {
        coins: this.safeInteger(row.reward_coins, "Mission coins"),
        missionPoints: this.safeInteger(row.reward_mission_points, "Mission points"),
        loyaltyPoints: this.safeInteger(row.reward_loyalty_points, "Mission loyalty points"),
        stamps: this.safeInteger(row.reward_stamps, "Mission stamps"),
        toolboxes: this.safeInteger(row.reward_toolboxes, "Mission toolboxes"),
        boosters: this.safeInteger(row.reward_boosters, "Mission boosters"),
      };
      const dailyClaims = Number(row.daily_claims);
      const proClaims = Number(row.pro_claims);
      const unlockTarget = row.unlock_daily_claims + row.unlock_pro_claims;
      const unlockProgress = Math.min(row.unlock_daily_claims, dailyClaims)
        + Math.min(row.unlock_pro_claims, proClaims);
      const unlocked = unlockProgress >= unlockTarget;
      return {
        id: row.id,
        version: row.version,
        cadence: row.cadence,
        tier: row.tier,
        translationKey: row.translation_key,
        metric: row.metric,
        target,
        progress,
        rewards,
        rewardCoins: rewards.coins,
        lootReward: {
          tableId: row.reward_loot_table_id,
          tableVersion: row.reward_loot_table_version,
          expiresInSeconds: row.reward_loot_expires_in_seconds,
        },
        completed: unlocked && progress >= target,
        claimed: Boolean(row.claimed_at),
        periodKey: row.period_key,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        unlocked,
        unlockProgress,
        unlockTarget,
      };
    });
  }

  public async claimMission(command: ClaimMissionCommand, now: Date): Promise<MissionClaim> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [command.playerId]);
      if (player.rowCount !== 1) throw new MissionNotClaimableError();

      const mission = await client.query<{
        cadence: MissionCadence; tier: "standard" | "pro" | "super" | "crazy";
        mission_version: number; reward_coins: string; reward_mission_points: string;
        reward_loyalty_points: string; reward_stamps: string; reward_toolboxes: string;
        reward_boosters: string; reward_loot_table_id: string | null;
        reward_loot_table_version: number | null; reward_loot_expires_in_seconds: number | null;
        unlock_daily_claims: number; unlock_pro_claims: number; daily_claims: string;
        pro_claims: string; progress: string; target: string; claimed_at: Date | null; period_key: string;
      }>(
        `SELECT definitions.cadence, definitions.tier, definitions.version AS mission_version,
                definitions.reward_coins, definitions.reward_mission_points,
                definitions.reward_loyalty_points, definitions.reward_stamps,
                definitions.reward_toolboxes, definitions.reward_boosters,
                definitions.reward_loot_table_id, definitions.reward_loot_table_version,
                definitions.reward_loot_expires_in_seconds,
                definitions.unlock_daily_claims, definitions.unlock_pro_claims,
                (SELECT count(*) FROM mission_progress mp
                  JOIN mission_definition_versions md ON md.mission_id=mp.mission_id AND md.version=mp.mission_version
                 WHERE mp.player_id=$1 AND md.cadence='daily' AND md.tier='standard'
                   AND mp.claimed_at IS NOT NULL
                   AND mp.period_key=($3::timestamptz AT TIME ZONE 'UTC')::date) AS daily_claims,
                (SELECT count(*) FROM mission_progress mp
                  JOIN mission_definition_versions md ON md.mission_id=mp.mission_id AND md.version=mp.mission_version
                 WHERE mp.player_id=$1 AND md.cadence='three_day' AND md.tier='pro'
                   AND mp.claimed_at IS NOT NULL
                   AND mp.period_key=date '1970-01-01' + (((($3::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3)) AS pro_claims,
                definitions.target, progress.progress, progress.claimed_at, progress.period_key::text AS period_key
           FROM mission_progress AS progress
           JOIN mission_definition_versions AS definitions
             ON definitions.mission_id=progress.mission_id AND definitions.version=progress.mission_version
          WHERE progress.player_id=$1 AND progress.mission_id=$2
            AND progress.period_key=CASE definitions.cadence
              WHEN 'weekly' THEN date_trunc('week', $3::timestamptz AT TIME ZONE 'UTC')::date
              WHEN 'three_day' THEN date '1970-01-01' + (((($3::timestamptz AT TIME ZONE 'UTC')::date-date '1970-01-01')/3)*3)
              ELSE ($3::timestamptz AT TIME ZONE 'UTC')::date END
          FOR UPDATE OF progress`,
        [command.playerId, command.missionId, now],
      );
      const row = mission.rows[0];
      if (!row) throw new MissionNotClaimableError();
      const requestHash = missionClaimRequestHash(command, row.period_key);
      const retry = await client.query<MissionClaimReplayRow>(
        `SELECT request_hash,result FROM mission_claims_v1
          WHERE player_id=$1 AND idempotency_key=$2`,
        [command.playerId, command.idempotencyKey],
      );
      if (retry.rows[0]) {
        if (retry.rows[0].request_hash.length !== requestHash.length
          || !timingSafeEqual(retry.rows[0].request_hash, requestHash)) {
          throw new MissionIdempotencyConflictError();
        }
        await client.query("COMMIT");
        return { ...retry.rows[0].result, replayed: true };
      }
      const semanticReplay = await client.query<MissionClaimReplayRow>(
        `SELECT request_hash,result FROM mission_claims_v1
          WHERE player_id=$1 AND mission_id=$2 AND mission_version=$3 AND period_key=$4`,
        [command.playerId, command.missionId, row.mission_version, row.period_key],
      );
      if (semanticReplay.rows[0]) {
        await client.query("COMMIT");
        return { ...semanticReplay.rows[0].result, replayed: true };
      }

      const unlocked = Number(row.daily_claims) >= row.unlock_daily_claims
        && Number(row.pro_claims) >= row.unlock_pro_claims;
      if (!unlocked || row.claimed_at || Number(row.progress) < Number(row.target)) {
        throw new MissionNotClaimableError();
      }
      await client.query(`INSERT INTO wallets (player_id,currency,balance) VALUES
        ($1,'mission_point',0),($1,'loyalty_point',0),($1,'stamp',0),($1,'toolbox',0),($1,'booster',0)
        ON CONFLICT (player_id,currency) DO NOTHING`, [command.playerId]);
      const walletRows = await client.query<{ currency: WalletCurrency; balance: string }>(
        `SELECT currency,balance FROM wallets
          WHERE player_id=$1 AND currency IN ('coin','mission_point','loyalty_point','stamp','toolbox','booster')
          ORDER BY currency FOR UPDATE`, [command.playerId],
      );
      if (walletRows.rows.length !== 6) throw new Error("Player mission wallets do not exist");

      const rewards: MissionRewards = {
        coins: this.safeInteger(row.reward_coins, "Mission coins"),
        missionPoints: this.safeInteger(row.reward_mission_points, "Mission points"),
        loyaltyPoints: this.safeInteger(row.reward_loyalty_points, "Mission loyalty points"),
        stamps: this.safeInteger(row.reward_stamps, "Mission stamps"),
        toolboxes: this.safeInteger(row.reward_toolboxes, "Mission toolboxes"),
        boosters: this.safeInteger(row.reward_boosters, "Mission boosters"),
      };
      const rewardEntries: readonly [WalletCurrency, number][] = [
        ["coin", rewards.coins], ["mission_point", rewards.missionPoints],
        ["loyalty_point", rewards.loyaltyPoints], ["stamp", rewards.stamps],
        ["toolbox", rewards.toolboxes], ["booster", rewards.boosters],
      ];
      const beforeBalances = new Map<WalletCurrency, number>();
      const balances: Record<string, number> = {};
      for (const [currency, amount] of rewardEntries) {
        const wallet = walletRows.rows.find((entry) => entry.currency === currency);
        if (!wallet) throw new Error(`Mission ${currency} wallet does not exist`);
        const before = this.safeInteger(wallet.balance, `Mission ${currency} balance`);
        const after = before + amount;
        if (!Number.isSafeInteger(after) || after < 0) throw new RangeError(`Mission ${currency} balance is unsafe`);
        beforeBalances.set(currency, before);
        balances[currency] = after;
      }

      const claimId = randomUUID();
      const entitlement = row.reward_loot_table_id === null ? null
        : await issueBoundLootEntitlementWithinTransaction(client, {
          playerId: command.playerId,
          idempotencyKey: `mission:${command.idempotencyKey}`,
          tableId: row.reward_loot_table_id,
          tableVersion: row.reward_loot_table_version!,
          source: "mission",
          referenceId: `${command.missionId}:v${row.mission_version}:${row.period_key}`,
          expiresAt: new Date(now.getTime() + row.reward_loot_expires_in_seconds! * 1000),
          metadata: {
            claimId,
            missionId: command.missionId,
            missionVersion: row.mission_version,
            periodKey: row.period_key,
            cadence: row.cadence,
            tier: row.tier,
          },
        }, now);
      const result: MissionClaim = {
        claimId,
        missionId: command.missionId,
        missionVersion: row.mission_version,
        periodKey: row.period_key,
        coins: rewards.coins,
        coinBalance: balances.coin!,
        rewards,
        balances,
        lootEntitlement: entitlement,
        replayed: false,
      };
      await client.query(
        `INSERT INTO mission_claims_v1
          (id,player_id,mission_id,mission_version,period_key,idempotency_key,request_hash,
           progress_at_claim,rewards,balances,loot_entitlement_id,result,claimed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13)`,
        [claimId, command.playerId, command.missionId, row.mission_version, row.period_key,
          command.idempotencyKey, requestHash, row.progress, JSON.stringify(rewards), JSON.stringify(balances),
          entitlement?.entitlementId ?? null, JSON.stringify(result), now],
      );
      await client.query(
        `UPDATE mission_progress SET claimed_at=$4,version=version+1
          WHERE player_id=$1 AND mission_id=$2 AND period_key=$3`,
        [command.playerId, command.missionId, row.period_key, now],
      );
      for (const [currency, amount] of rewardEntries) {
        const before = beforeBalances.get(currency)!;
        const after = balances[currency]!;
        if (amount === 0) continue;
        await client.query(
          "UPDATE wallets SET balance=$1,version=version+1 WHERE player_id=$2 AND currency=$3",
          [after, command.playerId, currency],
        );
        await this.ledger(client, {
          playerId: command.playerId,
          currency,
          amount,
          reason: "mission_claim",
          source: "mission",
          referenceId: claimId,
          idempotencyKey: `mission:${command.idempotencyKey}:${currency}`,
          balanceBefore: before,
          balanceAfter: after,
          metadata: { missionId: command.missionId, missionVersion: row.mission_version, periodKey: row.period_key },
        });
      }
      if (row.cadence === "daily" && row.tier === "standard") {
        await client.query(
          `INSERT INTO mission_progress (player_id,mission_id,mission_version,period_key,progress,completed_at)
           SELECT $1,id,version,date_trunc('week',$2::timestamptz AT TIME ZONE 'UTC')::date,1,
                  CASE WHEN target<=1 THEN $2 END FROM mission_definitions
            WHERE active=true AND cadence='weekly' AND metric='daily_mission_claims'
           ON CONFLICT (player_id,mission_id,period_key) DO UPDATE SET
             progress=LEAST((SELECT target FROM mission_definition_versions
                              WHERE mission_id=EXCLUDED.mission_id AND version=mission_progress.mission_version),
                            mission_progress.progress+1),
             completed_at=CASE WHEN mission_progress.progress+1 >=
               (SELECT target FROM mission_definition_versions
                 WHERE mission_id=EXCLUDED.mission_id AND version=mission_progress.mission_version)
               THEN COALESCE(mission_progress.completed_at,$2) ELSE mission_progress.completed_at END,
             version=mission_progress.version+1`, [command.playerId, now],
        );
      }
      await client.query(
        `INSERT INTO outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
         VALUES ($1,'mission',$2,'mission.claimed',$3::jsonb)`,
        [randomUUID(), claimId, JSON.stringify({
          playerId: command.playerId,
          missionId: command.missionId,
          missionVersion: row.mission_version,
          periodKey: row.period_key,
          rewards,
          lootEntitlementId: entitlement?.entitlementId ?? null,
        })],
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async getLiveEvents'''

replace_regex_once(
    r'''  public async getMissions\(playerId: string, now: Date\): Promise<readonly MissionView\[]> \{.*?\n  public async getLiveEvents''',
    replacement,
    "public async claimMission(command: ClaimMissionCommand",
)
