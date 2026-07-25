-- ============================================================
-- 006 -- direct_debit_requests: add columns the application model
-- actually writes, closing the schema gap flagged in CLAUDE.md.
-- ============================================================
-- models/schemas.py's DirectDebitRequest/DirectDebitRequestCreate expect
-- provider, provider_type, provider_account_number, payment_frequency,
-- max_payment_amount, start_date, authorization_date, signature, and
-- terms_accepted. None of these exist on the live table (which instead
-- has debit_amount/debit_frequency from an earlier, different design) --
-- so POST /direct-debit/create currently fails with an unknown-column
-- error against the real database. This migration is purely additive:
-- debit_amount/debit_frequency are left in place untouched in case
-- anything still reads them.

ALTER TABLE direct_debit_requests
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_account_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS max_payment_amount DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS authorization_date TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT TRUE;
