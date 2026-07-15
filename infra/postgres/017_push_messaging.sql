BEGIN;

CREATE TABLE IF NOT EXISTS push_preferences (
  player_id uuid PRIMARY KEY REFERENCES players(id),
  enabled boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  rewards boolean NOT NULL DEFAULT true,
  social boolean NOT NULL DEFAULT true,
  quiet_hours_start_minutes smallint,
  quiet_hours_end_minutes smallint,
  time_zone varchar(64) NOT NULL DEFAULT 'UTC' CHECK (time_zone ~ '^[A-Za-z0-9_+/-]{1,64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((quiet_hours_start_minutes IS NULL) = (quiet_hours_end_minutes IS NULL)),
  CHECK (quiet_hours_start_minutes IS NULL OR quiet_hours_start_minutes BETWEEN 0 AND 1439),
  CHECK (quiet_hours_end_minutes IS NULL OR quiet_hours_end_minutes BETWEEN 0 AND 1439),
  CHECK (quiet_hours_start_minutes IS NULL OR quiet_hours_start_minutes <> quiet_hours_end_minutes)
);

CREATE TABLE IF NOT EXISTS push_installations (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  installation_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  provider text NOT NULL CHECK (provider IN ('apns','fcm','web_push')),
  token_ciphertext text NOT NULL CHECK (length(token_ciphertext) BETWEEN 16 AND 8192),
  token_fingerprint char(64) NOT NULL CHECK (token_fingerprint ~ '^[0-9a-f]{64}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, installation_id),
  CHECK ((provider='apns' AND platform='ios') OR provider='fcm' OR (provider='web_push' AND platform='web'))
);
CREATE UNIQUE INDEX IF NOT EXISTS push_installations_active_token_idx
  ON push_installations (token_fingerprint) WHERE active;
CREATE INDEX IF NOT EXISTS push_installations_player_active_idx
  ON push_installations (player_id, updated_at DESC) WHERE active;

CREATE TABLE IF NOT EXISTS push_campaign_dispatches (
  campaign_id uuid NOT NULL,
  campaign_version integer NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL,
  queued_count integer NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
  PRIMARY KEY (campaign_id, campaign_version),
  FOREIGN KEY (campaign_id, campaign_version) REFERENCES liveops_campaigns(id, version)
);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL,
  campaign_version integer NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id),
  installation_id uuid NOT NULL REFERENCES push_installations(id),
  category text NOT NULL CHECK (category IN ('marketing','rewards','social','system')),
  title varchar(60) NOT NULL,
  body varchar(140) NOT NULL,
  deep_link varchar(256) NOT NULL CHECK (deep_link ~ '^/[A-Za-z0-9_?&=./-]*$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','suppressed')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  available_at timestamptz NOT NULL,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error varchar(256),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, campaign_version, installation_id),
  FOREIGN KEY (campaign_id, campaign_version) REFERENCES liveops_campaigns(id, version),
  CHECK ((status='processing') = (locked_at IS NOT NULL)),
  CHECK ((status IN ('delivered','failed','suppressed')) = (completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending_idx
  ON push_deliveries (available_at, id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS push_deliveries_player_idx
  ON push_deliveries (player_id, created_at DESC);

CREATE OR REPLACE FUNCTION purge_push_delivery_history(retention interval DEFAULT interval '30 days')
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE deleted_rows bigint;
BEGIN
  IF retention < interval '1 day' THEN RAISE EXCEPTION 'push retention must be at least one day'; END IF;
  DELETE FROM push_deliveries
   WHERE completed_at < now() - retention AND status IN ('delivered','failed','suppressed');
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$;

COMMIT;
