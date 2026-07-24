BEGIN;

CREATE OR REPLACE FUNCTION protect_mission_definition_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mission definition versions are append-only';
END;
$$;
CREATE TRIGGER mission_definition_versions_append_only
BEFORE UPDATE OR DELETE ON mission_definition_versions
FOR EACH ROW EXECUTE FUNCTION protect_mission_definition_version();

CREATE OR REPLACE FUNCTION validate_mission_definition_pointer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM mission_definition_versions AS versioned
     WHERE versioned.mission_id=NEW.id
       AND versioned.version=NEW.version
       AND versioned.cadence=NEW.cadence
       AND versioned.tier=NEW.tier
       AND versioned.translation_key=NEW.translation_key
       AND versioned.metric=NEW.metric
       AND versioned.target=NEW.target
       AND versioned.reward_coins=NEW.reward_coins
       AND versioned.reward_mission_points=NEW.reward_mission_points
       AND versioned.reward_loyalty_points=NEW.reward_loyalty_points
       AND versioned.reward_stamps=NEW.reward_stamps
       AND versioned.reward_toolboxes=NEW.reward_toolboxes
       AND versioned.reward_boosters=NEW.reward_boosters
       AND versioned.unlock_daily_claims=NEW.unlock_daily_claims
       AND versioned.unlock_pro_claims=NEW.unlock_pro_claims
       AND versioned.active=NEW.active
       AND versioned.starts_at IS NOT DISTINCT FROM NEW.starts_at
       AND versioned.ends_at IS NOT DISTINCT FROM NEW.ends_at
  ) THEN
    RAISE EXCEPTION 'mission definition pointer must match a published immutable version';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mission_definition_pointer_valid
BEFORE INSERT OR UPDATE ON mission_definitions
FOR EACH ROW EXECUTE FUNCTION validate_mission_definition_pointer();

CREATE OR REPLACE FUNCTION protect_mission_progress_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mission_version IS DISTINCT FROM OLD.mission_version THEN
    RAISE EXCEPTION 'mission progress version is immutable';
  END IF;
  IF OLD.claimed_at IS NOT NULL AND NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
    RAISE EXCEPTION 'mission claimed_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mission_progress_evidence_immutable
BEFORE UPDATE ON mission_progress
FOR EACH ROW EXECUTE FUNCTION protect_mission_progress_evidence();

CREATE OR REPLACE FUNCTION validate_mission_claim_entitlement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition mission_definition_versions%ROWTYPE;
  entitlement loot_entitlements%ROWTYPE;
  progress mission_progress%ROWTYPE;
  expected_reference text;
  expected_expiry timestamptz;
BEGIN
  SELECT * INTO definition
    FROM mission_definition_versions
   WHERE mission_id=NEW.mission_id AND version=NEW.mission_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission claim definition version does not exist'; END IF;

  SELECT * INTO progress
    FROM mission_progress
   WHERE player_id=NEW.player_id AND mission_id=NEW.mission_id AND period_key=NEW.period_key;
  IF NOT FOUND OR progress.mission_version<>NEW.mission_version THEN
    RAISE EXCEPTION 'mission claim is not bound to matching progress';
  END IF;
  IF progress.progress<>NEW.progress_at_claim OR NEW.progress_at_claim<definition.target THEN
    RAISE EXCEPTION 'mission claim progress evidence is invalid';
  END IF;

  IF definition.reward_loot_table_id IS NULL THEN
    IF NEW.loot_entitlement_id IS NOT NULL THEN
      RAISE EXCEPTION 'mission without loot reward cannot reference an entitlement';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.loot_entitlement_id IS NULL THEN
    RAISE EXCEPTION 'mission claim requires an entitlement';
  END IF;

  SELECT * INTO entitlement FROM loot_entitlements WHERE id=NEW.loot_entitlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission entitlement does not exist'; END IF;
  expected_reference := NEW.mission_id || ':v' || NEW.mission_version || ':' || NEW.period_key;
  expected_expiry := NEW.claimed_at + make_interval(secs => definition.reward_loot_expires_in_seconds);

  IF entitlement.player_id<>NEW.player_id
    OR entitlement.table_id<>definition.reward_loot_table_id
    OR entitlement.table_version<>definition.reward_loot_table_version
    OR entitlement.source<>'mission'
    OR entitlement.reference_id<>expected_reference
    OR entitlement.status<>'available'
    OR entitlement.issued_at<>NEW.claimed_at
    OR entitlement.expires_at<>expected_expiry
    OR entitlement.metadata->>'claimId'<>NEW.id::text
    OR entitlement.metadata->>'missionId'<>NEW.mission_id
    OR entitlement.metadata->>'missionVersion'<>NEW.mission_version::text
    OR entitlement.metadata->>'periodKey'<>NEW.period_key::text
  THEN
    RAISE EXCEPTION 'mission claim entitlement binding is invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mission_claim_entitlement_valid
BEFORE INSERT ON mission_claims_v1
FOR EACH ROW EXECUTE FUNCTION validate_mission_claim_entitlement();

CREATE OR REPLACE FUNCTION protect_mission_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mission claims are append-only';
END;
$$;
CREATE TRIGGER mission_claims_append_only
BEFORE UPDATE OR DELETE ON mission_claims_v1
FOR EACH ROW EXECUTE FUNCTION protect_mission_claim();

CREATE OR REPLACE FUNCTION validate_mission_progress_claim_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.claimed_at IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM mission_claims_v1 AS claim
     WHERE claim.player_id=NEW.player_id
       AND claim.mission_id=NEW.mission_id
       AND claim.mission_version=NEW.mission_version
       AND claim.period_key=NEW.period_key
       AND claim.claimed_at=NEW.claimed_at
  ) THEN
    RAISE EXCEPTION 'mission claimed_at requires durable claim evidence';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER mission_progress_claim_evidence_valid
AFTER INSERT OR UPDATE OF claimed_at ON mission_progress
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_mission_progress_claim_evidence();

COMMIT;
