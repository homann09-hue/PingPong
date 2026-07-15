BEGIN;

CREATE TABLE social_profiles (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  display_name varchar(24) NOT NULL CHECK (display_name ~ '^[A-Za-z0-9 _-]{3,24}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX social_profiles_name_idx ON social_profiles (lower(display_name));

INSERT INTO social_profiles (player_id, display_name)
SELECT id, 'PLAYER-' || upper(left(replace(id::text, '-', ''), 6)) FROM players
ON CONFLICT (player_id) DO NOTHING;

CREATE TABLE friend_requests (
  id uuid PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (sender_id <> recipient_id)
);
CREATE UNIQUE INDEX friend_requests_pending_pair_idx
  ON friend_requests (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)) WHERE status='pending';
CREATE INDEX friend_requests_recipient_idx ON friend_requests (recipient_id, created_at DESC) WHERE status='pending';

CREATE TABLE friendships (
  player_low uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_high uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_low, player_high),
  CHECK (player_low < player_high)
);
CREATE INDEX friendships_high_idx ON friendships (player_high);

CREATE TABLE clans (
  id uuid PRIMARY KEY,
  name varchar(32) NOT NULL CHECK (name ~ '^[A-Za-z0-9 _-]{3,32}$'),
  tag varchar(8) NOT NULL CHECK (tag ~ '^[A-Z0-9]{3,8}$'),
  owner_id uuid NOT NULL REFERENCES players(id),
  member_limit integer NOT NULL DEFAULT 50 CHECK (member_limit BETWEEN 2 AND 100),
  weekly_score bigint NOT NULL DEFAULT 0 CHECK (weekly_score >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clans_name_idx ON clans (lower(name));
CREATE UNIQUE INDEX clans_tag_idx ON clans (upper(tag));

CREATE TABLE clan_members (
  clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  player_id uuid NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, player_id)
);
CREATE INDEX clan_members_clan_idx ON clan_members (clan_id, joined_at);

COMMIT;
