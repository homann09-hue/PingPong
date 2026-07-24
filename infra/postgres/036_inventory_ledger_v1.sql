BEGIN;

CREATE TABLE inventory_item_definitions (
  item_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  category text NOT NULL CHECK (category IN (
    'booster','ticket','chest','key','collectible','cosmetic','pet','event_item'
  )),
  rarity text NOT NULL CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  max_stack bigint NOT NULL CHECK (max_stack > 0),
  tradable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, version)
);

CREATE TABLE inventory_stacks (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  item_id text NOT NULL,
  item_version integer NOT NULL,
  quantity bigint NOT NULL CHECK (quantity > 0),
  max_stack bigint NOT NULL CHECK (max_stack > 0),
  stack_index integer NOT NULL CHECK (stack_index >= 0),
  expires_at timestamptz,
  event_id text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  FOREIGN KEY (item_id, item_version)
    REFERENCES inventory_item_definitions(item_id, version),
  CHECK (quantity <= max_stack),
  CHECK (event_id IS NULL OR length(event_id) > 0)
);

CREATE UNIQUE INDEX inventory_stacks_identity_idx
  ON inventory_stacks (
    player_id, item_id, item_version, event_id, expires_at, stack_index
  ) NULLS NOT DISTINCT;

CREATE INDEX inventory_stacks_player_item_idx
  ON inventory_stacks (player_id, item_id, item_version, expires_at, acquired_at);

CREATE INDEX inventory_stacks_expiry_idx
  ON inventory_stacks (expires_at, player_id)
  WHERE expires_at IS NOT NULL;

CREATE TABLE inventory_operations (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) > 0),
  operation_type text NOT NULL CHECK (operation_type IN ('grant','consume','expire','admin_adjust')),
  request_hash bytea NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE TABLE inventory_ledger (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES inventory_operations(id),
  sequence integer NOT NULL CHECK (sequence >= 0),
  player_id uuid NOT NULL REFERENCES players(id),
  stack_id uuid NOT NULL,
  item_id text NOT NULL,
  item_version integer NOT NULL,
  delta bigint NOT NULL CHECK (delta <> 0),
  quantity_before bigint NOT NULL CHECK (quantity_before >= 0),
  quantity_after bigint NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL CHECK (length(reason) > 0),
  source text NOT NULL CHECK (length(source) > 0),
  reference_id text NOT NULL CHECK (length(reference_id) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (item_id, item_version)
    REFERENCES inventory_item_definitions(item_id, version),
  CONSTRAINT inventory_ledger_quantity_transition
    CHECK (quantity_after = quantity_before + delta),
  UNIQUE (operation_id, sequence)
);

CREATE INDEX inventory_ledger_player_created_idx
  ON inventory_ledger (player_id, created_at DESC);

CREATE INDEX inventory_ledger_item_created_idx
  ON inventory_ledger (item_id, item_version, created_at DESC);

COMMIT;
