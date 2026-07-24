BEGIN;

-- Mission catalogue v3: lower the direct coin faucet while preserving
-- progression and inventory rewards. Migration 029 remains immutable.
INSERT INTO mission_definitions
  (id,version,cadence,tier,translation_key,metric,target,reward_coins,reward_mission_points,
   reward_loyalty_points,reward_stamps,reward_toolboxes,reward_boosters,unlock_daily_claims,unlock_pro_claims)
VALUES
 ('daily-spins-10',3,'daily','standard','mission.daily_spins_10','spin_count',10,12500,10,25,0,0,0,0,0),
 ('daily-wager-10000',3,'daily','standard','mission.daily_wager_10000','wager_total',10000,15000,15,40,0,0,0,0,0),
 ('daily-win-50000',3,'daily','standard','mission.daily_win_50000','win_total',50000,20000,20,60,1,0,0,0,0),
 ('pro-spins-40',3,'three_day','pro','mission.pro_spins_40','spin_count',40,45000,40,100,1,0,0,0,0),
 ('pro-wager-100000',3,'three_day','pro','mission.pro_wager_100000','wager_total',100000,75000,60,150,0,1,0,0,0),
 ('super-free-spins-3',3,'daily','super','mission.super_free_spins_3','free_spin_count',3,35000,50,125,1,0,1,3,0),
 ('crazy-win-500000',3,'three_day','crazy','mission.crazy_win_500000','win_total',500000,150000,150,300,2,1,1,3,2),
 ('weekly-bar-1',3,'weekly','standard','mission.weekly_bar_1','daily_mission_claims',1,15000,10,25,0,0,0,0,0),
 ('weekly-bar-3',3,'weekly','pro','mission.weekly_bar_3','daily_mission_claims',3,60000,30,75,1,0,0,0,0),
 ('weekly-bar-7',3,'weekly','crazy','mission.weekly_bar_7','daily_mission_claims',7,200000,100,250,2,1,1,0,0)
ON CONFLICT (id) DO UPDATE SET
 version=EXCLUDED.version,
 cadence=EXCLUDED.cadence,
 tier=EXCLUDED.tier,
 translation_key=EXCLUDED.translation_key,
 metric=EXCLUDED.metric,
 target=EXCLUDED.target,
 reward_coins=EXCLUDED.reward_coins,
 reward_mission_points=EXCLUDED.reward_mission_points,
 reward_loyalty_points=EXCLUDED.reward_loyalty_points,
 reward_stamps=EXCLUDED.reward_stamps,
 reward_toolboxes=EXCLUDED.reward_toolboxes,
 reward_boosters=EXCLUDED.reward_boosters,
 unlock_daily_claims=EXCLUDED.unlock_daily_claims,
 unlock_pro_claims=EXCLUDED.unlock_pro_claims,
 active=true;

COMMIT;
