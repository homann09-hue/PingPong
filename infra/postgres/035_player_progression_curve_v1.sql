BEGIN;

-- The previous implementation stored XP as a remainder of a flat 1,000-XP
-- level. Preserve each player's current level and approximate percentage
-- progress while moving to deterministic curve version 1.
UPDATE players
   SET level = 1000,
       xp = 0
 WHERE level >= 1000;

WITH requirements AS (
  SELECT id,
         GREATEST(1, FLOOR(
           100
           + (level - 1) * 25
           + (level - 1) * (level - 1) * 0.35
         ))::bigint AS required_xp
    FROM players
   WHERE level < 1000
)
UPDATE players AS player
   SET xp = LEAST(
     requirement.required_xp - 1,
     FLOOR((player.xp::numeric / 1000) * requirement.required_xp)::bigint
   )
  FROM requirements AS requirement
 WHERE player.id = requirement.id;

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_level_curve_v1_check;
ALTER TABLE players
  ADD CONSTRAINT players_level_curve_v1_check CHECK (level BETWEEN 1 AND 1000);

COMMIT;
