BEGIN;
ALTER TABLE mission_definitions
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS translation_key text;
UPDATE mission_definitions SET translation_key='mission.' || replace(id, '-', '_')
 WHERE translation_key IS NULL OR translation_key='';
ALTER TABLE mission_definitions ALTER COLUMN translation_key SET NOT NULL;
ALTER TABLE mission_definitions ALTER COLUMN translation_key SET DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mission_definitions_tier_check') THEN
    ALTER TABLE mission_definitions ADD CONSTRAINT mission_definitions_tier_check
      CHECK (tier IN ('standard','pro','super','crazy'));
  END IF;
END $$;
INSERT INTO mission_definitions (id,version,cadence,tier,translation_key,metric,target,reward_coins) VALUES
 ('weekly-spins-100',1,'weekly','pro','mission.weekly_spins_100','spin_count',100,750000),
 ('weekly-wager-250000',1,'weekly','super','mission.weekly_wager_250000','wager_total',250000,1500000),
 ('weekly-free-spins-25',1,'weekly','crazy','mission.weekly_free_spins_25','free_spin_count',25,2000000)
ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,cadence=EXCLUDED.cadence,tier=EXCLUDED.tier,
 translation_key=EXCLUDED.translation_key,metric=EXCLUDED.metric,target=EXCLUDED.target,reward_coins=EXCLUDED.reward_coins;
COMMIT;
