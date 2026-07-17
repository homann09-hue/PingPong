CREATE TABLE IF NOT EXISTS high_roller_memberships (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  active_until timestamptz NOT NULL,
  activated_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
);

CREATE INDEX IF NOT EXISTS high_roller_memberships_active_idx
  ON high_roller_memberships (active_until DESC);

CREATE TABLE IF NOT EXISTS high_roller_activations (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  points_spent bigint NOT NULL CHECK (points_spent > 0),
  stamps_granted bigint NOT NULL CHECK (stamps_granted >= 0),
  active_until timestamptz NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS high_roller_activations_player_created_idx
  ON high_roller_activations (player_id, created_at DESC);
