BEGIN;

CREATE OR REPLACE FUNCTION protect_published_achievement_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
       OLD.achievement_id IS DISTINCT FROM NEW.achievement_id
    OR OLD.version IS DISTINCT FROM NEW.version
    OR OLD.category IS DISTINCT FROM NEW.category
    OR OLD.tier IS DISTINCT FROM NEW.tier
    OR OLD.name IS DISTINCT FROM NEW.name
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.metric IS DISTINCT FROM NEW.metric
    OR OLD.target IS DISTINCT FROM NEW.target
    OR OLD.reward_coins IS DISTINCT FROM NEW.reward_coins
    OR OLD.reward_loot_table_id IS DISTINCT FROM NEW.reward_loot_table_id
    OR OLD.reward_loot_table_version IS DISTINCT FROM NEW.reward_loot_table_version
    OR OLD.reward_loot_expires_in_seconds IS DISTINCT FROM NEW.reward_loot_expires_in_seconds
    OR OLD.prerequisite_achievement_id IS DISTINCT FROM NEW.prerequisite_achievement_id
    OR OLD.prerequisite_version IS DISTINCT FROM NEW.prerequisite_version
    OR OLD.published_at IS DISTINCT FROM NEW.published_at
    OR OLD.metadata IS DISTINCT FROM NEW.metadata
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  ) THEN
    RAISE EXCEPTION 'published achievement definition semantics are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER achievement_definition_semantics_guard
BEFORE UPDATE ON achievement_definition_versions
FOR EACH ROW
EXECUTE FUNCTION protect_published_achievement_definition();

CREATE OR REPLACE FUNCTION validate_achievement_claim_loot_entitlement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition achievement_definition_versions%ROWTYPE;
  entitlement loot_entitlements%ROWTYPE;
  expected_reference text;
BEGIN
  SELECT * INTO definition
    FROM achievement_definition_versions
   WHERE achievement_id=NEW.achievement_id AND version=NEW.achievement_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'achievement definition does not exist';
  END IF;

  IF definition.reward_loot_table_id IS NULL THEN
    IF NEW.loot_entitlement_id IS NOT NULL THEN
      RAISE EXCEPTION 'achievement without loot reward cannot reference an entitlement';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.loot_entitlement_id IS NULL THEN
    RAISE EXCEPTION 'achievement loot reward requires an entitlement';
  END IF;

  SELECT * INTO entitlement
    FROM loot_entitlements
   WHERE id=NEW.loot_entitlement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'achievement loot entitlement does not exist';
  END IF;

  expected_reference := NEW.achievement_id || ':v' || NEW.achievement_version::text;
  IF entitlement.player_id IS DISTINCT FROM NEW.player_id
     OR entitlement.table_id IS DISTINCT FROM definition.reward_loot_table_id
     OR entitlement.table_version IS DISTINCT FROM definition.reward_loot_table_version
     OR entitlement.source IS DISTINCT FROM 'achievement'
     OR entitlement.reference_id IS DISTINCT FROM expected_reference
     OR entitlement.status IS DISTINCT FROM 'available'
     OR entitlement.issued_at > NEW.claimed_at
     OR entitlement.expires_at <= NEW.claimed_at
     OR entitlement.metadata->>'claimId' IS DISTINCT FROM NEW.id::text
     OR entitlement.metadata->>'achievementId' IS DISTINCT FROM NEW.achievement_id
     OR (entitlement.metadata->>'achievementVersion')::integer IS DISTINCT FROM NEW.achievement_version THEN
    RAISE EXCEPTION 'achievement loot entitlement binding is invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER achievement_claim_loot_entitlement_guard
BEFORE INSERT ON achievement_claims_v1
FOR EACH ROW
EXECUTE FUNCTION validate_achievement_claim_loot_entitlement();

COMMIT;
