BEGIN;

CREATE TABLE IF NOT EXISTS wheel_entitlements (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  wheel_type text NOT NULL CHECK (wheel_type IN ('standard', 'golden')),
  source_reference_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'consumed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS wheel_entitlements_available_idx
  ON wheel_entitlements (player_id, wheel_type, created_at) WHERE status='available';

CREATE TABLE IF NOT EXISTS wheel_spins (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  entitlement_id uuid NOT NULL UNIQUE REFERENCES wheel_entitlements(id),
  idempotency_key uuid NOT NULL,
  wheel_type text NOT NULL,
  wheel_version integer NOT NULL CHECK (wheel_version > 0),
  segment_id text NOT NULL,
  reward_currency text NOT NULL CHECK (reward_currency IN ('coin', 'gem')),
  reward_amount bigint NOT NULL CHECK (reward_amount > 0),
  balance_before bigint NOT NULL CHECK (balance_before >= 0),
  balance_after bigint NOT NULL CHECK (balance_after = balance_before + reward_amount),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

COMMIT;
