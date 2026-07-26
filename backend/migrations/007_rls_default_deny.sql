-- ============================================================
-- 007 -- Replace permissive USING(true)/WITH CHECK(true) RLS policies
-- with real default-deny, on the tables the security advisor still
-- flags on the live database.
-- ============================================================
-- schema.sql already documents and drops these same policies, but that
-- fix was only ever written to the file -- it was never applied to the
-- live EasyBillsPay project (confirmed via pg_policies: all 21 policies
-- below are still present and still `USING (true)` / `WITH CHECK (true)`
-- as of this migration).
--
-- Why this is safe: the FastAPI backend (backend/supabase_db.py) always
-- connects with the service_role key, which bypasses RLS regardless of
-- policy content. The frontend's Supabase client (frontend/src/supabaseClient.js)
-- uses only the anon key, and only for Supabase Auth (sign-in/sign-up) --
-- grep across frontend/src confirms no direct `.from(...)` table queries
-- exist anywhere in the app. So these USING(true) policies aren't
-- protecting anything today; they're a live hole for the moment anything
-- (a future feature, a compromised anon key, a misconfigured client)
-- queries these tables directly. RLS stays ENABLED; with zero policies
-- for anon/authenticated, Postgres denies all access by default to those
-- roles -- only service_role keeps working, which is the only role that
-- should be touching these tables anyway.
--
-- If a real future use case needs the frontend to query Supabase directly
-- (bypassing the FastAPI backend), add a narrowly-scoped policy at that
-- time. Note this app's auth (utils/auth.py get_current_user) is a custom
-- JWT with a `user_id` claim, NOT Supabase's native auth.uid() -- a
-- Supabase-native policy like `USING (user_id = auth.uid())` will not
-- work here unless the row was created via Supabase Auth AND users.id was
-- linked to supabase_uid. Any such policy needs to key off whatever
-- mechanism actually identifies the caller to PostgREST (e.g. a verified
-- custom claim set via `set_config` per request), not auth.uid() directly.

DROP POLICY IF EXISTS audit_service ON audit_log;
DROP POLICY IF EXISTS bd_user_all ON bank_details;
DROP POLICY IF EXISTS bills_user_delete ON bills;
DROP POLICY IF EXISTS bills_user_insert ON bills;
DROP POLICY IF EXISTS bills_user_select ON bills;
DROP POLICY IF EXISTS bills_user_update ON bills;
DROP POLICY IF EXISTS ddr_user_all ON direct_debit_requests;
DROP POLICY IF EXISTS notif_user_all ON notifications;
DROP POLICY IF EXISTS pm_user_all ON payment_methods;
DROP POLICY IF EXISTS pp_user_delete ON payment_plans;
DROP POLICY IF EXISTS pp_user_insert ON payment_plans;
DROP POLICY IF EXISTS pp_user_select ON payment_plans;
DROP POLICY IF EXISTS pp_user_update ON payment_plans;
DROP POLICY IF EXISTS ps_user_all ON payment_structures;
DROP POLICY IF EXISTS ptx_user_all ON payment_transactions;
DROP POLICY IF EXISTS pc_user_all ON provider_connections;
DROP POLICY IF EXISTS sub_user_all ON subscriptions;
DROP POLICY IF EXISTS tx_user_insert ON transactions;
DROP POLICY IF EXISTS tx_user_select ON transactions;
DROP POLICY IF EXISTS users_self_select ON users;
DROP POLICY IF EXISTS users_self_update ON users;

-- No replacement policies. RLS remains ENABLED on every table above
-- (already set by schema.sql's original ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY statements) with zero policies for anon/authenticated => default
-- deny. Only the backend's service_role key can read/write these tables.
