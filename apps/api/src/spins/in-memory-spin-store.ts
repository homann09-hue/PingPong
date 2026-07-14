import { randomUUID } from "node:crypto";
import type { EventMilestoneClaim, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, ShopPurchase, SpinStore, SettleSpinCommand, SettledSpin, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";
import { EventMilestoneNotClaimableError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, WheelNotAvailableError } from "./spin-store.js";
import { nextRewardState, rewardStatus, type TimedRewardState } from "../rewards/timed-rewards.js";
import { selectWheelSegment, standardWheel } from "../rewards/bonus-wheel.js";
import { eventIncrement, eventWindow, liveEventDefinitions } from "../events/live-events.js";
import { activeTournamentDefinition, demoTournamentLeaders, tournamentPoints, tournamentWindow } from "../tournaments/tournaments.js";
import { applyProgressiveAward, jackpotContribution, jackpotDefinitions, triggeredJackpotTier, type JackpotPoolView, type JackpotTier } from "../jackpots/progressive-jackpots.js";
import type { ShopOffer } from "../shop/shop-catalog.js";

/** Deterministic test adapter mirroring database settlement semantics. */
export class InMemorySpinStore implements SpinStore {
  private readonly replay = new Map<string, SettledSpin>();
  private readonly balances = new Map<string, number>();
  private readonly progression = new Map<string, PlayerProgression>();
  private readonly claimedRewards = new Set<string>();
  private readonly ledger: Array<WalletTransaction & { readonly playerId: string }> = [];
  private readonly timedRewards = new Map<string, Omit<TimedRewardState, "level">>();
  private readonly wheelEntitlements = new Map<string, number>();
  private readonly wheelReplays = new Map<string, WheelSpinResult>();
  private readonly gemBalances = new Map<string, number>();
  private readonly missionProgress = new Map<string, { progress: number; claimed: boolean }>();
  private readonly eventProgress = new Map<string, number>();
  private readonly eventClaims = new Set<string>();
  private readonly tournamentScores = new Map<string, number>();
  private readonly jackpotPools = new Map<JackpotTier, number>(
    jackpotDefinitions.map((definition) => [definition.tier, definition.seedAmount]),
  );
  private readonly shopReplays = new Map<string, ShopPurchase>();
  private readonly limitedShopPurchases = new Set<string>();

  public constructor(initialBalance = 100_000) { this.defaultBalance = initialBalance; }
  private readonly defaultBalance: number;

  public async settle(command: SettleSpinCommand, calculate: () => SettledSpin["spin"]): Promise<SettledSpin> {
    const key = `${command.playerId}:${command.idempotencyKey}`;
    const existing = this.replay.get(key);
    if (existing) return existing;
    const current = this.balances.get(command.playerId) ?? this.defaultBalance;
    if (current < command.bet) throw new InsufficientFundsError();
    let spin = calculate();
    for (const definition of jackpotDefinitions) {
      this.jackpotPools.set(
        definition.tier,
        (this.jackpotPools.get(definition.tier) ?? definition.seedAmount) + jackpotContribution(definition.tier, command.bet),
      );
    }
    const triggeredTier = triggeredJackpotTier(spin);
    if (triggeredTier) {
      const award = this.jackpotPools.get(triggeredTier) ?? jackpotDefinitions.find((item) => item.tier === triggeredTier)!.seedAmount;
      spin = applyProgressiveAward(spin, triggeredTier, award);
      this.jackpotPools.set(triggeredTier, jackpotDefinitions.find((item) => item.tier === triggeredTier)!.seedAmount);
    }
    const previous = this.progression.get(command.playerId) ?? {
      level: 12, xp: 625, spins: 0, totalWon: 0, freeSpins: 0,
      vipPoints: 2_450,
    };
    const earnedXp = Math.max(10, Math.floor(command.bet / 10));
    const accumulatedXp = previous.xp + earnedXp;
    const progression = {
      level: previous.level + Math.floor(accumulatedXp / 1_000),
      xp: accumulatedXp % 1_000,
      spins: previous.spins + 1,
      totalWon: previous.totalWon + spin.totalWin,
      freeSpins: previous.freeSpins + spin.freeSpinsPlayed,
      vipPoints: previous.vipPoints + Math.max(1, Math.floor(command.bet / 100)),
    };
    const settled = {
      spin,
      coinBalance: current - command.bet + spin.totalWin,
      progression,
    };
    const afterWager = current - command.bet;
    this.record(command.playerId, -command.bet, "slot_wager", "slot", command.idempotencyKey, current, afterWager);
    if (spin.totalWin > 0) {
      this.record(command.playerId, spin.totalWin, "slot_win", "slot", `${command.idempotencyKey}:win`, afterWager, settled.coinBalance);
    }
    this.balances.set(command.playerId, settled.coinBalance);
    this.progression.set(command.playerId, progression);
    this.replay.set(key, settled);
    this.advanceMissions(command.playerId, command.bet, spin.totalWin, spin.freeSpinsPlayed, new Date());
    this.advanceEvents(command.playerId, command.bet, spin.totalWin, spin.freeSpinsPlayed, new Date());
    const tournamentNow = new Date();
    const tournamentPeriod = tournamentWindow(tournamentNow).periodKey;
    const tournamentKey = `${command.playerId}:${activeTournamentDefinition.id}:${tournamentPeriod}`;
    this.tournamentScores.set(
      tournamentKey,
      (this.tournamentScores.get(tournamentKey) ?? 0) + tournamentPoints(command.bet, spin.totalWin),
    );
    return settled;
  }

  public async claimReward(playerId: string, rewardId: string, coins: number): Promise<RewardClaim> {
    const key = `${playerId}:${rewardId}`;
    if (this.claimedRewards.has(key)) throw new RewardAlreadyClaimedError();
    const coinBalance = (this.balances.get(playerId) ?? this.defaultBalance) + coins;
    this.claimedRewards.add(key);
    this.balances.set(playerId, coinBalance);
    this.record(playerId, coins, "reward_claim", "reward", `reward:${rewardId}`, coinBalance - coins, coinBalance);
    return { rewardId, coins, coinBalance };
  }

  public async listWalletTransactions(playerId: string, limit: number): Promise<readonly WalletTransaction[]> {
    return this.ledger.filter((entry) => entry.playerId === playerId).slice(-limit).reverse();
  }

  public async getTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardStatus> {
    return rewardStatus(type, this.timedState(playerId, type), now);
  }

  public async claimTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardClaim> {
    const current = this.timedState(playerId, type);
    const next = nextRewardState(type, current, now);
    if (!next) throw new RewardNotAvailableError(new Date(rewardStatus(type, current, now).availableAt));
    this.timedRewards.set(`${playerId}:${type}`, {
      lastClaimedAt: now, streak: next.streak, cyclePosition: next.cyclePosition,
      claimsTowardWheel: next.claimsTowardWheel,
    });
    const before = this.balances.get(playerId) ?? this.defaultBalance;
    const coinBalance = before + next.coins;
    this.balances.set(playerId, coinBalance);
    this.record(playerId, next.coins, `${type}_reward`, "timed_reward", `${type}:${now.toISOString()}`, before, coinBalance);
    if (next.wheelUnlocked) this.wheelEntitlements.set(playerId, (this.wheelEntitlements.get(playerId) ?? 0) + 1);
    const status = await this.getTimedReward(playerId, type, now);
    return { ...status, coins: next.coins, coinBalance, wheelUnlocked: next.wheelUnlocked };
  }

  public async getWheelStatus(playerId: string, _now: Date): Promise<WheelStatus> {
    return { type: "standard", version: standardWheel.version, availableSpins: this.wheelEntitlements.get(playerId) ?? 0 };
  }

  public async spinWheel(playerId: string, idempotencyKey: string, randomUnit: number, now: Date): Promise<WheelSpinResult> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    const replay = this.wheelReplays.get(replayKey);
    if (replay) return replay;
    const available = this.wheelEntitlements.get(playerId) ?? 0;
    if (available < 1) throw new WheelNotAvailableError();
    const segment = selectWheelSegment(randomUnit);
    const balances = segment.currency === "coin" ? this.balances : this.gemBalances;
    const before = balances.get(playerId) ?? (segment.currency === "coin" ? this.defaultBalance : 0);
    const balanceAfter = before + segment.amount;
    balances.set(playerId, balanceAfter);
    this.wheelEntitlements.set(playerId, available - 1);
    const result: WheelSpinResult = {
      spinId: randomUUID(), type: "standard", version: standardWheel.version,
      segmentId: segment.id, rewardCurrency: segment.currency, rewardAmount: segment.amount,
      balanceAfter, availableSpins: available - 1,
    };
    this.record(playerId, segment.amount, "wheel_reward", "bonus_wheel", `wheel:${idempotencyKey}:${now.toISOString()}`, before, balanceAfter, segment.currency);
    this.wheelReplays.set(replayKey, result);
    return result;
  }

  public async getMissions(playerId: string, now: Date): Promise<readonly MissionView[]> {
    return missionDefinitions.map((definition) => {
      const periodKey = missionPeriod(definition.cadence, now);
      const state = this.missionProgress.get(`${playerId}:${definition.id}:${periodKey}`) ?? { progress: 0, claimed: false };
      return { ...definition, progress: Math.min(definition.target, state.progress), completed: state.progress >= definition.target,
        claimed: state.claimed, periodKey };
    });
  }

  public async claimMission(playerId: string, missionId: string, now: Date): Promise<MissionClaim> {
    const mission = (await this.getMissions(playerId, now)).find((item) => item.id === missionId);
    if (!mission || !mission.completed || mission.claimed) throw new MissionNotClaimableError();
    const key = `${playerId}:${missionId}:${mission.periodKey}`;
    this.missionProgress.set(key, { progress: mission.progress, claimed: true });
    const before = this.balances.get(playerId) ?? this.defaultBalance;
    const coinBalance = before + mission.rewardCoins;
    this.balances.set(playerId, coinBalance);
    this.record(playerId, mission.rewardCoins, "mission_claim", "mission", key, before, coinBalance);
    return { missionId, coins: mission.rewardCoins, coinBalance };
  }

  public async getLiveEvents(playerId: string, now: Date): Promise<readonly LiveEventView[]> {
    return liveEventDefinitions.map((definition) => {
      const window = eventWindow(definition.cadence, now);
      const key = `${playerId}:${definition.id}:${window.periodKey}`;
      const progress = this.eventProgress.get(key) ?? 0;
      return {
        ...definition,
        periodKey: window.periodKey,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt.toISOString(),
        progress,
        milestones: definition.milestones.map((milestone) => ({
          ...milestone,
          completed: progress >= milestone.target,
          claimed: this.eventClaims.has(`${key}:${milestone.id}`),
        })),
      };
    });
  }

  public async claimEventMilestone(
    playerId: string,
    eventId: string,
    milestoneId: string,
    now: Date,
  ): Promise<EventMilestoneClaim> {
    const event = (await this.getLiveEvents(playerId, now)).find((item) => item.id === eventId);
    const milestone = event?.milestones.find((item) => item.id === milestoneId);
    if (!event || !milestone || !milestone.completed || milestone.claimed) {
      throw new EventMilestoneNotClaimableError();
    }
    const key = `${playerId}:${event.id}:${event.periodKey}:${milestone.id}`;
    this.eventClaims.add(key);
    const before = this.balances.get(playerId) ?? this.defaultBalance;
    const coinBalance = before + milestone.rewardCoins;
    this.balances.set(playerId, coinBalance);
    this.record(playerId, milestone.rewardCoins, "event_milestone_claim", "live_event", key, before, coinBalance);
    return { eventId, milestoneId, coins: milestone.rewardCoins, coinBalance };
  }

  public async getActiveTournament(playerId: string, now: Date): Promise<TournamentView> {
    const window = tournamentWindow(now);
    const score = this.tournamentScores.get(`${playerId}:${activeTournamentDefinition.id}:${window.periodKey}`) ?? 0;
    const bots = demoTournamentLeaders(now);
    const rank = bots.filter((entry) => entry.score > score).length + 1;
    return {
      ...activeTournamentDefinition,
      periodKey: window.periodKey,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      score,
      rank,
      entrants: bots.length + 1,
      leaders: bots,
    };
  }

  public async getJackpots(): Promise<readonly JackpotPoolView[]> {
    return jackpotDefinitions.map((definition) => ({
      ...definition,
      amount: this.jackpotPools.get(definition.tier) ?? definition.seedAmount,
    }));
  }

  public async purchaseShopOffer(playerId: string, offer: ShopOffer, idempotencyKey: string): Promise<ShopPurchase> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    const replay = this.shopReplays.get(replayKey);
    if (replay) return replay;
    const limitKey = offer.periodKey ? `${playerId}:${offer.id}:${offer.periodKey}` : null;
    if (limitKey && this.limitedShopPurchases.has(limitKey)) throw new ShopOfferLimitReachedError();
    const gemBefore = this.gemBalances.get(playerId) ?? 320;
    if (gemBefore < offer.costGems) throw new InsufficientGemsError();
    const coinBefore = this.balances.get(playerId) ?? this.defaultBalance;
    const purchase: ShopPurchase = {
      purchaseId: randomUUID(), offerId: offer.id, coins: offer.coins, gemsSpent: offer.costGems,
      coinBalance: coinBefore + offer.coins, gemBalance: gemBefore - offer.costGems,
    };
    this.gemBalances.set(playerId, purchase.gemBalance);
    this.balances.set(playerId, purchase.coinBalance);
    this.record(playerId, -offer.costGems, "shop_purchase", "shop", `${idempotencyKey}:gems`, gemBefore, purchase.gemBalance, "gem");
    this.record(playerId, offer.coins, "shop_purchase", "shop", `${idempotencyKey}:coins`, coinBefore, purchase.coinBalance);
    if (limitKey) this.limitedShopPurchases.add(limitKey);
    this.shopReplays.set(replayKey, purchase);
    return purchase;
  }

  public async getProfile(playerId: string): Promise<PlayerProfile> {
    return {
      coinBalance: this.balances.get(playerId) ?? this.defaultBalance,
      gemBalance: this.gemBalances.get(playerId) ?? 320,
      progression: this.progression.get(playerId) ?? {
        level: 12, xp: 625, spins: 0, totalWon: 0, freeSpins: 0, vipPoints: 2_450,
      },
      claimedRewards: [...this.claimedRewards]
        .filter((key) => key.startsWith(`${playerId}:`))
        .map((key) => key.slice(playerId.length + 1)),
    };
  }

  public async close(): Promise<void> {}

  private record(
    playerId: string,
    amount: number,
    reason: string,
    source: string,
    idempotencyKey: string,
    balanceBefore: number,
    balanceAfter: number,
    currency: "coin" | "gem" = "coin",
  ): void {
    this.ledger.push({
      playerId,
      id: randomUUID(),
      currency,
      amount,
      direction: amount > 0 ? "credit" : "debit",
      reason,
      source,
      referenceId: idempotencyKey,
      balanceBefore,
      balanceAfter,
      createdAt: new Date().toISOString(),
    });
  }

  private timedState(playerId: string, type: TimedRewardType): TimedRewardState {
    const saved = this.timedRewards.get(`${playerId}:${type}`) ?? {
      lastClaimedAt: null, streak: 0, cyclePosition: 0, claimsTowardWheel: 0,
    };
    return { ...saved, level: this.progression.get(playerId)?.level ?? 1 };
  }

  private advanceMissions(playerId: string, wager: number, win: number, freeSpins: number, now: Date): void {
    const increments: Record<string, number> = { spin_count: 1, wager_total: wager, win_total: win, free_spin_count: freeSpins };
    for (const mission of missionDefinitions) {
      const period = missionPeriod(mission.cadence, now);
      const key = `${playerId}:${mission.id}:${period}`;
      const state = this.missionProgress.get(key) ?? { progress: 0, claimed: false };
      this.missionProgress.set(key, { ...state, progress: Math.min(mission.target, state.progress + increments[mission.metric]!) });
    }
  }

  private advanceEvents(playerId: string, wager: number, win: number, freeSpins: number, now: Date): void {
    for (const event of liveEventDefinitions) {
      const window = eventWindow(event.cadence, now);
      const key = `${playerId}:${event.id}:${window.periodKey}`;
      const maximum = event.milestones[event.milestones.length - 1]!.target;
      const progress = this.eventProgress.get(key) ?? 0;
      this.eventProgress.set(key, Math.min(maximum, progress + eventIncrement(event.metric, wager, win, freeSpins)));
    }
  }
}

const missionDefinitions = [
  { id: "daily-spins-10", cadence: "daily", tier: "standard", translationKey: "mission.daily_spins_10", metric: "spin_count", target: 10, rewardCoins: 100_000 },
  { id: "daily-wager-10000", cadence: "daily", tier: "standard", translationKey: "mission.daily_wager_10000", metric: "wager_total", target: 10_000, rewardCoins: 150_000 },
  { id: "daily-win-50000", cadence: "daily", tier: "pro", translationKey: "mission.daily_win_50000", metric: "win_total", target: 50_000, rewardCoins: 200_000 },
  { id: "daily-free-spins-3", cadence: "daily", tier: "pro", translationKey: "mission.daily_free_spins_3", metric: "free_spin_count", target: 3, rewardCoins: 250_000 },
  { id: "weekly-spins-100", cadence: "weekly", tier: "pro", translationKey: "mission.weekly_spins_100", metric: "spin_count", target: 100, rewardCoins: 750_000 },
  { id: "weekly-wager-250000", cadence: "weekly", tier: "super", translationKey: "mission.weekly_wager_250000", metric: "wager_total", target: 250_000, rewardCoins: 1_500_000 },
  { id: "weekly-free-spins-25", cadence: "weekly", tier: "crazy", translationKey: "mission.weekly_free_spins_25", metric: "free_spin_count", target: 25, rewardCoins: 2_000_000 },
] as const;

function missionPeriod(cadence: "daily" | "weekly" | "event", now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (cadence === "weekly") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
