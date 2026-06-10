SELECT column_name
FROM information_schema.columns
WHERE table_name = 'credit_ledger' AND column_name = 'updated_at';