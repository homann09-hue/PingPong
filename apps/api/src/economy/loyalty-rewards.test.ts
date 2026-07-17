import { describe, expect, it } from "vitest";
import { loyaltyRewardOffer, loyaltyRewardsCatalog, loyaltyRewardsStatus } from "./loyalty-rewards.js";

describe("loyalty rewards", () => {
  it("publishes stable, unique and positive exchange terms", () => {
    expect(loyaltyRewardsCatalog.version).toBe(1);
    expect(new Set(loyaltyRewardsCatalog.offers.map((offer) => offer.id)).size).toBe(loyaltyRewardsCatalog.offers.length);
    for (const offer of loyaltyRewardsCatalog.offers) {
      expect(offer.costLoyaltyPoints).toBeGreaterThan(0);
      expect(offer.rewardAmount).toBeGreaterThan(0);
    }
  });

  it("derives affordability from the authoritative LP balance", () => {
    const status = loyaltyRewardsStatus(500);
    expect(status.offers.map((offer) => [offer.id, offer.canRedeem])).toEqual([
      ["coin-cache", true], ["gem-pouch", true], ["mega-coins", false],
    ]);
    expect(loyaltyRewardOffer("missing")).toBeUndefined();
  });
});
