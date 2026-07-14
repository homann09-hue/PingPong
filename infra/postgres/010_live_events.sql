BEGIN;

CREATE TABLE IF NOT EXISTS live_event_progress (
  player_id uuid NOT NULL REFERENCES players(id),
  event_id text NOT NULL,
  period_key date NOT NULL,
  progress bigint NOT NULL DEFAULT 0 CHECK (progress >= 0),
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, event_id, period_key)
);

CREATE TABLE IF NOT EXISTS live_event_claims (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  event_id text NOT NULL,
  period_key date NOT NULL,
  milestone_id text NOT NULL,
  reward_coins bigint NOT NULL CHECK (reward_coins > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, event_id, period_key, milestone_id)
);

CREATE INDEX IF NOT EXISTS live_event_progress_player_idx
  ON live_event_progress (player_id, period_key);
CREATE INDEX IF NOT EXISTS live_event_claims_player_idx
  ON live_event_claims (player_id, period_key);

COMMIT;
