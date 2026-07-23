BEGIN;

CREATE TABLE players (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  level integer NOT NULL DEFAULT 1 CHECK (level > 0),
  xp bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  vip_points bigint NOT NULL DEFAULT 0 CHECK (vip_points >= 0)
);

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  provider text NOT NULL CHECK (provider IN ('guest', 'apple', 'google', 'email')),
  provider_subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE devices (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  installation_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, installation_id)
);

CREATE TABLE sessions (
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

CREATE INDEX sessions_player_active_idx ON sessions (player_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE wallets (
  player_id uuid NOT NULL REFERENCES players(id),
  currency text NOT NULL CHECK (currency IN ('coin', 'gem')),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, currency)
);

CREATE TABLE wallet_ledger (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  currency text NOT NULL CHECK (currency IN ('coin', 'gem')),
  amount bigint NOT NULL CHECK (amount <> 0),
  reason text NOT NULL,
  source text NOT NULL,
  reference_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  balance_before bigint NOT NULL CHECK (balance_before >= 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  admin_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_balance_transition
    CHECK (balance_after = balance_before + amount),
  UNIQUE (player_id, currency, reason, reference_id)
);

CREATE TABLE slot_config_versions (
  slot_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  config jsonb NOT NULL,
  config_sha256 bytea NOT NULL,
  published_at timestamptz,
  PRIMARY KEY (slot_id, version),
  CHECK (published_at IS NULL OR jsonb_typeof(config) = 'object')
);

CREATE TABLE spins (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  idempotency_key uuid NOT NULL,
  slot_id text NOT NULL,
  config_version integer NOT NULL,
  bet bigint NOT NULL CHECK (bet > 0),
  base_bet bigint NOT NULL CHECK (base_bet > 0),
  effective_wager bigint NOT NULL CHECK (effective_wager >= base_bet),
  bonus_buy boolean NOT NULL DEFAULT false,
  win bigint NOT NULL CHECK (win >= 0),
  rng_seed numeric(20,0) NOT NULL,
  result jsonb NOT NULL,
  balance_before bigint NOT NULL CHECK (balance_before >= 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  server_version text NOT NULL,
  math_model_version text NOT NULL,
  progression_after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key),
  CHECK (bonus_buy OR effective_wager = base_bet),
  FOREIGN KEY (slot_id, config_version) REFERENCES slot_config_versions(slot_id, version)
);

CREATE INDEX spins_player_created_idx ON spins (player_id, created_at DESC);

CREATE TABLE spin_events (
  spin_id uuid NOT NULL REFERENCES spins(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  phase text NOT NULL,
  round_index integer NOT NULL CHECK (round_index >= 0),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (spin_id, sequence)
);

CREATE INDEX spin_events_type_idx ON spin_events (event_type);
CREATE INDEX wallet_ledger_player_created_idx ON wallet_ledger (player_id, created_at DESC);
CREATE UNIQUE INDEX wallet_ledger_idempotency_idx ON wallet_ledger (player_id, currency, idempotency_key);
CREATE INDEX wallet_ledger_reference_idx ON wallet_ledger (reference_id);

CREATE TABLE reward_claims (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  reward_id text NOT NULL,
  coins bigint NOT NULL CHECK (coins > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, reward_id)
);

CREATE TABLE timed_reward_states (
  player_id uuid NOT NULL REFERENCES players(id),
  reward_type text NOT NULL CHECK (reward_type IN ('hourly', 'daily')),
  last_claimed_at timestamptz,
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  cycle_position integer NOT NULL DEFAULT 0 CHECK (cycle_position BETWEEN 0 AND 7),
  claims_toward_wheel integer NOT NULL DEFAULT 0 CHECK (claims_toward_wheel BETWEEN 0 AND 3),
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, reward_type)
);

CREATE TABLE wheel_entitlements (
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

CREATE INDEX wheel_entitlements_available_idx
  ON wheel_entitlements (player_id, wheel_type, created_at) WHERE status='available';

CREATE TABLE wheel_spins (
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

CREATE TABLE mission_definitions (
  id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'event')),
  tier text NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'pro', 'super', 'crazy')),
  translation_key text NOT NULL DEFAULT '',
  metric text NOT NULL CHECK (metric IN ('spin_count', 'wager_total', 'win_total', 'free_spin_count')),
  target bigint NOT NULL CHECK (target > 0),
  reward_coins bigint NOT NULL CHECK (reward_coins > 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE mission_progress (
  player_id uuid NOT NULL REFERENCES players(id),
  mission_id text NOT NULL REFERENCES mission_definitions(id),
  period_key date NOT NULL,
  progress bigint NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, mission_id, period_key)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_unpublished_idx ON outbox_events (created_at) WHERE published_at IS NULL;

COMMIT;
