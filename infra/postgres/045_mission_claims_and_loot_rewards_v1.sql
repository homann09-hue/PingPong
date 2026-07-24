BEGIN;

INSERT INTO loot_table_versions
  (table_id,version,pity_group,pity_after,active,metadata,published_at)
VALUES
  ('mission-standard-reward',1,'mission-standard',NULL,true,
   '{"producer":"mission","tier":"standard"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z'),
  ('mission-pro-reward',1,'mission-pro',NULL,true,
   '{"producer":"mission","tier":"pro"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z'),
  ('mission-super-reward',1,'mission-super',NULL,true,
   '{"producer":"mission","tier":"super"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z'),
  ('mission-crazy-reward',1,'mission-crazy',NULL,true,
   '{"producer":"mission","tier":"crazy"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z');

INSERT INTO loot_table_entries
  (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,
   min_quantity,max_quantity,pity_eligible,metadata)
VALUES
  ('mission-standard-reward',1,'standard-ticket','achievement-spin-ticket',1,'guaranteed',0,1,1,false,'{}'),
  ('mission-standard-reward',1,'standard-booster','achievement-xp-booster',1,'weighted',90,1,1,false,'{}'),
  ('mission-standard-reward',1,'standard-key','achievement-lucky-key',1,'weighted',10,1,1,false,'{}'),

  ('mission-pro-reward',1,'pro-tickets','achievement-spin-ticket',1,'guaranteed',0,2,2,false,'{}'),
  ('mission-pro-reward',1,'pro-booster','achievement-xp-booster',1,'weighted',75,1,2,false,'{}'),
  ('mission-pro-reward',1,'pro-key','achievement-lucky-key',1,'weighted',25,1,1,false,'{}'),

  ('mission-super-reward',1,'super-tickets','achievement-spin-ticket',1,'guaranteed',0,3,3,false,'{}'),
  ('mission-super-reward',1,'super-booster','achievement-xp-booster',1,'guaranteed',0,1,1,false,'{}'),
  ('mission-super-reward',1,'super-key','achievement-lucky-key',1,'weighted',70,1,1,false,'{}'),
  ('mission-super-reward',1,'super-legend-token','achievement-legend-token',1,'weighted',30,1,1,false,'{}'),

  ('mission-crazy-reward',1,'crazy-tickets','achievement-spin-ticket',1,'guaranteed',0,5,5,false,'{}'),
  ('mission-crazy-reward',1,'crazy-key','achievement-lucky-key',1,'guaranteed',0,1,1,false,'{}'),
  ('mission-crazy-reward',1,'crazy-boosters','achievement-xp-booster',1,'weighted',75,2,3,false,'{}'),
  ('mission-crazy-reward',1,'crazy-legend-token','achievement-legend-token',1,'weighted',25,1,1,false,'{}');

CREATE TABLE mission_definition_versions (
  mission_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  cadence text NOT NULL CHECK (cadence IN ('daily','three_day','weekly','event')),
  tier text NOT NULL CHECK (tier IN ('standard','pro','super','crazy')),
  translation_key text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('spin_count','wager_total','win_total','free_spin_count','daily_mission_claims')),
  target bigint NOT NULL CHECK (target > 0),
  reward_coins bigint NOT NULL CHECK (reward_coins >= 0),
  reward_mission_points bigint NOT NULL CHECK (reward_mission_points >= 0),
  reward_loyalty_points bigint NOT NULL CHECK (reward_loyalty_points >= 0),
  reward_stamps bigint NOT NULL CHECK (reward_stamps >= 0),
  reward_toolboxes bigint NOT NULL CHECK (reward_toolboxes >= 0),
  reward_boosters bigint NOT NULL CHECK (reward_boosters >= 0),
  unlock_daily_claims integer NOT NULL CHECK (unlock_daily_claims >= 0),
  unlock_pro_claims integer NOT NULL CHECK (unlock_pro_claims >= 0),
  reward_loot_table_id text,
  reward_loot_table_version integer,
  reward_loot_expires_in_seconds integer,
  active boolean NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  PRIMARY KEY (mission_id,version),
  FOREIGN KEY (reward_loot_table_id,reward_loot_table_version)
    REFERENCES loot_table_versions(table_id,version),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (
    (reward_loot_table_id IS NULL AND reward_loot_table_version IS NULL AND reward_loot_expires_in_seconds IS NULL)
    OR
    (reward_loot_table_id IS NOT NULL AND reward_loot_table_version IS NOT NULL
      AND reward_loot_expires_in_seconds BETWEEN 60 AND 2592000)
  )
);

INSERT INTO mission_definition_versions
  (mission_id,version,cadence,tier,translation_key,metric,target,reward_coins,
   reward_mission_points,reward_loyalty_points,reward_stamps,reward_toolboxes,
   reward_boosters,unlock_daily_claims,unlock_pro_claims,reward_loot_table_id,
   reward_loot_table_version,reward_loot_expires_in_seconds,active,starts_at,ends_at,
   published_at,metadata)
SELECT id,version,cadence,tier,translation_key,metric,target,reward_coins,
       reward_mission_points,reward_loyalty_points,reward_stamps,reward_toolboxes,
       reward_boosters,unlock_daily_claims,unlock_pro_claims,
       CASE tier
         WHEN 'standard' THEN 'mission-standard-reward'
         WHEN 'pro' THEN 'mission-pro-reward'
         WHEN 'super' THEN 'mission-super-reward'
         ELSE 'mission-crazy-reward'
       END,
       1,604800,active,starts_at,ends_at,TIMESTAMPTZ '2026-07-24T00:00:00Z',
       jsonb_build_object('catalogVersion',version,'producer','mission')
  FROM mission_definitions;

ALTER TABLE mission_progress ADD COLUMN mission_version integer;
UPDATE mission_progress AS progress
   SET mission_version=definitions.version
  FROM mission_definitions AS definitions
 WHERE definitions.id=progress.mission_id;
ALTER TABLE mission_progress ALTER COLUMN mission_version SET NOT NULL;
ALTER TABLE mission_progress ADD CONSTRAINT mission_progress_definition_version_fk
  FOREIGN KEY (mission_id,mission_version)
  REFERENCES mission_definition_versions(mission_id,version);

CREATE TABLE mission_claims_v1 (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  mission_id text NOT NULL,
  mission_version integer NOT NULL CHECK (mission_version > 0),
  period_key date NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  progress_at_claim bigint NOT NULL CHECK (progress_at_claim >= 0),
  rewards jsonb NOT NULL CHECK (jsonb_typeof(rewards) = 'object'),
  balances jsonb NOT NULL CHECK (jsonb_typeof(balances) = 'object'),
  loot_entitlement_id uuid UNIQUE REFERENCES loot_entitlements(id),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  claimed_at timestamptz NOT NULL,
  FOREIGN KEY (mission_id,mission_version)
    REFERENCES mission_definition_versions(mission_id,version),
  FOREIGN KEY (player_id,mission_id,period_key)
    REFERENCES mission_progress(player_id,mission_id,period_key),
  UNIQUE (player_id,idempotency_key),
  UNIQUE (player_id,mission_id,mission_version,period_key)
);
CREATE INDEX mission_claims_player_claimed_idx
  ON mission_claims_v1 (player_id,claimed_at DESC,id DESC);

COMMIT;
