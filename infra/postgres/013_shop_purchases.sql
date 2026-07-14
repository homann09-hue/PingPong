BEGIN;

CREATE TABLE shop_purchases (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  offer_id text NOT NULL,
  period_key text,
  idempotency_key uuid NOT NULL,
  coins bigint NOT NULL CHECK (coins > 0),
  gems_spent bigint NOT NULL CHECK (gems_spent > 0),
  coin_balance_after bigint NOT NULL,
  gem_balance_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE UNIQUE INDEX shop_purchases_limited_offer_idx
  ON shop_purchases (player_id, offer_id, period_key)
  WHERE period_key IS NOT NULL;

COMMIT;
