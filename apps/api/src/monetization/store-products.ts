export type StorePlatform = "ios" | "android";

export interface StoreProduct {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly badge: string;
  readonly featured: boolean;
  readonly grantCoins: number;
  readonly grantGems: number;
  readonly grantHighRollerPoints: number;
  readonly purchaseLimit: "once" | "repeatable";
  readonly storeKind: "consumable" | "nonConsumable";
  readonly storeProductIds: Readonly<Record<StorePlatform, string>>;
}

/** Version-controlled entitlement catalog; localized prices always come from the platform store. */
export const storeProducts: readonly StoreProduct[] = [
  {
    key: "starter-vault", title: "STARTER VAULT", description: "Einmaliges Willkommenspaket",
    badge: "STARTER +200%", featured: true, grantCoins: 2_000_000, grantGems: 100, grantHighRollerPoints: 4_000, purchaseLimit: "once", storeKind: "nonConsumable",
    storeProductIds: { ios: "com.aurora.socialcasino.starter_vault", android: "aurora_starter_vault" },
  },
  {
    key: "coin-stack", title: "COIN STACK", description: "1.000.000 virtuelle Coins",
    badge: "POPULAR", featured: false, grantCoins: 1_000_000, grantGems: 0, grantHighRollerPoints: 1_000, purchaseLimit: "repeatable", storeKind: "consumable",
    storeProductIds: { ios: "com.aurora.socialcasino.coin_stack", android: "aurora_coin_stack" },
  },
  {
    key: "fortune-chest", title: "FORTUNE CHEST", description: "5.000.000 virtuelle Coins",
    badge: "+25% BONUS", featured: false, grantCoins: 5_000_000, grantGems: 150, grantHighRollerPoints: 6_000, purchaseLimit: "repeatable", storeKind: "consumable",
    storeProductIds: { ios: "com.aurora.socialcasino.fortune_chest", android: "aurora_fortune_chest" },
  },
  {
    key: "royal-treasury", title: "ROYAL TREASURY", description: "15.000.000 virtuelle Coins",
    badge: "BEST VALUE", featured: false, grantCoins: 15_000_000, grantGems: 600, grantHighRollerPoints: 20_000, purchaseLimit: "repeatable", storeKind: "consumable",
    storeProductIds: { ios: "com.aurora.socialcasino.royal_treasury", android: "aurora_royal_treasury" },
  },
] as const;

export function findStoreProduct(platform: StorePlatform, storeProductId: string): StoreProduct | undefined {
  return storeProducts.find((product) => product.storeProductIds[platform] === storeProductId);
}
