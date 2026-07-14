BEGIN;

CREATE TABLE IF NOT EXISTS mission_definitions (
  id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'event')),
  metric text NOT NULL CHECK (metric IN ('spin_count', 'wager_total', 'win_total', 'free_spin_count')),
  target bigint NOT NULL CHECK (target > 0),
  reward_coins bigint NOT NULL CHECK (reward_coins > 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS mission_progress (
  player_id uuid NOT NULL REFERENCES players(id),
  mission_id text NOT NULL REFERENCES mission_definitions(id),
  period_key date NOT NULL,
  progress bigint NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, mission_id, period_key)
);
CREATE INDEX IF NOT EXISTS mission_progress_player_period_idx ON mission_progress (player_id, period_key);

INSERT INTO mission_definitions (id, version, cadence, metric, target, reward_coins) VALUES
  ('daily-spins-10', 1, 'daily', 'spin_count', 10, 100000),
  ('daily-wager-10000', 1, 'daily', 'wager_total', 10000, 150000),
  ('daily-win-50000', 1, 'daily', 'win_total', 50000, 200000),
  ('daily-free-spins-3', 1, 'daily', 'free_spin_count', 3, 250000)
ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version, cadence=EXCLUDED.cadence,
  metric=EXCLUDED.metric, target=EXCLUDED.target, reward_coins=EXCLUDED.reward_coins;

COMMIT;
