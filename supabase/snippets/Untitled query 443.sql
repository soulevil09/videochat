CREATE OR REPLACE RULE credit_ledger_no_update AS
  ON UPDATE TO credit_ledger DO INSTEAD NOTHING;

CREATE OR REPLACE RULE credit_ledger_no_delete AS
  ON DELETE TO credit_ledger DO INSTEAD NOTHING;