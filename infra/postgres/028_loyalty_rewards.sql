BEGIN;

CREATE TABLE loyalty_redemptions (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  catalog_version integer NOT NULL CHECK (catalog_version > 0),
  offer_id text NOT NULL CHECK (offer_id ~ '^[a-z0-9-]{1,64}$'),
  loyalty_points_spent bigint NOT NULL CHECK (loyalty_points_spent > 0),
  reward_currency text NOT NULL CHECK (reward_currency IN ('coin','gem')),
  reward_amount bigint NOT NULL CHECK (reward_amount > 0),
  loyalty_balance_after bigint NOT NULL CHECK (loyalty_balance_after >= 0),
  reward_balance_after bigint NOT NULL CHECK (reward_balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id,idempotency_key)
);

CREATE INDEX loyalty_redemptions_player_created_idx
  ON loyalty_redemptions (player_id,created_at DESC);

COMMIT;
