BEGIN;

CREATE TABLE IF NOT EXISTS player_cloud_saves (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE player_cloud_saves IS
  'Versioned, server-authoritative cross-device preferences and non-economy player state.';

COMMIT;
