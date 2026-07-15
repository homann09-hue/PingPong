BEGIN;

CREATE TABLE IF NOT EXISTS tournament_scores (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id text NOT NULL,
  period_key date NOT NULL,
  score bigint NOT NULL DEFAULT 0 CHECK (score >= 0),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, tournament_id, period_key)
);

CREATE INDEX IF NOT EXISTS tournament_scores_leaderboard_idx
  ON tournament_scores (tournament_id, period_key, score DESC, updated_at ASC);

COMMIT;
