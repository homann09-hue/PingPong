BEGIN;

ALTER TABLE verified_store_purchases
  ADD COLUMN IF NOT EXISTS provider_state text;

UPDATE verified_store_purchases
SET provider_state = 'purchased'
WHERE provider_state IS NULL;

ALTER TABLE verified_store_purchases
  ALTER COLUMN provider_state SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'verified_store_purchases'::regclass
      AND conname = 'verified_store_purchases_provider_state_check'
  ) THEN
    ALTER TABLE verified_store_purchases
      ADD CONSTRAINT verified_store_purchases_provider_state_check
      CHECK (provider_state = 'purchased');
  END IF;
END
$$;

ALTER TABLE verified_store_purchases
  ADD COLUMN IF NOT EXISTS store_kind text;

UPDATE verified_store_purchases
SET store_kind = CASE
  WHEN purchase_limit_key IS NULL THEN 'consumable'
  ELSE 'nonConsumable'
END
WHERE store_kind IS NULL;

ALTER TABLE verified_store_purchases
  ALTER COLUMN store_kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'verified_store_purchases'::regclass
      AND conname = 'verified_store_purchases_store_kind_check'
  ) THEN
    ALTER TABLE verified_store_purchases
      ADD CONSTRAINT verified_store_purchases_store_kind_check
      CHECK (store_kind IN ('consumable', 'nonConsumable'));
  END IF;
END
$$;

ALTER TABLE verified_store_purchases
  DROP COLUMN IF EXISTS provider_finalized;

COMMIT;
