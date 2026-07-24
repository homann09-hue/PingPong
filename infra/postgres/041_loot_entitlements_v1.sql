BEGIN;

CREATE TABLE loot_entitlements (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  table_id text NOT NULL,
  table_version integer NOT NULL CHECK (table_version > 0),
  source text NOT NULL CHECK (length(source) BETWEEN 1 AND 100),
  reference_id text NOT NULL CHECK (length(reference_id) BETWEEN 1 AND 200),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','consumed','expired','revoked')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_opening_id uuid UNIQUE,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  FOREIGN KEY (table_id, table_version) REFERENCES loot_table_versions(table_id, version),
  UNIQUE (player_id, idempotency_key),
  UNIQUE (player_id, source, reference_id),
  CHECK (expires_at > issued_at),
  CHECK ((status = 'consumed' AND consumed_at IS NOT NULL AND consumed_opening_id IS NOT NULL)
      OR (status <> 'consumed' AND consumed_at IS NULL AND consumed_opening_id IS NULL))
);

CREATE INDEX loot_entitlements_available_idx
  ON loot_entitlements (player_id, expires_at, issued_at) WHERE status = 'available';
CREATE INDEX loot_entitlements_expiry_idx
  ON loot_entitlements (expires_at, id) WHERE status = 'available';

ALTER TABLE loot_openings ADD COLUMN entitlement_id uuid;
ALTER TABLE loot_openings ADD CONSTRAINT loot_openings_entitlement_fk
  FOREIGN KEY (entitlement_id) REFERENCES loot_entitlements(id) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX loot_openings_entitlement_idx
  ON loot_openings (entitlement_id) WHERE entitlement_id IS NOT NULL;
ALTER TABLE loot_entitlements ADD CONSTRAINT loot_entitlements_consumed_opening_fk
  FOREIGN KEY (consumed_opening_id) REFERENCES loot_openings(id) DEFERRABLE INITIALLY DEFERRED;

COMMIT;
