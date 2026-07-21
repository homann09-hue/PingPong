BEGIN;

-- Betriebsstatus je Slot. Fehlt ein Eintrag, gilt der Slot als regulaer spielbar.
CREATE TABLE IF NOT EXISTS slot_availability (
  slot_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','maintenance','disabled')),
  message varchar(160),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
);

CREATE INDEX IF NOT EXISTS slot_availability_status_idx
  ON slot_availability (status) WHERE status <> 'live';

COMMIT;
