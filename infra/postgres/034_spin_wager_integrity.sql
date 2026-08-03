BEGIN;

ALTER TABLE spins
  ADD COLUMN IF NOT EXISTS base_bet bigint,
  ADD COLUMN IF NOT EXISTS effective_wager bigint,
  ADD COLUMN IF NOT EXISTS bonus_buy boolean;

UPDATE spins
   SET base_bet = COALESCE(base_bet, bet),
       effective_wager = COALESCE(effective_wager, bet),
       bonus_buy = COALESCE(bonus_buy, false);

ALTER TABLE spins
  ALTER COLUMN base_bet SET NOT NULL,
  ALTER COLUMN effective_wager SET NOT NULL,
  ALTER COLUMN bonus_buy SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spins_base_bet_positive'
  ) THEN
    ALTER TABLE spins
      ADD CONSTRAINT spins_base_bet_positive CHECK (base_bet > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spins_effective_wager_valid'
  ) THEN
    ALTER TABLE spins
      ADD CONSTRAINT spins_effective_wager_valid CHECK (effective_wager >= base_bet);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spins_non_bonus_wager_matches_base_bet'
  ) THEN
    ALTER TABLE spins
      ADD CONSTRAINT spins_non_bonus_wager_matches_base_bet CHECK (bonus_buy OR effective_wager = base_bet);
  END IF;
END $$;

COMMIT;
