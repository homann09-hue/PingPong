BEGIN;

CREATE INDEX IF NOT EXISTS players_status_idx ON players (status);
CREATE INDEX IF NOT EXISTS spins_created_idx ON spins (created_at DESC);
CREATE INDEX IF NOT EXISTS push_deliveries_processing_locked_idx
  ON push_deliveries (locked_at) WHERE status='processing';
CREATE INDEX IF NOT EXISTS push_deliveries_failed_completed_idx
  ON push_deliveries (completed_at DESC) WHERE status='failed';
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log (created_at DESC);

COMMIT;
