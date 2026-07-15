BEGIN;

ALTER TABLE clan_messages ADD COLUMN removed_by_staff varchar(128);

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
      WHERE conrelid = 'clan_messages'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%removed_at%'
  LOOP
    EXECUTE format('ALTER TABLE clan_messages DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE clan_messages ADD CONSTRAINT clan_messages_removal_actor_check CHECK (
  (status = 'active' AND removed_at IS NULL AND removed_by IS NULL AND removed_by_staff IS NULL)
  OR (status = 'removed' AND removed_at IS NOT NULL AND num_nonnulls(removed_by, removed_by_staff) = 1)
);

CREATE TABLE clan_moderation_cases (
  id uuid PRIMARY KEY,
  clan_id uuid NOT NULL,
  message_id uuid NOT NULL UNIQUE,
  author_id uuid NOT NULL,
  author_display_name varchar(40) NOT NULL,
  author_level integer NOT NULL CHECK (author_level >= 1),
  message_snapshot varchar(280) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  first_reported_at timestamptz NOT NULL DEFAULT now(),
  last_reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by varchar(128),
  decision text CHECK (decision IN ('remove_message', 'dismiss')),
  resolution_note varchar(500),
  CHECK ((status = 'open' AND resolved_at IS NULL AND resolved_by IS NULL AND decision IS NULL AND resolution_note IS NULL)
    OR (status <> 'open' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND decision IS NOT NULL AND resolution_note IS NOT NULL))
);
CREATE INDEX clan_moderation_cases_queue_idx ON clan_moderation_cases (status, last_reported_at DESC);

CREATE TABLE clan_message_reports (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES clan_moderation_cases(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'sexual', 'personal_data', 'other')),
  details varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, reporter_id)
);
CREATE INDEX clan_message_reports_case_idx ON clan_message_reports (case_id, created_at DESC);

CREATE TABLE clan_moderation_actions (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES clan_moderation_cases(id),
  actor varchar(128) NOT NULL,
  decision text NOT NULL CHECK (decision IN ('remove_message', 'dismiss')),
  note varchar(500) NOT NULL CHECK (length(btrim(note)) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clan_moderation_actions_created_idx ON clan_moderation_actions (created_at DESC);

CREATE OR REPLACE FUNCTION reject_clan_moderation_action_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'clan moderation actions are immutable'; END; $$;
CREATE TRIGGER clan_moderation_actions_immutable
  BEFORE UPDATE OR DELETE ON clan_moderation_actions
  FOR EACH ROW EXECUTE FUNCTION reject_clan_moderation_action_mutation();

COMMIT;
