BEGIN;

ALTER TABLE spins
  ADD COLUMN IF NOT EXISTS balance_before bigint,
  ADD COLUMN IF NOT EXISTS server_version text,
  ADD COLUMN IF NOT EXISTS math_model_version text;

UPDATE spins
   SET balance_before = COALESCE(balance_before, balance_after + bet - win),
       server_version = COALESCE(server_version, 'legacy'),
       math_model_version = COALESCE(math_model_version, '1.0.0');

ALTER TABLE spins
  ALTER COLUMN balance_before SET NOT NULL,
  ALTER COLUMN server_version SET NOT NULL,
  ALTER COLUMN math_model_version SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spins_balance_before_nonnegative'
  ) THEN
    ALTER TABLE spins
      ADD CONSTRAINT spins_balance_before_nonnegative CHECK (balance_before >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS spin_events (
  spin_id uuid NOT NULL REFERENCES spins(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  phase text NOT NULL,
  round_index integer NOT NULL CHECK (round_index >= 0),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (spin_id, sequence)
);

CREATE INDEX IF NOT EXISTS spin_events_type_idx ON spin_events (event_type);

COMMIT;
