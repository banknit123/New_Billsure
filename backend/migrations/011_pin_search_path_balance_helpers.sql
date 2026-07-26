-- ============================================================
-- 011 -- pin search_path on the two functions added by migration 010
-- ============================================================
-- Same hardening already applied to check_journal_balanced() in
-- migration 004: without a pinned search_path, a role able to create
-- objects earlier in the caller's search_path could shadow objects these
-- functions reference. Caught by the security advisor immediately after
-- applying migration 010.

ALTER FUNCTION increment_wallet_balance(TEXT, DOUBLE PRECISION) SET search_path = public, pg_temp;
ALTER FUNCTION increment_active_plan_totals(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, pg_temp;
