BEGIN;

ALTER TABLE verified_store_purchases
  ADD COLUMN IF NOT EXISTS high_roller_points_granted bigint NOT NULL DEFAULT 0 CHECK (high_roller_points_granted >= 0),
  ADD COLUMN IF NOT EXISTS high_roller_point_balance_after bigint NOT NULL DEFAULT 0 CHECK (high_roller_point_balance_after >= 0),
  ADD COLUMN IF NOT EXISTS high_roller_points_recovered bigint NOT NULL DEFAULT 0 CHECK (high_roller_points_recovered >= 0 AND high_roller_points_recovered <= high_roller_points_granted),
  ADD COLUMN IF NOT EXISTS unrecovered_high_roller_points bigint NOT NULL DEFAULT 0 CHECK (unrecovered_high_roller_points >= 0);

COMMIT;
