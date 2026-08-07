-- ============================================================
-- 016 -- link pilot bill disbursements to their funding credit journal
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012/013/014/015.
--
-- Additive-only: adds one nullable column to pilot_bill_disbursements
-- (migration 014) so a disbursement's funding source is traceable back
-- to the exact credit_journal_entries row (migration 015) that moved
-- the money, closing the gap flagged in session 4: "create_disbursement()
-- only creates a queued row -- it does not yet call into the credit
-- ledger to actually move money."

ALTER TABLE pilot_bill_disbursements
    ADD COLUMN IF NOT EXISTS credit_journal_id UUID REFERENCES credit_journal_entries(id);

CREATE INDEX IF NOT EXISTS idx_pilot_bill_disbursements_credit_journal
    ON pilot_bill_disbursements(credit_journal_id);
