BEGIN;

CREATE TABLE IF NOT EXISTS client_analytics_events (
  event_id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  event_name text NOT NULL CHECK (event_name IN ('screen.viewed','offer.impression','slot.presentation_completed','ui.error')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  app_version varchar(32) NOT NULL,
  screen varchar(64),
  slot_id varchar(64),
  campaign_id uuid,
  CHECK (occurred_at <= received_at + interval '5 minutes'),
  CHECK (occurred_at >= received_at - interval '24 hours')
);
CREATE INDEX IF NOT EXISTS client_analytics_events_received_idx ON client_analytics_events (received_at);
CREATE INDEX IF NOT EXISTS client_analytics_events_name_received_idx ON client_analytics_events (event_name, received_at DESC);

CREATE OR REPLACE FUNCTION purge_client_analytics_events(retention interval DEFAULT interval '30 days')
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE deleted_rows bigint;
BEGIN
  IF retention < interval '1 day' THEN RAISE EXCEPTION 'analytics retention must be at least one day'; END IF;
  DELETE FROM client_analytics_events WHERE received_at < now() - retention;
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$;

COMMIT;
