BEGIN;

INSERT INTO inventory_item_definitions
  (item_id,version,category,rarity,max_stack,tradable,active,metadata)
VALUES
  ('achievement-spin-ticket',1,'ticket','common',100,false,true,
   '{"displayName":"Achievement Spin Ticket","origin":"achievement"}'::jsonb),
  ('achievement-xp-booster',1,'booster','rare',50,false,true,
   '{"displayName":"Achievement XP Booster","durationMinutes":15,"origin":"achievement"}'::jsonb),
  ('achievement-lucky-key',1,'key','epic',25,false,true,
   '{"displayName":"Achievement Lucky Key","origin":"achievement"}'::jsonb),
  ('achievement-legend-token',1,'collectible','legendary',10,false,true,
   '{"displayName":"Achievement Legend Token","origin":"achievement"}'::jsonb);

INSERT INTO loot_table_versions
  (table_id,version,pity_group,pity_after,active,metadata,published_at)
VALUES
  ('achievement-bronze-reward',1,'achievement-bronze',NULL,true,
   '{"producer":"achievement","tier":"bronze"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z'),
  ('achievement-silver-reward',1,'achievement-silver',NULL,true,
   '{"producer":"achievement","tier":"silver"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z'),
  ('achievement-gold-reward',1,'achievement-gold',NULL,true,
   '{"producer":"achievement","tier":"gold"}'::jsonb,TIMESTAMPTZ '2026-07-24T00:00:00Z');

INSERT INTO loot_table_entries
  (table_id,table_version,entry_id,item_id,item_version,entry_kind,weight,
   min_quantity,max_quantity,pity_eligible,metadata)
VALUES
  ('achievement-bronze-reward',1,'bronze-ticket','achievement-spin-ticket',1,'guaranteed',0,1,1,false,'{}'),
  ('achievement-bronze-reward',1,'bronze-booster','achievement-xp-booster',1,'weighted',85,1,1,false,'{}'),
  ('achievement-bronze-reward',1,'bronze-key','achievement-lucky-key',1,'weighted',15,1,1,false,'{}'),

  ('achievement-silver-reward',1,'silver-tickets','achievement-spin-ticket',1,'guaranteed',0,3,3,false,'{}'),
  ('achievement-silver-reward',1,'silver-boosters','achievement-xp-booster',1,'weighted',70,1,2,false,'{}'),
  ('achievement-silver-reward',1,'silver-key','achievement-lucky-key',1,'weighted',30,1,1,false,'{}'),

  ('achievement-gold-reward',1,'gold-tickets','achievement-spin-ticket',1,'guaranteed',0,5,5,false,'{}'),
  ('achievement-gold-reward',1,'gold-key','achievement-lucky-key',1,'guaranteed',0,1,1,false,'{}'),
  ('achievement-gold-reward',1,'gold-boosters','achievement-xp-booster',1,'weighted',80,2,3,false,'{}'),
  ('achievement-gold-reward',1,'gold-legend-token','achievement-legend-token',1,'weighted',20,1,1,false,'{}');

ALTER TABLE achievement_definition_versions
  ADD COLUMN reward_loot_table_id text,
  ADD COLUMN reward_loot_table_version integer,
  ADD COLUMN reward_loot_expires_in_seconds integer;

UPDATE achievement_definition_versions
SET reward_loot_table_id = CASE tier
      WHEN 'bronze' THEN 'achievement-bronze-reward'
      WHEN 'silver' THEN 'achievement-silver-reward'
      ELSE 'achievement-gold-reward'
    END,
    reward_loot_table_version = 1,
    reward_loot_expires_in_seconds = 604800
WHERE active=true;

ALTER TABLE achievement_definition_versions
  ADD CONSTRAINT achievement_definition_loot_reward_all_or_none
  CHECK (
    (reward_loot_table_id IS NULL AND reward_loot_table_version IS NULL AND reward_loot_expires_in_seconds IS NULL)
    OR
    (reward_loot_table_id IS NOT NULL AND reward_loot_table_version IS NOT NULL
      AND reward_loot_expires_in_seconds IS NOT NULL)
  ),
  ADD CONSTRAINT achievement_definition_loot_reward_ttl
  CHECK (reward_loot_expires_in_seconds IS NULL
    OR reward_loot_expires_in_seconds BETWEEN 60 AND 2592000),
  ADD CONSTRAINT achievement_definition_loot_reward_fk
  FOREIGN KEY (reward_loot_table_id,reward_loot_table_version)
  REFERENCES loot_table_versions(table_id,version);

ALTER TABLE achievement_claims_v1
  ADD COLUMN loot_entitlement_id uuid UNIQUE REFERENCES loot_entitlements(id);

COMMIT;
