BEGIN;

ALTER TABLE spins
  ADD COLUMN IF NOT EXISTS progression_after jsonb;

UPDATE spins
   SET progression_after = jsonb_build_object(
     'level', 1,
     'xp', 0,
     'spins', 0,
     'totalWon', 0,
     'freeSpins', 0,
     'vipPoints', 0
   )
 WHERE progression_after IS NULL;

ALTER TABLE spins
  ALTER COLUMN progression_after SET NOT NULL;

CREATE TABLE IF NOT EXISTS reward_claims (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  reward_id text NOT NULL,
  coins bigint NOT NULL CHECK (coins > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, reward_id)
);

COMMIT;
