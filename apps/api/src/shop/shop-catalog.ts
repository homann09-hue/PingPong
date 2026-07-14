export interface ShopOffer {
  readonly id: string;
  readonly title: string;
  readonly coins: number;
  readonly costGems: number;
  readonly badge: string;
  readonly featured: boolean;
  readonly periodKey: string | null;
  readonly expiresAt: string | null;
}

export function activeShopOffers(now: Date): readonly ShopOffer[] {
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const periodKey = now.toISOString().slice(0, 10);
  return [
    { id: "daily-fortune", title: "DAILY FORTUNE", coins: 200_000, costGems: 20,
      badge: "DAILY +100%", featured: true, periodKey, expiresAt: tomorrow.toISOString() },
    { id: "starter-fortune", title: "STARTER FORTUNE", coins: 500_000, costGems: 60,
      badge: "BEST VALUE", featured: false, periodKey: null, expiresAt: null },
    { id: "royal-vault", title: "ROYAL VAULT", coins: 1_500_000, costGems: 150,
      badge: "+40% BONUS", featured: false, periodKey: null, expiresAt: null },
    { id: "vip-treasure", title: "VIP TREASURE", coins: 3_500_000, costGems: 300,
      badge: "VIP", featured: false, periodKey: null, expiresAt: null },
  ];
}
