BEGIN;

CREATE TABLE IF NOT EXISTS progressive_jackpots (
  tier text PRIMARY KEY CHECK (tier IN ('MINI', 'MINOR', 'GRAND')),
  pool_amount bigint NOT NULL CHECK (pool_amount >= 0),
  seed_amount bigint NOT NULL CHECK (seed_amount > 0),
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO progressive_jackpots (tier, pool_amount, seed_amount) VALUES
  ('MINI', 500000, 500000),
  ('MINOR', 5000000, 5000000),
  ('GRAND', 50000000, 50000000)
ON CONFLICT (tier) DO NOTHING;

COMMIT;
