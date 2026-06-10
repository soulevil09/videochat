SELECT rulename, tablename
FROM pg_rules
WHERE tablename = 'credit_ledger';