BEGIN;

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_currency_check CHECK (currency IN (
  'coin','gem','loyalty_point','high_roller_point','clan_point','league_point',
  'mission_point','lotsa_cash','stamp','check_win_mark','booster','oinky_coupon','toolbox'
));
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_currency_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_currency_check CHECK (currency IN (
  'coin','gem','loyalty_point','high_roller_point','clan_point','league_point',
  'mission_point','lotsa_cash','stamp','check_win_mark','booster','oinky_coupon','toolbox'
));
INSERT INTO wallets (player_id,currency,balance)
SELECT id,'toolbox',0 FROM players ON CONFLICT (player_id,currency) DO NOTHING;

ALTER TABLE mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_cadence_check;
ALTER TABLE mission_definitions ADD CONSTRAINT mission_definitions_cadence_check
  CHECK (cadence IN ('daily','three_day','weekly','event'));
ALTER TABLE mission_definitions DROP CONSTRAINT IF EXISTS mission_definitions_metric_check;
ALTER TABLE mission_definitions ADD CONSTRAINT mission_definitions_metric_check
  CHECK (metric IN ('spin_count','wager_total','win_total','free_spin_count','daily_mission_claims'));
ALTER TABLE mission_definitions
  ADD COLUMN IF NOT EXISTS reward_mission_points bigint NOT NULL DEFAULT 0 CHECK (reward_mission_points >= 0),
  ADD COLUMN IF NOT EXISTS reward_loyalty_points bigint NOT NULL DEFAULT 0 CHECK (reward_loyalty_points >= 0),
  ADD COLUMN IF NOT EXISTS reward_stamps bigint NOT NULL DEFAULT 0 CHECK (reward_stamps >= 0),
  ADD COLUMN IF NOT EXISTS reward_toolboxes bigint NOT NULL DEFAULT 0 CHECK (reward_toolboxes >= 0),
  ADD COLUMN IF NOT EXISTS reward_boosters bigint NOT NULL DEFAULT 0 CHECK (reward_boosters >= 0),
  ADD COLUMN IF NOT EXISTS unlock_daily_claims integer NOT NULL DEFAULT 0 CHECK (unlock_daily_claims >= 0),
  ADD COLUMN IF NOT EXISTS unlock_pro_claims integer NOT NULL DEFAULT 0 CHECK (unlock_pro_claims >= 0);

INSERT INTO mission_definitions
  (id,version,cadence,tier,translation_key,metric,target,reward_coins,reward_mission_points,
   reward_loyalty_points,reward_stamps,reward_toolboxes,reward_boosters,unlock_daily_claims,unlock_pro_claims)
VALUES
 ('daily-spins-10',2,'daily','standard','mission.daily_spins_10','spin_count',10,100000,10,25,0,0,0,0,0),
 ('daily-wager-10000',2,'daily','standard','mission.daily_wager_10000','wager_total',10000,150000,15,40,0,0,0,0,0),
 ('daily-win-50000',2,'daily','standard','mission.daily_win_50000','win_total',50000,200000,20,60,1,0,0,0,0),
 ('pro-spins-40',2,'three_day','pro','mission.pro_spins_40','spin_count',40,400000,40,100,1,0,0,0,0),
 ('pro-wager-100000',2,'three_day','pro','mission.pro_wager_100000','wager_total',100000,600000,60,150,0,1,0,0,0),
 ('super-free-spins-3',2,'daily','super','mission.super_free_spins_3','free_spin_count',3,500000,50,125,1,0,1,3,0),
 ('crazy-win-500000',2,'three_day','crazy','mission.crazy_win_500000','win_total',500000,2000000,150,300,2,1,1,3,2),
 ('weekly-bar-1',2,'weekly','standard','mission.weekly_bar_1','daily_mission_claims',1,100000,10,25,0,0,0,0,0),
 ('weekly-bar-3',2,'weekly','pro','mission.weekly_bar_3','daily_mission_claims',3,500000,30,75,1,0,0,0,0),
 ('weekly-bar-7',2,'weekly','crazy','mission.weekly_bar_7','daily_mission_claims',7,2500000,100,250,2,1,1,0,0)
ON CONFLICT (id) DO UPDATE SET
 version=EXCLUDED.version,cadence=EXCLUDED.cadence,tier=EXCLUDED.tier,
 translation_key=EXCLUDED.translation_key,metric=EXCLUDED.metric,target=EXCLUDED.target,
 reward_coins=EXCLUDED.reward_coins,reward_mission_points=EXCLUDED.reward_mission_points,
 reward_loyalty_points=EXCLUDED.reward_loyalty_points,reward_stamps=EXCLUDED.reward_stamps,
 reward_toolboxes=EXCLUDED.reward_toolboxes,reward_boosters=EXCLUDED.reward_boosters,
 unlock_daily_claims=EXCLUDED.unlock_daily_claims,unlock_pro_claims=EXCLUDED.unlock_pro_claims,
 active=true;

UPDATE mission_definitions SET active=false WHERE id IN
 ('daily-free-spins-3','weekly-spins-100','weekly-wager-250000','weekly-free-spins-25');

COMMIT;
