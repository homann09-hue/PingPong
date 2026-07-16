BEGIN;

ALTER TABLE progressive_jackpots
  DROP CONSTRAINT IF EXISTS progressive_jackpots_tier_check;

ALTER TABLE progressive_jackpots
  ADD CONSTRAINT progressive_jackpots_tier_check
  CHECK (tier IN ('MINI', 'MINOR', 'MAJOR', 'GRAND'));

INSERT INTO progressive_jackpots (tier, pool_amount, seed_amount)
VALUES ('MAJOR', 15000000, 15000000)
ON CONFLICT (tier) DO NOTHING;

COMMIT;
