import { describe, expect, it } from "vitest";
import { economyBalances, spinEconomyDeltas, walletCurrencies } from "./currencies.js";

describe("multi-currency economy", () => {
  it("publishes every supported balance exactly once", () => {
    const balances = economyBalances({ coin: 500, gem: 20, vip_point: 7 });
    expect(balances).toHaveLength(walletCurrencies.length);
    expect(new Set(balances.map((entry) => entry.currency)).size).toBe(walletCurrencies.length);
    expect(balances).toContainEqual({ currency: "booster", balance: 0 });
  });

  it("awards higher-bet and win progression without inventing premium collectibles", () => {
    expect(spinEconomyDeltas({ bet: 5_000, totalWin: 12_500, freeSpins: 3 })).toEqual({
      loyalty_point: 50,
      high_roller_point: 5,
      clan_point: 10,
      league_point: 27,
      mission_point: 4,
      check_win_mark: 1,
    });
    expect(spinEconomyDeltas({ bet: 100, totalWin: 0, freeSpins: 0 })).toMatchObject({
      loyalty_point: 1, high_roller_point: 0, check_win_mark: 0,
    });
  });
});
