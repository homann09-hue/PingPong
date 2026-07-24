BEGIN;

CREATE OR REPLACE FUNCTION protect_loot_entitlement_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.player_id IS DISTINCT FROM NEW.player_id
     OR OLD.table_id IS DISTINCT FROM NEW.table_id
     OR OLD.table_version IS DISTINCT FROM NEW.table_version
     OR OLD.source IS DISTINCT FROM NEW.source
     OR OLD.reference_id IS DISTINCT FROM NEW.reference_id
     OR OLD.metadata IS DISTINCT FROM NEW.metadata
     OR OLD.issued_at IS DISTINCT FROM NEW.issued_at
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     OR OLD.request_hash IS DISTINCT FROM NEW.request_hash
     OR OLD.result IS DISTINCT FROM NEW.result THEN
    RAISE EXCEPTION 'loot entitlement identity is immutable';
  END IF;
  IF OLD.status <> 'available' AND OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'terminal loot entitlement status is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER loot_entitlements_identity_guard
BEFORE UPDATE ON loot_entitlements
FOR EACH ROW
EXECUTE FUNCTION protect_loot_entitlement_identity();

CREATE OR REPLACE FUNCTION prevent_loot_entitlement_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'loot entitlements are append-only';
END;
$$;

CREATE TRIGGER loot_entitlements_delete_guard
BEFORE DELETE ON loot_entitlements
FOR EACH ROW
EXECUTE FUNCTION prevent_loot_entitlement_delete();

COMMIT;
