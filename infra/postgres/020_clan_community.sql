BEGIN;

CREATE TABLE clan_invitations (
  id uuid PRIMARY KEY,
  clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (inviter_id <> recipient_id)
);
CREATE UNIQUE INDEX clan_invitations_pending_recipient_idx
  ON clan_invitations (clan_id, recipient_id) WHERE status = 'pending';
CREATE INDEX clan_invitations_inbox_idx
  ON clan_invitations (recipient_id, created_at DESC) WHERE status = 'pending';

CREATE TABLE clan_messages (
  id uuid PRIMARY KEY,
  clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body varchar(280) NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 280)
    CHECK (body !~ '[[:cntrl:]]'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES players(id) ON DELETE SET NULL,
  CHECK ((status = 'active' AND removed_at IS NULL AND removed_by IS NULL)
    OR (status = 'removed' AND removed_at IS NOT NULL AND removed_by IS NOT NULL))
);
CREATE INDEX clan_messages_feed_idx
  ON clan_messages (clan_id, created_at DESC, id DESC);
CREATE INDEX clan_messages_author_rate_idx
  ON clan_messages (author_id, created_at DESC);

COMMIT;
