BEGIN;

CREATE TABLE IF NOT EXISTS timed_reward_states (
  player_id uuid NOT NULL REFERENCES players(id),
  reward_type text NOT NULL CHECK (reward_type IN ('hourly', 'daily')),
  last_claimed_at timestamptz,
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  cycle_position integer NOT NULL DEFAULT 0 CHECK (cycle_position BETWEEN 0 AND 7),
  claims_toward_wheel integer NOT NULL DEFAULT 0 CHECK (claims_toward_wheel BETWEEN 0 AND 3),
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, reward_type)
);

CREATE INDEX IF NOT EXISTS timed_reward_available_idx
  ON timed_reward_states (reward_type, last_claimed_at);

COMMIT;
