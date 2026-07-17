import type { SpinResult } from "@aurora/slot-engine";
import type { JackpotPoolView } from "../jackpots/progressive-jackpots.js";
import type { ShopOffer } from "../shop/shop-catalog.js";
import type { StoreProduct } from "../monetization/store-products.js";
import type { VerifiedStoreTransaction } from "../monetization/receipt-verifier.js";
import type { EconomyBalance, WalletCurrency } from "../economy/currencies.js";
import type { CheckWinClaim, CheckWinStatus } from "../economy/check-win.js";
import type { BoosterActivation, BoosterCraft, BoosterStatus } from "../economy/xp-booster.js";
import type { LoyaltyRedemption, LoyaltyRewardsStatus } from "../economy/loyalty-rewards.js";
import type { MissionCadence, MissionRewards, MissionTier } from "../missions/mission-system.js";
import type { HighRollerActivation, HighRollerClubStatus } from "../economy/high-roller-club.js";

export interface SettleSpinCommand {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly slotId: string;
  readonly configVersion: number;
  readonly bet: number;
  readonly seed: bigint;
}

export interface SettledSpin {
  readonly spin: SpinResult;
  readonly coinBalance: number;
  readonly progression: PlayerProgression;
}

export interface PlayerProgression {
  readonly level: number;
  readonly xp: number;
  readonly spins: number;
  readonly totalWon: number;
  readonly freeSpins: number;
  readonly vipPoints: number;
}

export interface PlayerProfile {
  readonly coinBalance: number;
  readonly gemBalance: number;
  readonly balances: readonly EconomyBalance[];
  readonly progression: PlayerProgression;
  readonly claimedRewards: readonly string[];
}
export interface ShopPurchase {
  readonly purchaseId: string; readonly offerId: string; readonly coins: number; readonly gemsSpent: number;
  readonly coinBalance: number; readonly gemBalance: number;
}
export interface GrantStorePurchaseCommand {
  readonly playerId: string;
  readonly product: StoreProduct;
  readonly verified: VerifiedStoreTransaction;
  readonly verificationHash: string;
}
export interface StorePurchaseSettlement {
  readonly purchaseId: string;
  readonly productKey: string;
  readonly storeProductId: string;
  readonly transactionId: string;
  readonly coins: number;
  readonly gems: number;
  readonly highRollerPoints: number;
  readonly coinBalance: number;
  readonly gemBalance: number;
  readonly highRollerPointBalance: number;
  readonly replayed: boolean;
}
export interface StoreRefundCommand {
  readonly eventId: string;
  readonly platform: "ios" | "android";
  readonly transactionId: string;
  readonly occurredAt: Date;
  readonly providerPayloadHash: string;
}

export interface RewardClaim {
  readonly rewardId: string;
  readonly coins: number;
  readonly coinBalance: number;
}

export interface WalletTransaction {
  readonly id: string;
  readonly currency: WalletCurrency;
  readonly amount: number;
  readonly direction: "credit" | "debit";
  readonly reason: string;
  readonly source: string;
  readonly referenceId: string;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly createdAt: string;
}

export type TimedRewardType = "hourly" | "daily";
export interface TimedRewardStatus {
  readonly type: TimedRewardType;
  readonly claimable: boolean;
  readonly availableAt: string;
  readonly nextCoins: number;
  readonly streak: number;
  readonly cyclePosition: number;
  readonly claimsTowardWheel: number;
}
export interface TimedRewardClaim extends TimedRewardStatus {
  readonly coins: number;
  readonly coinBalance: number;
  readonly wheelUnlocked: boolean;
}
export interface WheelStatus { readonly type: "standard"; readonly version: number; readonly availableSpins: number }
export interface WheelSpinResult {
  readonly spinId: string;
  readonly type: "standard";
  readonly version: number;
  readonly segmentId: string;
  readonly rewardCurrency: "coin" | "gem";
  readonly rewardAmount: number;
  readonly balanceAfter: number;
  readonly availableSpins: number;
}
export interface MissionView {
  readonly id: string; readonly cadence: MissionCadence;
  readonly tier: MissionTier; readonly translationKey: string;
  readonly metric: string; readonly target: number;
  readonly progress: number; readonly rewards: MissionRewards; readonly rewardCoins: number;
  readonly completed: boolean; readonly claimed: boolean; readonly periodKey: string;
  readonly startsAt: string; readonly endsAt: string; readonly unlocked: boolean;
  readonly unlockProgress: number; readonly unlockTarget: number;
}
export interface MissionClaim {
  readonly missionId: string; readonly coins: number; readonly coinBalance: number;
  readonly rewards: MissionRewards; readonly balances: Readonly<Record<string, number>>;
}
export interface EventMilestoneView {
  readonly id: string; readonly target: number; readonly rewardCoins: number;
  readonly completed: boolean; readonly claimed: boolean;
}
export interface LiveEventView {
  readonly id: string; readonly version: number; readonly title: string; readonly subtitle: string;
  readonly cadence: "daily" | "weekly"; readonly metric: string; readonly accent: "gold" | "cyan";
  readonly periodKey: string; readonly startsAt: string; readonly endsAt: string; readonly progress: number;
  readonly milestones: readonly EventMilestoneView[];
}
export interface EventMilestoneClaim {
  readonly eventId: string; readonly milestoneId: string; readonly coins: number; readonly coinBalance: number;
}
export interface TournamentLeader { readonly name: string; readonly score: number }
export interface TournamentView {
  readonly id: string; readonly version: number; readonly name: string; readonly subtitle: string;
  readonly scoring: string; readonly prizePool: number; readonly periodKey: string;
  readonly startsAt: string; readonly endsAt: string; readonly score: number; readonly rank: number;
  readonly entrants: number; readonly leaders: readonly TournamentLeader[];
}

export interface SpinStore {
  settle(command: SettleSpinCommand, calculate: () => SpinResult): Promise<SettledSpin>;
  claimReward(playerId: string, rewardId: string, coins: number): Promise<RewardClaim>;
  getProfile(playerId: string): Promise<PlayerProfile>;
  listWalletTransactions(playerId: string, limit: number): Promise<readonly WalletTransaction[]>;
  getCheckWinStatus(playerId: string): Promise<CheckWinStatus>;
  claimCheckWin(playerId: string, idempotencyKey: string): Promise<CheckWinClaim>;
  getBoosterStatus(playerId: string): Promise<BoosterStatus>;
  craftBooster(playerId: string, idempotencyKey: string): Promise<BoosterCraft>;
  activateBooster(playerId: string, idempotencyKey: string): Promise<BoosterActivation>;
  getLoyaltyRewards(playerId: string): Promise<LoyaltyRewardsStatus>;
  redeemLoyaltyReward(playerId: string, offerId: string, idempotencyKey: string): Promise<LoyaltyRedemption>;
  getHighRollerClub(playerId: string, now: Date): Promise<HighRollerClubStatus>;
  activateHighRollerClub(playerId: string, idempotencyKey: string, now: Date): Promise<HighRollerActivation>;
  getTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardStatus>;
  claimTimedReward(playerId: string, type: TimedRewardType, now: Date): Promise<TimedRewardClaim>;
  getWheelStatus(playerId: string, now: Date): Promise<WheelStatus>;
  spinWheel(playerId: string, idempotencyKey: string, randomUnit: number, now: Date): Promise<WheelSpinResult>;
  getMissions(playerId: string, now: Date): Promise<readonly MissionView[]>;
  claimMission(playerId: string, missionId: string, now: Date): Promise<MissionClaim>;
  getLiveEvents(playerId: string, now: Date): Promise<readonly LiveEventView[]>;
  claimEventMilestone(playerId: string, eventId: string, milestoneId: string, now: Date): Promise<EventMilestoneClaim>;
  getActiveTournament(playerId: string, now: Date): Promise<TournamentView>;
  getJackpots(): Promise<readonly JackpotPoolView[]>;
  purchaseShopOffer(playerId: string, offer: ShopOffer, idempotencyKey: string): Promise<ShopPurchase>;
  grantStorePurchase(command: GrantStorePurchaseCommand): Promise<StorePurchaseSettlement>;
  refundStorePurchase(command: StoreRefundCommand): Promise<boolean>;
  close(): Promise<void>;
}

export class InsufficientFundsError extends Error {}
export class RewardAlreadyClaimedError extends Error {}
export class RewardNotAvailableError extends Error {
  public constructor(public readonly availableAt: Date) { super("Timed reward is not available"); }
}
export class WheelNotAvailableError extends Error {}
export class MissionNotClaimableError extends Error {}
export class EventMilestoneNotClaimableError extends Error {}
export class InsufficientGemsError extends Error {}
export class CheckWinNotClaimableError extends Error {}
export class BoosterNotCraftableError extends Error {}
export class BoosterNotAvailableError extends Error {}
export class BoosterActionConflictError extends Error {}
export class LoyaltyRewardNotFoundError extends Error {}
export class InsufficientLoyaltyPointsError extends Error {}
export class LoyaltyRedemptionConflictError extends Error {}
export class HighRollerNotEligibleError extends Error {}
export class HighRollerAlreadyActiveError extends Error {}
export class ShopOfferLimitReachedError extends Error {}
export class StoreTransactionConflictError extends Error {}
export class StoreProductLimitReachedError extends Error {}
export class StorePurchaseRevokedError extends Error {}
export class StorePurchaseDebtError extends Error {}
