BEGIN;

CREATE UNIQUE INDEX clan_members_single_owner_idx
  ON clan_members (clan_id) WHERE role = 'owner';

CREATE TABLE clan_member_actions (
  id uuid PRIMARY KEY,
  clan_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('role_changed', 'removed', 'ownership_transferred')),
  previous_role text CHECK (previous_role IN ('owner', 'officer', 'member')),
  new_role text CHECK (new_role IN ('owner', 'officer', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_id <> target_id)
);
CREATE INDEX clan_member_actions_clan_created_idx ON clan_member_actions (clan_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_clan_member_action_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'clan member actions are immutable'; END; $$;
CREATE TRIGGER clan_member_actions_immutable
  BEFORE UPDATE OR DELETE ON clan_member_actions
  FOR EACH ROW EXECUTE FUNCTION reject_clan_member_action_mutation();

COMMIT;
