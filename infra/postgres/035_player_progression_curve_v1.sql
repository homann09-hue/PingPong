BEGIN;

CREATE OR REPLACE FUNCTION player_xp_required_for_next_level_v1(player_level integer)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN player_level BETWEEN 1 AND 999 THEN GREATEST(1, FLOOR(
      100
      + (player_level - 1) * 25
      + (player_level - 1) * (player_level - 1) * 0.35
    ))::bigint
    WHEN player_level = 1000 THEN 0::bigint
    ELSE NULL::bigint
  END
$$;

-- The previous implementation stored XP as a remainder of a flat 1,000-XP
-- level. Preserve each player's current level and approximate percentage
-- progress while moving to deterministic curve version 1.
UPDATE players
   SET level = 1000,
       xp = 0
 WHERE level >= 1000;

UPDATE players
   SET level = 1
 WHERE level < 1;

UPDATE players AS player
   SET xp = LEAST(
     player_xp_required_for_next_level_v1(player.level) - 1,
     FLOOR((GREATEST(player.xp, 0)::numeric / 1000)
       * player_xp_required_for_next_level_v1(player.level))::bigint
   )
 WHERE player.level < 1000;

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_level_curve_v1_check;
ALTER TABLE players
  ADD CONSTRAINT players_level_curve_v1_check CHECK (
    level BETWEEN 1 AND 1000
    AND (
      (level = 1000 AND xp = 0)
      OR (
        level < 1000
        AND xp >= 0
        AND xp < player_xp_required_for_next_level_v1(level)
      )
    )
  );

COMMIT;
