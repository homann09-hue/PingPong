BEGIN;

CREATE TABLE loot_table_versions (
  table_id text NOT NULL CHECK (length(table_id) BETWEEN 1 AND 128),
  version integer NOT NULL CHECK (version > 0),
  pity_group text NOT NULL CHECK (length(pity_group) BETWEEN 1 AND 128),
  pity_after integer CHECK (pity_after IS NULL OR pity_after > 0),
  active boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_id, version)
);

CREATE UNIQUE INDEX loot_table_versions_active_idx
  ON loot_table_versions (table_id)
  WHERE active;

CREATE TABLE loot_table_entries (
  table_id text NOT NULL,
  table_version integer NOT NULL,
  entry_id text NOT NULL CHECK (length(entry_id) BETWEEN 1 AND 128),
  item_id text NOT NULL,
  item_version integer NOT NULL,
  entry_kind text NOT NULL CHECK (entry_kind IN ('weighted','guaranteed')),
  weight bigint NOT NULL DEFAULT 0,
  min_quantity bigint NOT NULL CHECK (min_quantity > 0),
  max_quantity bigint NOT NULL CHECK (max_quantity >= min_quantity),
  pity_eligible boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  PRIMARY KEY (table_id, table_version, entry_id),
  FOREIGN KEY (table_id, table_version)
    REFERENCES loot_table_versions(table_id, version) ON DELETE CASCADE,
  FOREIGN KEY (item_id, item_version)
    REFERENCES inventory_item_definitions(item_id, version),
  CHECK (
    (entry_kind = 'weighted' AND weight > 0)
    OR (entry_kind = 'guaranteed' AND weight = 0)
  )
);

CREATE INDEX loot_table_entries_item_idx
  ON loot_table_entries (item_id, item_version);

CREATE TABLE loot_pity_states (
  player_id uuid NOT NULL REFERENCES players(id),
  pity_group text NOT NULL CHECK (length(pity_group) BETWEEN 1 AND 128),
  misses integer NOT NULL DEFAULT 0 CHECK (misses >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, pity_group)
);

CREATE TABLE loot_openings (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  table_id text NOT NULL,
  table_version integer NOT NULL,
  pity_group text NOT NULL,
  pity_before integer NOT NULL CHECK (pity_before >= 0),
  pity_after integer NOT NULL CHECK (pity_after >= 0),
  forced_pity boolean NOT NULL,
  proof_version integer NOT NULL CHECK (proof_version > 0),
  server_seed bytea NOT NULL CHECK (octet_length(server_seed) = 32),
  seed_commitment bytea NOT NULL CHECK (octet_length(seed_commitment) = 32),
  draws jsonb NOT NULL CHECK (jsonb_typeof(draws) = 'array'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (table_id, table_version)
    REFERENCES loot_table_versions(table_id, version),
  UNIQUE (player_id, idempotency_key)
);

CREATE INDEX loot_openings_player_created_idx
  ON loot_openings (player_id, created_at DESC);

CREATE INDEX loot_openings_table_created_idx
  ON loot_openings (table_id, table_version, created_at DESC);

CREATE TABLE loot_opening_rewards (
  opening_id uuid NOT NULL REFERENCES loot_openings(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  entry_id text NOT NULL,
  item_id text NOT NULL,
  item_version integer NOT NULL,
  quantity bigint NOT NULL CHECK (quantity > 0),
  inventory_operation_id uuid NOT NULL UNIQUE REFERENCES inventory_operations(id),
  PRIMARY KEY (opening_id, sequence),
  FOREIGN KEY (item_id, item_version)
    REFERENCES inventory_item_definitions(item_id, version)
);

COMMIT;
