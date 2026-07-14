BEGIN;

CREATE TABLE IF NOT EXISTS auth_identities (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  provider text NOT NULL CHECK (provider IN ('guest', 'apple', 'google', 'email')),
  provider_subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  installation_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, installation_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  refresh_token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  rotated_from uuid REFERENCES sessions(id),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS sessions_player_active_idx ON sessions (player_id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
