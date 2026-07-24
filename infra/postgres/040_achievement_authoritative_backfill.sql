BEGIN;

CREATE OR REPLACE FUNCTION backfill_player_achievement_progress(
  p_player_id uuid,
  p_occurred_at timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  progression jsonb;
BEGIN
  SELECT jsonb_build_object(
    'level', p.level,
    'xp', p.xp,
    'spins', COALESCE((latest.progression_after->>'spins')::bigint, 0),
    'totalWon', COALESCE((latest.progression_after->>'totalWon')::bigint, 0),
    'freeSpins', COALESCE((latest.progression_after->>'freeSpins')::bigint, 0),
    'vipPoints', p.vip_points
  )
  INTO progression
  FROM players p
  LEFT JOIN LATERAL (
    SELECT s.progression_after
      FROM spins s
     WHERE s.player_id=p.id
     ORDER BY s.created_at DESC,s.id DESC
     LIMIT 1
  ) latest ON true
  WHERE p.id=p_player_id;

  IF progression IS NULL THEN
    RAISE EXCEPTION 'achievement player does not exist';
  END IF;

  PERFORM project_achievement_progress(
    p_player_id, progression, 'backfill', p_player_id::text, p_occurred_at
  );
END;
$$;

COMMIT;
