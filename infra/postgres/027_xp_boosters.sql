BEGIN;

CREATE TABLE IF NOT EXISTS player_boost_states (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  remaining_spins integer NOT NULL DEFAULT 0 CHECK (remaining_spins BETWEEN 0 AND 200),
  version bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS booster_actions (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('craft','activate')),
  idempotency_key uuid NOT NULL,
  rule_version integer NOT NULL CHECK (rule_version > 0),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS booster_actions_player_created_idx
  ON booster_actions (player_id, created_at DESC);

COMMIT;
