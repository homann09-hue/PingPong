BEGIN;

CREATE TABLE IF NOT EXISTS economy_grant_requests (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  currency text NOT NULL CHECK (currency IN ('coin','gem')),
  amount bigint NOT NULL CHECK (amount > 0),
  reason varchar(500) NOT NULL CHECK (length(trim(reason)) >= 3),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by varchar(128) NOT NULL,
  resolved_by varchar(128),
  requested_at timestamptz NOT NULL,
  resolved_at timestamptz,
  balance_before bigint CHECK (balance_before >= 0),
  balance_after bigint CHECK (balance_after >= 0),
  CHECK (resolved_by IS NULL OR resolved_by <> requested_by),
  CHECK ((status='pending') = (resolved_by IS NULL AND resolved_at IS NULL)),
  CHECK ((status='approved') = (balance_before IS NOT NULL AND balance_after IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS economy_grant_requests_queue_idx
  ON economy_grant_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS economy_grant_requests_player_idx
  ON economy_grant_requests (player_id, requested_at DESC);

COMMIT;
