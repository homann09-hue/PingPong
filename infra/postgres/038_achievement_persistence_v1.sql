BEGIN;

CREATE TABLE achievement_definition_versions (
  achievement_id text NOT NULL CHECK (length(achievement_id) BETWEEN 3 AND 128),
  version integer NOT NULL CHECK (version > 0),
  category text NOT NULL CHECK (category IN ('journey','spins','wins','free_spins','vip')),
  tier text NOT NULL CHECK (tier IN ('bronze','silver','gold')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 240),
  metric text NOT NULL CHECK (metric IN ('level','spins','total_won','free_spins','vip_points')),
  target bigint NOT NULL CHECK (target > 0),
  reward_coins bigint NOT NULL CHECK (reward_coins >= 0),
  prerequisite_achievement_id text,
  prerequisite_version integer,
  active boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (achievement_id, version),
  CHECK ((prerequisite_achievement_id IS NULL) = (prerequisite_version IS NULL)),
  FOREIGN KEY (prerequisite_achievement_id, prerequisite_version)
    REFERENCES achievement_definition_versions(achievement_id, version)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX achievement_definition_active_idx
  ON achievement_definition_versions (achievement_id)
  WHERE active;

CREATE TABLE player_achievement_progress (
  player_id uuid NOT NULL REFERENCES players(id),
  achievement_id text NOT NULL,
  achievement_version integer NOT NULL,
  progress bigint NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  progress_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(progress_evidence) = 'object'),
  completion_evidence jsonb CHECK (completion_evidence IS NULL OR jsonb_typeof(completion_evidence) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  PRIMARY KEY (player_id, achievement_id, achievement_version),
  FOREIGN KEY (achievement_id, achievement_version)
    REFERENCES achievement_definition_versions(achievement_id, version),
  CHECK ((completed_at IS NULL) = (completion_evidence IS NULL))
);

CREATE INDEX player_achievement_progress_completed_idx
  ON player_achievement_progress (player_id, completed_at)
  WHERE completed_at IS NOT NULL;

CREATE TABLE achievement_claims_v1 (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  achievement_id text NOT NULL,
  achievement_version integer NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  progress_at_claim bigint NOT NULL CHECK (progress_at_claim >= 0),
  completion_evidence jsonb NOT NULL CHECK (jsonb_typeof(completion_evidence) = 'object'),
  reward_coins bigint NOT NULL CHECK (reward_coins >= 0),
  coin_balance_after bigint NOT NULL CHECK (coin_balance_after >= 0),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (achievement_id, achievement_version)
    REFERENCES achievement_definition_versions(achievement_id, version),
  UNIQUE (player_id, idempotency_key),
  UNIQUE (player_id, achievement_id)
);

CREATE INDEX achievement_claims_player_created_idx
  ON achievement_claims_v1 (player_id, claimed_at DESC);

INSERT INTO achievement_definition_versions
  (achievement_id,version,category,tier,name,description,metric,target,reward_coins,
   prerequisite_achievement_id,prerequisite_version,active,published_at)
VALUES
  ('achievement-journey-2',1,'journey','bronze','AUFBRUCH','Erreiche Level 2','level',2,100000,NULL,NULL,true,now()),
  ('achievement-journey-10',1,'journey','silver','CASINO-ENTDECKER','Erreiche Level 10','level',10,750000,'achievement-journey-2',1,true,now()),
  ('achievement-journey-25',1,'journey','gold','LEGENDÄRE REISE','Erreiche Level 25','level',25,3000000,'achievement-journey-10',1,true,now()),
  ('achievement-first-spin',1,'spins','bronze','FIRST SPIN','Spiele 1 Spin','spins',1,75000,NULL,NULL,true,now()),
  ('achievement-high-roller',1,'spins','silver','HIGH ROLLER','Spiele 100 Spins','spins',100,500000,'achievement-first-spin',1,true,now()),
  ('achievement-spin-master',1,'spins','gold','SPIN MASTER','Spiele 1.000 Spins','spins',1000,5000000,'achievement-high-roller',1,true,now()),
  ('achievement-collector',1,'wins','bronze','COIN COLLECTOR','Gewinne insgesamt 250.000 Coins','total_won',250000,250000,NULL,NULL,true,now()),
  ('achievement-millionaire',1,'wins','silver','MILLIONENJÄGER','Gewinne insgesamt 5.000.000 Coins','total_won',5000000,1000000,'achievement-collector',1,true,now()),
  ('achievement-vault-breaker',1,'wins','gold','VAULT BREAKER','Gewinne insgesamt 50.000.000 Coins','total_won',50000000,7500000,'achievement-millionaire',1,true,now()),
  ('achievement-free-spins-3',1,'free_spins','bronze','BONUS STARTER','Spiele insgesamt 3 Freispiele','free_spins',3,200000,NULL,NULL,true,now()),
  ('achievement-free-spins-25',1,'free_spins','silver','FREE-SPIN FAN','Spiele insgesamt 25 Freispiele','free_spins',25,1000000,'achievement-free-spins-3',1,true,now()),
  ('achievement-free-spins-100',1,'free_spins','gold','BONUS LEGEND','Spiele insgesamt 100 Freispiele','free_spins',100,5000000,'achievement-free-spins-25',1,true,now()),
  ('achievement-vip-100',1,'vip','bronze','VIP ANWÄRTER','Sammle 100 VIP-Punkte','vip_points',100,150000,NULL,NULL,true,now()),
  ('achievement-vip-1000',1,'vip','silver','VIP SILBER','Sammle 1.000 VIP-Punkte','vip_points',1000,1000000,'achievement-vip-100',1,true,now()),
  ('achievement-vip-7500',1,'vip','gold','VIP PLATIN','Sammle 7.500 VIP-Punkte','vip_points',7500,7500000,'achievement-vip-1000',1,true,now());

CREATE OR REPLACE FUNCTION project_achievement_progress(
  p_player_id uuid,
  p_progression jsonb,
  p_source_type text,
  p_source_id text,
  p_occurred_at timestamptz
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF jsonb_typeof(p_progression) <> 'object' THEN
    RAISE EXCEPTION 'achievement progression evidence must be an object';
  END IF;

  INSERT INTO player_achievement_progress
    (player_id,achievement_id,achievement_version,progress,completed_at,
     progress_evidence,completion_evidence,updated_at)
  SELECT
    p_player_id,
    definition.achievement_id,
    definition.version,
    metric_value.progress,
    CASE WHEN metric_value.progress >= definition.target THEN p_occurred_at END,
    evidence.payload,
    CASE WHEN metric_value.progress >= definition.target THEN evidence.payload END,
    p_occurred_at
  FROM achievement_definition_versions definition
  CROSS JOIN LATERAL (
    SELECT GREATEST(0, CASE definition.metric
      WHEN 'level' THEN COALESCE((p_progression->>'level')::bigint,0)
      WHEN 'spins' THEN COALESCE((p_progression->>'spins')::bigint,0)
      WHEN 'total_won' THEN COALESCE((p_progression->>'totalWon')::bigint,0)
      WHEN 'free_spins' THEN COALESCE((p_progression->>'freeSpins')::bigint,0)
      WHEN 'vip_points' THEN COALESCE((p_progression->>'vipPoints')::bigint,0)
    END) AS progress
  ) metric_value
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'sourceType', p_source_type,
      'sourceId', p_source_id,
      'occurredAt', p_occurred_at,
      'metric', definition.metric,
      'progress', metric_value.progress,
      'progression', p_progression
    ) AS payload
  ) evidence
  WHERE definition.active=true
    AND definition.published_at IS NOT NULL
    AND definition.published_at <= p_occurred_at
  ON CONFLICT (player_id,achievement_id,achievement_version) DO UPDATE
    SET progress=GREATEST(player_achievement_progress.progress,EXCLUDED.progress),
        completed_at=COALESCE(player_achievement_progress.completed_at,EXCLUDED.completed_at),
        progress_evidence=CASE
          WHEN EXCLUDED.progress > player_achievement_progress.progress THEN EXCLUDED.progress_evidence
          ELSE player_achievement_progress.progress_evidence
        END,
        completion_evidence=COALESCE(player_achievement_progress.completion_evidence,EXCLUDED.completion_evidence),
        updated_at=CASE
          WHEN EXCLUDED.progress > player_achievement_progress.progress THEN EXCLUDED.updated_at
          ELSE player_achievement_progress.updated_at
        END,
        version=player_achievement_progress.version +
          CASE WHEN EXCLUDED.progress > player_achievement_progress.progress THEN 1 ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_player_achievement_progress(
  p_player_id uuid,
  p_occurred_at timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  progression jsonb;
BEGIN
  SELECT COALESCE(
    (SELECT s.progression_after FROM spins s
      WHERE s.player_id=p.id ORDER BY s.created_at DESC,s.id DESC LIMIT 1),
    jsonb_build_object(
      'level',p.level,
      'xp',p.xp,
      'spins',0,
      'totalWon',0,
      'freeSpins',0,
      'vipPoints',p.vip_points
    )
  ) INTO progression
  FROM players p
  WHERE p.id=p_player_id;

  IF progression IS NULL THEN
    RAISE EXCEPTION 'achievement player does not exist';
  END IF;

  PERFORM project_achievement_progress(
    p_player_id, progression, 'backfill', p_player_id::text, p_occurred_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION project_spin_achievements_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM project_achievement_progress(
    NEW.player_id,
    NEW.progression_after,
    'spin',
    NEW.id::text,
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spins_project_achievements ON spins;
CREATE TRIGGER spins_project_achievements
AFTER INSERT ON spins
FOR EACH ROW
EXECUTE FUNCTION project_spin_achievements_trigger();

COMMIT;
