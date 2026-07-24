BEGIN;

CREATE OR REPLACE FUNCTION protect_achievement_completion_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.completion_evidence IS NOT NULL AND (
    NEW.completion_evidence IS DISTINCT FROM OLD.completion_evidence
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RAISE EXCEPTION 'achievement completion evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_achievement_completion_immutable ON player_achievement_progress;
CREATE TRIGGER player_achievement_completion_immutable
BEFORE UPDATE ON player_achievement_progress
FOR EACH ROW
EXECUTE FUNCTION protect_achievement_completion_evidence();

CREATE OR REPLACE FUNCTION protect_achievement_claim_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'achievement claims are append-only';
END;
$$;

DROP TRIGGER IF EXISTS achievement_claims_append_only ON achievement_claims_v1;
CREATE TRIGGER achievement_claims_append_only
BEFORE UPDATE OR DELETE ON achievement_claims_v1
FOR EACH ROW
EXECUTE FUNCTION protect_achievement_claim_append_only();

COMMIT;
