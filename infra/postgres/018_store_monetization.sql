CREATE TABLE IF NOT EXISTS verified_store_purchases (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  product_key text NOT NULL,
  store_product_id text NOT NULL,
  store_kind text NOT NULL CHECK (store_kind IN ('consumable','nonConsumable')),
  transaction_id text NOT NULL,
  original_transaction_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  status text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','refunded')),
  purchased_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verification_hash char(64) NOT NULL CHECK (verification_hash ~ '^[0-9a-f]{64}$'),
  provider_state text NOT NULL CHECK (provider_state='purchased'),
  purchase_limit_key text,
  coins_granted bigint NOT NULL CHECK (coins_granted > 0),
  gems_granted bigint NOT NULL CHECK (gems_granted >= 0),
  coin_balance_after bigint NOT NULL CHECK (coin_balance_after >= 0),
  gem_balance_after bigint NOT NULL CHECK (gem_balance_after >= 0),
  refunded_at timestamptz,
  coins_recovered bigint NOT NULL DEFAULT 0 CHECK (coins_recovered >= 0 AND coins_recovered <= coins_granted),
  gems_recovered bigint NOT NULL DEFAULT 0 CHECK (gems_recovered >= 0 AND gems_recovered <= gems_granted),
  unrecovered_coins bigint NOT NULL DEFAULT 0 CHECK (unrecovered_coins >= 0),
  unrecovered_gems bigint NOT NULL DEFAULT 0 CHECK (unrecovered_gems >= 0),
  UNIQUE (platform, transaction_id),
  CHECK ((status='granted' AND refunded_at IS NULL) OR (status='refunded' AND refunded_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS verified_store_purchase_limit_unique
  ON verified_store_purchases(player_id, purchase_limit_key)
  WHERE purchase_limit_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS verified_store_purchases_player_idx
  ON verified_store_purchases(player_id, verified_at DESC);

CREATE TABLE IF NOT EXISTS store_purchase_events (
  event_id uuid PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  transaction_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type='refund'),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  provider_payload_hash char(64) NOT NULL CHECK (provider_payload_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS store_purchase_events_transaction_idx
  ON store_purchase_events(platform, transaction_id);

COMMENT ON TABLE verified_store_purchases IS
  'Long-lived financial audit records. Raw receipts and purchase tokens must never be stored.';
COMMENT ON TABLE store_purchase_events IS
  'Idempotent provider lifecycle events containing hashes only; retention follows financial audit policy.';
