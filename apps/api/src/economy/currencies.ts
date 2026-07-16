export const walletCurrencies = [
  "coin", "gem", "loyalty_point", "vip_point", "high_roller_point",
  "clan_point", "league_point", "mission_point", "lotsa_cash", "stamp",
  "check_win_mark", "booster", "oinky_coupon",
] as const;

export type WalletCurrency = typeof walletCurrencies[number];

export interface EconomyBalance {
  readonly currency: WalletCurrency;
  readonly balance: number;
}

export type SpinEconomyCurrency = Exclude<WalletCurrency, "coin" | "gem" | "vip_point">;

/** Versioned non-coin progression policy applied once per idempotent settled spin. */
export function spinEconomyDeltas(input: {
  readonly bet: number;
  readonly totalWin: number;
  readonly freeSpins: number;
}): Readonly<Partial<Record<SpinEconomyCurrency, number>>> {
  return {
    loyalty_point: Math.max(1, Math.floor(input.bet / 100)),
    high_roller_point: input.bet >= 5_000 ? Math.max(1, Math.floor(input.bet / 1_000)) : 0,
    clan_point: Math.max(1, Math.floor(input.bet / 500)),
    league_point: Math.max(1, Math.floor(input.bet / 200)) + Math.floor(input.totalWin / Math.max(1, input.bet)),
    mission_point: 1 + input.freeSpins,
    check_win_mark: input.totalWin > 0 ? 1 : 0,
  };
}

export function economyBalances(
  values: Readonly<Partial<Record<WalletCurrency, number>>>,
): readonly EconomyBalance[] {
  return walletCurrencies.map((currency) => ({ currency, balance: values[currency] ?? 0 }));
}
