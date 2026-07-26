-- ============================================================
-- 010 -- atomic balance-increment RPCs (found missing live while
-- running the first real end-to-end Stripe scheduled collection)
-- ============================================================
-- backend/schema.sql has defined increment_wallet_balance() and
-- increment_active_plan_totals() since early in this project -- both
-- called by supabase_db.py, and specifically relied on by
-- _collect_for_plan() (server.py) to atomically record a scheduled
-- collection's ledger totals. Neither function actually existed on the
-- live database (confirmed via pg_proc): a real off-session Stripe
-- charge succeeded and the ledger was correctly credited, but the final
-- payment_plans.total_collected bookkeeping step failed with
-- PGRST202 "function not found". The charge, the ledger posting, and
-- collection_attempts.status="credited" were all already correct and
-- unaffected -- this only affects the display-total step. Likely never
-- applied because schema.sql's function section was added/updated after
-- the live tables were first created some other way.
--
-- Execute permission is intentionally restricted to service_role only --
-- these must never be callable via the public anon/authenticated
-- Supabase RPC surface.

CREATE OR REPLACE FUNCTION increment_wallet_balance(p_user_id TEXT, p_amount DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
    UPDATE users
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
    WHERE id = p_user_id
    RETURNING wallet_balance;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_active_plan_totals(
    p_user_id TEXT,
    p_collected_delta DOUBLE PRECISION DEFAULT 0,
    p_paid_out_delta DOUBLE PRECISION DEFAULT 0
)
RETURNS VOID AS $$
    UPDATE payment_plans
    SET total_collected = COALESCE(total_collected, 0) + p_collected_delta,
        total_paid_out = COALESCE(total_paid_out, 0) + p_paid_out_delta
    WHERE user_id = p_user_id AND status = 'active';
$$ LANGUAGE sql;

REVOKE ALL ON FUNCTION increment_wallet_balance(TEXT, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_active_plan_totals(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_wallet_balance(TEXT, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION increment_active_plan_totals(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
