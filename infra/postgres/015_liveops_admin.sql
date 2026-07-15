BEGIN;

CREATE TABLE IF NOT EXISTS liveops_campaigns (
  id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name varchar(80) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  min_level integer NOT NULL DEFAULT 1 CHECK (min_level > 0),
  min_vip_points bigint NOT NULL DEFAULT 0 CHECK (min_vip_points >= 0),
  title varchar(60) NOT NULL,
  subtitle varchar(140) NOT NULL,
  cta_label varchar(24) NOT NULL,
  created_by text NOT NULL,
  published_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (id, version),
  CHECK (ends_at > starts_at),
  CHECK ((status='published') = (published_by IS NOT NULL AND published_at IS NOT NULL)),
  CHECK (published_by IS NULL OR published_by <> created_by)
);
CREATE INDEX IF NOT EXISTS liveops_campaigns_active_idx
  ON liveops_campaigns (starts_at, ends_at, min_level, min_vip_points)
  WHERE status='published';

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
  ON admin_audit_log (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_immutable ON admin_audit_log;
CREATE TRIGGER admin_audit_log_immutable
BEFORE UPDATE OR DELETE ON admin_audit_log
FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_mutation();

COMMIT;
