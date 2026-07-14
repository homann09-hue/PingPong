BEGIN;

ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS balance_before bigint,
  ADD COLUMN IF NOT EXISTS balance_after bigint,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_reason text;

UPDATE wallet_ledger
   SET source = COALESCE(source, reason),
       idempotency_key = COALESCE(idempotency_key, id::text);

WITH reconstructed AS (
  SELECT ledger.id,
         wallets.balance
           - COALESCE(
               SUM(ledger.amount) OVER (
                 PARTITION BY ledger.player_id, ledger.currency
                 ORDER BY ledger.created_at DESC, ledger.id DESC
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
               ),
               0
             ) AS calculated_after
    FROM wallet_ledger AS ledger
    JOIN wallets
      ON wallets.player_id = ledger.player_id
     AND wallets.currency = ledger.currency
)
UPDATE wallet_ledger AS ledger
   SET balance_after = COALESCE(ledger.balance_after, reconstructed.calculated_after),
       balance_before = COALESCE(
         ledger.balance_before,
         reconstructed.calculated_after - ledger.amount
       )
  FROM reconstructed
 WHERE reconstructed.id = ledger.id;

ALTER TABLE wallet_ledger
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN balance_before SET NOT NULL,
  ALTER COLUMN balance_after SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_ledger_balance_transition'
  ) THEN
    ALTER TABLE wallet_ledger
      ADD CONSTRAINT wallet_ledger_balance_transition
      CHECK (balance_before >= 0 AND balance_after >= 0 AND balance_after = balance_before + amount);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_idempotency_idx
  ON wallet_ledger (player_id, currency, idempotency_key);

CREATE INDEX IF NOT EXISTS wallet_ledger_reference_idx
  ON wallet_ledger (reference_id);

COMMIT;
