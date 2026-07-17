import type { WalletCurrency } from "./currencies.js";

export interface LoyaltyRewardOffer {
  readonly id: string;
  readonly title: string;
  readonly costLoyaltyPoints: number;
  readonly rewardCurrency: Extract<WalletCurrency, "coin" | "gem">;
  readonly rewardAmount: number;
}

export interface LoyaltyRewardOfferView extends LoyaltyRewardOffer {
  readonly canRedeem: boolean;
}

export interface LoyaltyRewardsStatus {
  readonly version: number;
  readonly loyaltyPoints: number;
  readonly offers: readonly LoyaltyRewardOfferView[];
}

export interface LoyaltyRedemption {
  readonly redemptionId: string;
  readonly offerId: string;
  readonly loyaltyPointsSpent: number;
  readonly rewardCurrency: "coin" | "gem";
  readonly rewardAmount: number;
  readonly loyaltyPointBalance: number;
  readonly rewardBalance: number;
  readonly replayed: boolean;
}

/** Versioned exchange terms. Existing redemptions retain their booked values. */
export const loyaltyRewardsCatalog = {
  version: 1,
  offers: [
    { id: "coin-cache", title: "Coin Cache", costLoyaltyPoints: 100, rewardCurrency: "coin", rewardAmount: 100_000 },
    { id: "gem-pouch", title: "Gem Pouch", costLoyaltyPoints: 500, rewardCurrency: "gem", rewardAmount: 25 },
    { id: "mega-coins", title: "Mega Coins", costLoyaltyPoints: 1_000, rewardCurrency: "coin", rewardAmount: 1_500_000 },
  ] satisfies readonly LoyaltyRewardOffer[],
} as const;

export function loyaltyRewardOffer(offerId: string): LoyaltyRewardOffer | undefined {
  return loyaltyRewardsCatalog.offers.find((offer) => offer.id === offerId);
}

export function loyaltyRewardsStatus(loyaltyPoints: number): LoyaltyRewardsStatus {
  return {
    version: loyaltyRewardsCatalog.version,
    loyaltyPoints,
    offers: loyaltyRewardsCatalog.offers.map((offer) => ({
      ...offer,
      canRedeem: loyaltyPoints >= offer.costLoyaltyPoints,
    })),
  };
}
