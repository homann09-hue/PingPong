BEGIN;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope_key text PRIMARY KEY,
  request_count integer NOT NULL CHECK (request_count >= 0),
  window_started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_expires_at_idx
  ON api_rate_limits (expires_at);

COMMENT ON TABLE api_rate_limits IS
  'Cluster-wide fixed-window counters. Keys must contain only derived or hashed subjects, never raw credentials or IP addresses.';

COMMIT;
