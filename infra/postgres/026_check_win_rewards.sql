BEGIN;

CREATE TABLE IF NOT EXISTS check_win_claims (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  reward_version integer NOT NULL CHECK (reward_version > 0),
  marks_spent bigint NOT NULL CHECK (marks_spent > 0),
  coins_granted bigint NOT NULL CHECK (coins_granted > 0),
  stamps_granted bigint NOT NULL CHECK (stamps_granted > 0),
  coin_balance_after bigint NOT NULL CHECK (coin_balance_after >= 0),
  mark_balance_after bigint NOT NULL CHECK (mark_balance_after >= 0),
  stamp_balance_after bigint NOT NULL CHECK (stamp_balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS check_win_claims_player_created_idx
  ON check_win_claims (player_id, created_at DESC);

COMMIT;
