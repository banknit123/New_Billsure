-- ============================================================
-- 025 -- raise the max single-bill payment ceiling ($500 -> $1,500)
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-024.
--
-- Deliberate, reviewed change (not a routine config toggle): the
-- max_single_bill_payment ceiling was a hard-coded ceiling in
-- pilot_config.py, requiring its own explicit code review to change --
-- this migration and the accompanying pilot_config.py change ARE that
-- review. Raised from $500 to $1,500 per a documented business
-- decision (winter utility bills routinely exceed $500 for larger
-- households). See docs/asic-ers-readiness/session-19-single-bill-
-- limit-increase.md for the full record, including the explicit
-- caveat that this figure's consistency with BillSure's actual ASIC
-- ERS notification (if one has been lodged) is outside what this
-- codebase can verify -- confirm with whoever manages that
-- relationship, don't just trust that this migration running means
-- the regulatory position is settled.
--
-- Does NOT touch contractual_credit_limit, max_outstanding_balance, or
-- aggregate_contractual_exposure_cap -- $1,500 remains comfortably
-- under all three ($2,500 per-customer contractual limit and
-- outstanding-balance cap), so this change doesn't require adjusting
-- any of the other pilot ceilings for internal consistency.

ALTER TABLE pilot_config_versions
    DROP CONSTRAINT IF EXISTS chk_single_bill_limit;

ALTER TABLE pilot_config_versions
    ADD CONSTRAINT chk_single_bill_limit CHECK (max_single_bill_payment <= 1500.00);
