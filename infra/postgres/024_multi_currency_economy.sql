BEGIN;

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_currency_check CHECK (currency IN (
  'coin','gem','loyalty_point','high_roller_point','clan_point','league_point',
  'mission_point','lotsa_cash','stamp','check_win_mark','booster','oinky_coupon'
));

ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_currency_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_currency_check CHECK (currency IN (
  'coin','gem','loyalty_point','high_roller_point','clan_point','league_point',
  'mission_point','lotsa_cash','stamp','check_win_mark','booster','oinky_coupon'
));

INSERT INTO wallets (player_id,currency,balance)
SELECT players.id,currency,0
FROM players
CROSS JOIN unnest(ARRAY[
  'loyalty_point','high_roller_point','clan_point','league_point','mission_point',
  'lotsa_cash','stamp','check_win_mark','booster','oinky_coupon'
]) AS currency
ON CONFLICT (player_id,currency) DO NOTHING;

COMMIT;
