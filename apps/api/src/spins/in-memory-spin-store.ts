import { randomUUID } from "node:crypto";
import type { EventMilestoneClaim, GrantStorePurchaseCommand, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, ShopPurchase, SpinStore, SettleSpinCommand, SettledSpin, StorePurchaseSettlement, StoreRefundCommand, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";
import { BoosterActionConflictError, BoosterNotAvailableError, BoosterNotCraftableError, CheckWinNotClaimableError, EventMilestoneNotClaimableError, HighRollerAlreadyActiveError, HighRollerNotEligibleError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, StoreProductLimitReachedError, StorePurchaseDebtError, StorePurchaseRevokedError, StoreTransactionConflictError, WheelNotAvailableError } from "./spin-store.js";
import { nextRewardState, rewardStatus, type TimedRewardState } from "../rewards/timed-rewards.js";
import { selectWheelSegment, standardWheel } from "../rewards/bonus-wheel.js";
import { eventIncrement, eventWindow, liveEventDefinitions } from "../events/live-events.js";
import { activeTournamentDefinition, demoTournamentLeaders, tournamentPoints, tournamentWindow } from "../tournaments/tournaments.js";
import { applyProgressiveAward, jackpotContribution, jackpotDefinitions, triggeredJackpotTier, type JackpotPoolView, type JackpotTier } from "../jackpots/progressive-jackpots.js";
import type { ShopOffer } from "../shop/shop-catalog.js";
import { economyBalances, spinEconomyDeltas, type SpinEconomyCurrency, type WalletCurrency } from "../economy/currencies.js";
import { checkWinReward, checkWinStatus, type CheckWinClaim, type CheckWinStatus } from "../economy/check-win.js";
import { boosterStatus, xpBoosterRules, type BoosterActivation, type BoosterCraft, type BoosterStatus } from "../economy/xp-booster.js";
import { loyaltyRewardOffer, loyaltyRewardsStatus, type LoyaltyRedemption, type LoyaltyRewardsStatus } from "../economy/loyalty-rewards.js";
import { InsufficientLoyaltyPointsError, LoyaltyRedemptionConflictError, LoyaltyRewardNotFoundError } from "./spin-store.js";
import { missionCatalog, missionUnlock, missionWindow, type MissionDefinition } from "../missions/mission-system.js";
import { highRollerCashback, highRollerClubRules, highRollerSourcePoints, highRollerStatus, type HighRollerActivation, type HighRollerClubStatus, type HighRollerFixedSource } from "../economy/high-roller-club.js";

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
  private readonly economy = new Map<string, Partial<Record<SpinEconomyCurrency, number>>>();
  private readonly missionProgress = new Map<string, { progress: number; claimed: boolean }>();
  private readonly eventProgress = new Map<string, number>();
  private readonly eventClaims = new Set<string>();
  private readonly tournamentScores = new Map<string, number>();
  private readonly jackpotPools = new Map<JackpotTier, number>(
    jackpotDefinitions.map((definition) => [definition.tier, definition.seedAmount]),
  );
  private readonly shopReplays = new Map<string, ShopPurchase>();
  private readonly checkWinReplays = new Map<string, CheckWinClaim>();
  private readonly boosterCraftReplays = new Map<string, BoosterCraft>();
  private readonly boosterActivationReplays = new Map<string, BoosterActivation>();
  private readonly boosterActionKinds = new Map<string, "craft" | "activate">();
  private readonly activeBoostSpins = new Map<string, number>();
  private readonly loyaltyRedemptions = new Map<string, LoyaltyRedemption>();
  private readonly highRollerActiveUntil = new Map<string, Date>();
  private readonly highRollerActivations = new Map<string, HighRollerActivation>();
  private readonly highRollerSourceGrants = new Set<string>();
  private readonly limitedShopPurchases = new Set<string>();
  private readonly storePurchases = new Map<string, StorePurchaseSettlement & { readonly playerId: string }>();
  private readonly limitedStorePurchases = new Set<string>();
  private readonly revokedStoreTransactions = new Set<string>();
  private readonly storeRefundEvents = new Set<string>();
  private readonly storePurchaseDebt = new Set<string>();

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
    const activeBoostSpins = this.activeBoostSpins.get(command.playerId) ?? 0;
    const xpMultiplier = activeBoostSpins > 0 ? xpBoosterRules.xpMultiplier : 1;
    const earnedXp = Math.max(10, Math.floor(command.bet / 10)) * xpMultiplier;
    const accumulatedXp = previous.xp + earnedXp;
    const progression = {
      level: previous.level + Math.floor(accumulatedXp / 1_000),
      xp: accumulatedXp % 1_000,
      spins: previous.spins + 1,
      totalWon: previous.totalWon + spin.totalWin,
      freeSpins: previous.freeSpins + spin.freeSpinsPlayed,
      vipPoints: previous.vipPoints + Math.max(1, Math.floor(command.bet / 100)),
    };
    const highRollerActive = (this.highRollerActiveUntil.get(command.playerId)?.getTime() ?? 0) > Date.now();
    const cashback = highRollerCashback(command.bet, spin.totalWin, highRollerActive);
    const winBalance = current - command.bet + spin.totalWin;
    const settled = {
      spin,
      coinBalance: winBalance + cashback,
      progression,
    };
    const afterWager = current - command.bet;
    this.record(command.playerId, -command.bet, "slot_wager", "slot", command.idempotencyKey, current, afterWager);
    if (spin.totalWin > 0) {
      this.record(command.playerId, spin.totalWin, "slot_win", "slot", `${command.idempotencyKey}:win`, afterWager, winBalance);
    }
    if (cashback > 0) this.record(command.playerId, cashback, "high_roller_cashback", "high_roller_club", `${command.idempotencyKey}:cashback`, winBalance, settled.coinBalance);
    this.balances.set(command.playerId, settled.coinBalance);
    this.progression.set(command.playerId, progression);
    if (activeBoostSpins > 0) this.activeBoostSpins.set(command.playerId, activeBoostSpins - 1);
    const economy = this.economy.get(command.playerId) ?? {};
    for (const [currency, amount] of Object.entries(spinEconomyDeltas({
      bet: command.bet, totalWin: spin.totalWin, freeSpins: spin.freeSpinsPlayed,
      levelsGained: progression.level - previous.level, highRollerActive,
    })) as [SpinEconomyCurrency, number][]) {
      if (amount <= 0) continue;
      const before = economy[currency] ?? 0;
      economy[currency] = before + amount;
      this.record(command.playerId, amount, "spin_progression", "slot", `${command.idempotencyKey}:${currency}`, before, before + amount, currency);
    }
    this.economy.set(command.playerId, economy);
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

  public async getHighRollerClub(playerId: string, now: Date): Promise<HighRollerClubStatus> {
    return highRollerStatus(this.economy.get(playerId)?.high_roller_point ?? 0, this.highRollerActiveUntil.get(playerId) ?? null, now);
  }

  public async activateHighRollerClub(playerId: string, idempotencyKey: string, now: Date): Promise<HighRollerActivation> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    const replay = this.highRollerActivations.get(replayKey);
    if (replay) return { ...replay, replayed: true };
    const wallet = { ...this.economy.get(playerId) };
    const status = highRollerStatus(wallet.high_roller_point ?? 0, this.highRollerActiveUntil.get(playerId) ?? null, now);
    if (status.active) throw new HighRollerAlreadyActiveError();
    if (!status.eligible) throw new HighRollerNotEligibleError();
    wallet.high_roller_point = status.points - highRollerClubRules.entryPoints;
    const stampBefore = wallet.stamp ?? 0;
    wallet.stamp = stampBefore + highRollerClubRules.diamondStampsPerActivation;
    const activeUntil = new Date(now.getTime() + highRollerClubRules.accessDays * 86_400_000);
    this.highRollerActiveUntil.set(playerId, activeUntil);
    this.economy.set(playerId, wallet);
    const activationId = randomUUID();
    this.record(playerId, -highRollerClubRules.entryPoints, "high_roller_activation", "high_roller_club", `${idempotencyKey}:points`, status.points, wallet.high_roller_point, "high_roller_point");
    this.record(playerId, highRollerClubRules.diamondStampsPerActivation, "high_roller_diamond_stamp", "high_roller_club", `${idempotencyKey}:stamp`, stampBefore, wallet.stamp, "stamp");
    const activation: HighRollerActivation = {
      ...highRollerStatus(wallet.high_roller_point, activeUntil, now), activationId,
      pointsSpent: highRollerClubRules.entryPoints, stampsGranted: highRollerClubRules.diamondStampsPerActivation,
      stampBalance: wallet.stamp, replayed: false,
    };
    this.highRollerActivations.set(replayKey, activation);
    return activation;
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

  public async getCheckWinStatus(playerId: string): Promise<CheckWinStatus> {
    return checkWinStatus(this.economy.get(playerId)?.check_win_mark ?? 0);
  }

  public async claimCheckWin(playerId: string, idempotencyKey: string): Promise<CheckWinClaim> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    const replay = this.checkWinReplays.get(replayKey);
    if (replay) return { ...replay, replayed: true };
    const wallet = { ...this.economy.get(playerId) };
    const markBefore = wallet.check_win_mark ?? 0;
    if (markBefore < checkWinReward.requiredMarks) throw new CheckWinNotClaimableError();
    const stampBefore = wallet.stamp ?? 0;
    const coinBefore = this.balances.get(playerId) ?? this.defaultBalance;
    const claim: CheckWinClaim = {
      claimId: randomUUID(),
      marksSpent: checkWinReward.requiredMarks,
      coins: checkWinReward.rewardCoins,
      stamps: checkWinReward.rewardStamps,
      coinBalance: coinBefore + checkWinReward.rewardCoins,
      markBalance: markBefore - checkWinReward.requiredMarks,
      stampBalance: stampBefore + checkWinReward.rewardStamps,
      replayed: false,
    };
    wallet.check_win_mark = claim.markBalance;
    wallet.stamp = claim.stampBalance;
    this.economy.set(playerId, wallet);
    this.balances.set(playerId, claim.coinBalance);
    this.record(playerId, -claim.marksSpent, "check_win_exchange", "check_win", `${idempotencyKey}:marks`, markBefore, claim.markBalance, "check_win_mark");
    this.record(playerId, claim.coins, "check_win_reward", "check_win", `${idempotencyKey}:coins`, coinBefore, claim.coinBalance);
    this.record(playerId, claim.stamps, "check_win_reward", "check_win", `${idempotencyKey}:stamps`, stampBefore, claim.stampBalance, "stamp");
    this.checkWinReplays.set(replayKey, claim);
    return claim;
  }

  public async getBoosterStatus(playerId: string): Promise<BoosterStatus> {
    const wallet = this.economy.get(playerId);
    return boosterStatus(wallet?.stamp ?? 0, wallet?.booster ?? 0, this.activeBoostSpins.get(playerId) ?? 0);
  }

  public async craftBooster(playerId: string, idempotencyKey: string): Promise<BoosterCraft> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    if (this.boosterActionKinds.get(replayKey) === "activate") throw new BoosterActionConflictError();
    const replay = this.boosterCraftReplays.get(replayKey);
    if (replay) return { ...replay, replayed: true };
    const wallet = { ...this.economy.get(playerId) };
    const stampBefore = wallet.stamp ?? 0;
    if (stampBefore < xpBoosterRules.stampsPerBooster) throw new BoosterNotCraftableError();
    const boosterBefore = wallet.booster ?? 0;
    const craft: BoosterCraft = {
      actionId: randomUUID(), stampsSpent: xpBoosterRules.stampsPerBooster, boostersGranted: 1,
      stampBalance: stampBefore - xpBoosterRules.stampsPerBooster,
      boosterBalance: boosterBefore + 1, replayed: false,
    };
    wallet.stamp = craft.stampBalance;
    wallet.booster = craft.boosterBalance;
    this.economy.set(playerId, wallet);
    this.record(playerId, -craft.stampsSpent, "booster_craft", "xp_booster", `${idempotencyKey}:stamps`, stampBefore, craft.stampBalance, "stamp");
    this.record(playerId, craft.boostersGranted, "booster_craft", "xp_booster", `${idempotencyKey}:boosters`, boosterBefore, craft.boosterBalance, "booster");
    this.boosterCraftReplays.set(replayKey, craft);
    this.boosterActionKinds.set(replayKey, "craft");
    return craft;
  }

  public async activateBooster(playerId: string, idempotencyKey: string): Promise<BoosterActivation> {
    const replayKey = `${playerId}:${idempotencyKey}`;
    if (this.boosterActionKinds.get(replayKey) === "craft") throw new BoosterActionConflictError();
    const replay = this.boosterActivationReplays.get(replayKey);
    if (replay) return { ...replay, replayed: true };
    const wallet = { ...this.economy.get(playerId) };
    const boosterBefore = wallet.booster ?? 0;
    if (boosterBefore < 1) throw new BoosterNotAvailableError();
    const currentActiveSpins = this.activeBoostSpins.get(playerId) ?? 0;
    if (currentActiveSpins + xpBoosterRules.boostedSpinsPerToken > xpBoosterRules.maxActiveSpins) {
      throw new BoosterNotAvailableError();
    }
    const activeSpins = currentActiveSpins + xpBoosterRules.boostedSpinsPerToken;
    const activation: BoosterActivation = {
      actionId: randomUUID(), boostersSpent: 1, boosterBalance: boosterBefore - 1,
      activeSpins, replayed: false,
    };
    wallet.booster = activation.boosterBalance;
    this.economy.set(playerId, wallet);
    this.activeBoostSpins.set(playerId, activeSpins);
    this.record(playerId, -1, "booster_activation", "xp_booster", `${idempotencyKey}:activate`, boosterBefore, activation.boosterBalance, "booster");
    this.grantHighRollerSource(playerId, "booster", `booster:${idempotencyKey}`);
    this.boosterActivationReplays.set(replayKey, activation);
    this.boosterActionKinds.set(replayKey, "activate");
    return activation;
  }

  public async getLoyaltyRewards(playerId: string): Promise<LoyaltyRewardsStatus> {
    return loyaltyRewardsStatus(this.economy.get(playerId)?.loyalty_point ?? 0);
  }

  public async redeemLoyaltyReward(playerId: string, offerId: string, idempotencyKey: string): Promise<LoyaltyRedemption> {
    const offer = loyaltyRewardOffer(offerId);
    if (!offer) throw new LoyaltyRewardNotFoundError();
    const replayKey = `${playerId}:${idempotencyKey}`;
    const replay = this.loyaltyRedemptions.get(replayKey);
    if (replay) {
      if (replay.offerId !== offerId) throw new LoyaltyRedemptionConflictError();
      return { ...replay, replayed: true };
    }
    const wallet = { ...this.economy.get(playerId) };
    const loyaltyBefore = wallet.loyalty_point ?? 0;
    if (loyaltyBefore < offer.costLoyaltyPoints) throw new InsufficientLoyaltyPointsError();
    const rewardBefore = offer.rewardCurrency === "coin"
      ? this.balances.get(playerId) ?? this.defaultBalance
      : this.gemBalances.get(playerId) ?? 320;
    const redemption: LoyaltyRedemption = {
      redemptionId: randomUUID(), offerId, loyaltyPointsSpent: offer.costLoyaltyPoints,
      rewardCurrency: offer.rewardCurrency, rewardAmount: offer.rewardAmount,
      loyaltyPointBalance: loyaltyBefore - offer.costLoyaltyPoints,
      rewardBalance: rewardBefore + offer.rewardAmount, replayed: false,
    };
    wallet.loyalty_point = redemption.loyaltyPointBalance;
    this.economy.set(playerId, wallet);
    if (offer.rewardCurrency === "coin") this.balances.set(playerId, redemption.rewardBalance);
    else this.gemBalances.set(playerId, redemption.rewardBalance);
    this.record(playerId, -redemption.loyaltyPointsSpent, "loyalty_redemption", "loyalty_rewards", `${idempotencyKey}:lp`, loyaltyBefore, redemption.loyaltyPointBalance, "loyalty_point");
    this.record(playerId, redemption.rewardAmount, "loyalty_reward", "loyalty_rewards", `${idempotencyKey}:reward`, rewardBefore, redemption.rewardBalance, offer.rewardCurrency);
    this.loyaltyRedemptions.set(replayKey, redemption);
    return redemption;
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
    this.grantHighRollerSource(playerId, type === "daily" ? "daily_store_bonus" : "lobby_express", `timed:${type}:${now.toISOString()}`);
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
    this.grantHighRollerSource(playerId, "wheel", `wheel:${idempotencyKey}`);
    this.wheelReplays.set(replayKey, result);
    return result;
  }

  public async getMissions(playerId: string, now: Date): Promise<readonly MissionView[]> {
    const claims = this.missionClaimCounts(playerId, now);
    return missionCatalog.definitions.map((definition) => {
      const window = missionWindow(definition.cadence, now);
      const periodKey = window.periodKey;
      const state = this.missionProgress.get(`${playerId}:${definition.id}:${periodKey}`) ?? { progress: 0, claimed: false };
      const unlock = missionUnlock(definition, claims.daily, claims.pro);
      return { ...definition, rewardCoins: definition.rewards.coins,
        progress: Math.min(definition.target, state.progress), completed: unlock.unlocked && state.progress >= definition.target,
        claimed: state.claimed, periodKey, startsAt: window.startsAt, endsAt: window.endsAt,
        unlocked: unlock.unlocked, unlockProgress: unlock.progress, unlockTarget: unlock.target };
    });
  }

  public async claimMission(playerId: string, missionId: string, now: Date): Promise<MissionClaim> {
    const mission = (await this.getMissions(playerId, now)).find((item) => item.id === missionId);
    if (!mission || !mission.completed || mission.claimed) throw new MissionNotClaimableError();
    const key = `${playerId}:${missionId}:${mission.periodKey}`;
    this.missionProgress.set(key, { progress: mission.progress, claimed: true });
    const coinBefore = this.balances.get(playerId) ?? this.defaultBalance;
    const coinBalance = coinBefore + mission.rewards.coins;
    this.balances.set(playerId, coinBalance);
    if (mission.rewards.coins > 0) this.record(playerId, mission.rewards.coins, "mission_claim", "mission", `${key}:coin`, coinBefore, coinBalance);
    const wallet = { ...this.economy.get(playerId) };
    const rewardCurrencies: readonly [SpinEconomyCurrency, number][] = [
      ["mission_point", mission.rewards.missionPoints], ["loyalty_point", mission.rewards.loyaltyPoints],
      ["stamp", mission.rewards.stamps], ["toolbox", mission.rewards.toolboxes], ["booster", mission.rewards.boosters],
    ];
    const balances: Record<string, number> = { coin: coinBalance };
    for (const [currency, amount] of rewardCurrencies) {
      const before = wallet[currency] ?? 0;
      const after = before + amount;
      wallet[currency] = after;
      balances[currency] = after;
      if (amount > 0) this.record(playerId, amount, "mission_claim", "mission", `${key}:${currency}`, before, after, currency);
    }
    this.economy.set(playerId, wallet);
    const definition = missionCatalog.definitions.find((item) => item.id === missionId)!;
    if (definition.cadence === "daily" && definition.tier === "standard") this.advanceWeeklyMissionBar(playerId, now);
    return { missionId, coins: mission.rewards.coins, coinBalance, rewards: mission.rewards, balances };
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
    this.grantHighRollerSource(playerId, "purchase", `shop:${idempotencyKey}`);
    if (limitKey) this.limitedShopPurchases.add(limitKey);
    this.shopReplays.set(replayKey, purchase);
    return purchase;
  }

  public async grantStorePurchase(command: GrantStorePurchaseCommand): Promise<StorePurchaseSettlement> {
    const transactionKey = `${command.verified.platform}:${command.verified.transactionId}`;
    if (this.revokedStoreTransactions.has(transactionKey)) throw new StorePurchaseRevokedError();
    const replay = this.storePurchases.get(transactionKey);
    if (replay) {
      if (replay.playerId !== command.playerId || replay.productKey !== command.product.key) {
        throw new StoreTransactionConflictError();
      }
      return { ...replay, replayed: true };
    }
    if (this.storePurchaseDebt.has(command.playerId)) throw new StorePurchaseDebtError();
    const limitKey = `${command.playerId}:${command.product.key}`;
    if (command.product.purchaseLimit === "once" && this.limitedStorePurchases.has(limitKey)) {
      throw new StoreProductLimitReachedError();
    }
    const coinBefore = this.balances.get(command.playerId) ?? this.defaultBalance;
    const gemBefore = this.gemBalances.get(command.playerId) ?? 320;
    const purchase: StorePurchaseSettlement & { readonly playerId: string } = {
      purchaseId: randomUUID(), playerId: command.playerId, productKey: command.product.key,
      storeProductId: command.verified.storeProductId, transactionId: command.verified.transactionId,
      coins: command.product.grantCoins, gems: command.product.grantGems,
      coinBalance: coinBefore + command.product.grantCoins, gemBalance: gemBefore + command.product.grantGems,
      replayed: false,
    };
    this.balances.set(command.playerId, purchase.coinBalance);
    this.gemBalances.set(command.playerId, purchase.gemBalance);
    this.record(command.playerId, purchase.coins, "verified_store_purchase", "store_purchase", purchase.purchaseId, coinBefore, purchase.coinBalance);
    if (purchase.gems > 0) this.record(command.playerId, purchase.gems, "verified_store_purchase", "store_purchase", `${purchase.purchaseId}:gems`, gemBefore, purchase.gemBalance, "gem");
    this.storePurchases.set(transactionKey, purchase);
    if (command.product.purchaseLimit === "once") this.limitedStorePurchases.add(limitKey);
    return purchase;
  }

  public async refundStorePurchase(command: StoreRefundCommand): Promise<boolean> {
    if (this.storeRefundEvents.has(command.eventId)) return false;
    this.storeRefundEvents.add(command.eventId);
    const transactionKey = `${command.platform}:${command.transactionId}`;
    this.revokedStoreTransactions.add(transactionKey);
    const purchase = this.storePurchases.get(transactionKey);
    if (!purchase) return true;
    const coinBefore = this.balances.get(purchase.playerId) ?? this.defaultBalance;
    const gemBefore = this.gemBalances.get(purchase.playerId) ?? 320;
    const recoveredCoins = Math.min(coinBefore, purchase.coins);
    const recoveredGems = Math.min(gemBefore, purchase.gems);
    this.balances.set(purchase.playerId, coinBefore - recoveredCoins);
    this.gemBalances.set(purchase.playerId, gemBefore - recoveredGems);
    if (recoveredCoins > 0) this.record(purchase.playerId, -recoveredCoins, "store_refund", "store_refund", `${command.eventId}:coins`, coinBefore, coinBefore - recoveredCoins);
    if (recoveredGems > 0) this.record(purchase.playerId, -recoveredGems, "store_refund", "store_refund", `${command.eventId}:gems`, gemBefore, gemBefore - recoveredGems, "gem");
    if (recoveredCoins < purchase.coins || recoveredGems < purchase.gems) this.storePurchaseDebt.add(purchase.playerId);
    return true;
  }

  public async getProfile(playerId: string): Promise<PlayerProfile> {
    const coinBalance = this.balances.get(playerId) ?? this.defaultBalance;
    const gemBalance = this.gemBalances.get(playerId) ?? 320;
    const progression = this.progression.get(playerId) ?? {
      level: 12, xp: 625, spins: 0, totalWon: 0, freeSpins: 0, vipPoints: 2_450,
    };
    return {
      coinBalance,
      gemBalance,
      balances: economyBalances({
        coin: coinBalance, gem: gemBalance, vip_point: progression.vipPoints,
        ...this.economy.get(playerId),
      }),
      progression,
      claimedRewards: [...this.claimedRewards]
        .filter((key) => key.startsWith(`${playerId}:`))
        .map((key) => key.slice(playerId.length + 1)),
    };
  }

  /** Applies an already approved local workforce grant and records the same ledger shape as production. */
  public async applyAdminGrant(playerId: string, currency: "coin" | "gem", amount: number, referenceId: string, reason: string): Promise<{ balanceBefore: number; balanceAfter: number }> {
    const balances = currency === "coin" ? this.balances : this.gemBalances;
    const balanceBefore = balances.get(playerId) ?? (currency === "coin" ? this.defaultBalance : 320);
    const balanceAfter = balanceBefore + amount;
    balances.set(playerId, balanceAfter);
    this.record(playerId, amount, "admin_grant", "admin", `admin-grant:${referenceId}`, balanceBefore, balanceAfter, currency);
    void reason;
    return { balanceBefore, balanceAfter };
  }

  public async close(): Promise<void> {}

  private grantHighRollerSource(
    playerId: string,
    source: HighRollerFixedSource,
    idempotencyKey: string,
  ): void {
    const grantKey = `${playerId}:${idempotencyKey}`;
    if (this.highRollerSourceGrants.has(grantKey)) return;
    const amount = highRollerSourcePoints(source);
    const wallet = { ...this.economy.get(playerId) };
    const before = wallet.high_roller_point ?? 0;
    wallet.high_roller_point = before + amount;
    this.economy.set(playerId, wallet);
    this.record(playerId, amount, "high_roller_source", "high_roller_club", idempotencyKey,
      before, before + amount, "high_roller_point");
    this.highRollerSourceGrants.add(grantKey);
  }

  private record(
    playerId: string,
    amount: number,
    reason: string,
    source: string,
    idempotencyKey: string,
    balanceBefore: number,
    balanceAfter: number,
    currency: WalletCurrency = "coin",
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
    const claims = this.missionClaimCounts(playerId, now);
    for (const mission of missionCatalog.definitions) {
      if (mission.metric === "daily_mission_claims" || !missionUnlock(mission, claims.daily, claims.pro).unlocked) continue;
      const period = missionWindow(mission.cadence, now).periodKey;
      const key = `${playerId}:${mission.id}:${period}`;
      const state = this.missionProgress.get(key) ?? { progress: 0, claimed: false };
      this.missionProgress.set(key, { ...state, progress: Math.min(mission.target, state.progress + increments[mission.metric]!) });
    }
  }

  private advanceWeeklyMissionBar(playerId: string, now: Date): void {
    for (const mission of missionCatalog.definitions.filter((item) => item.metric === "daily_mission_claims")) {
      const key = `${playerId}:${mission.id}:${missionWindow("weekly", now).periodKey}`;
      const state = this.missionProgress.get(key) ?? { progress: 0, claimed: false };
      this.missionProgress.set(key, { ...state, progress: Math.min(mission.target, state.progress + 1) });
    }
  }

  private missionClaimCounts(playerId: string, now: Date): { readonly daily: number; readonly pro: number } {
    const claimed = (definition: MissionDefinition): boolean => {
      const key = `${playerId}:${definition.id}:${missionWindow(definition.cadence, now).periodKey}`;
      return this.missionProgress.get(key)?.claimed === true;
    };
    return {
      daily: missionCatalog.definitions.filter((item) => item.cadence === "daily" && item.tier === "standard" && claimed(item)).length,
      pro: missionCatalog.definitions.filter((item) => item.cadence === "three_day" && item.tier === "pro" && claimed(item)).length,
    };
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
