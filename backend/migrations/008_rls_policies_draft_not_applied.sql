-- ============================================================
-- 008 -- DRAFT granular RLS policies. DO NOT APPLY WITHOUT REVIEW.
-- ============================================================
-- STATUS: draft only, not applied anywhere (not to the live EasyBillsPay
-- project, not in CI, nothing runs this file automatically). It exists to
-- be read, argued with, and revised -- not executed as-is.
--
-- WHY THIS NEEDS REVIEW BEFORE APPLYING, SPECIFICALLY:
--   1. It changes access rules on tables holding real customer data
--      (bills, payment methods, direct debit mandates, transactions) --
--      that's a security-relevant change regardless of how confident the
--      SQL looks, and deserves a second set of eyes (security and,
--      depending on your jurisdiction's privacy/financial-services
--      obligations, legal) before it touches anything real.
--   2. It is INCOMPLETE by design -- see "What this draft deliberately
--      does NOT cover" below. Applying it as-is does not give you a
--      finished RLS posture, just a documented starting point.
--   3. It depends on application wiring that does not exist yet (see
--      "Prerequisite: app.current_user_id" below) -- applying it today
--      would not misbehave dangerously (see "Why this fails safe" below),
--      but it also would not do anything useful yet either.
--
-- CONTEXT -- why this differs from 007_rls_default_deny.sql:
-- Migration 007 already applied a real fix live: every permissive
-- `USING (true)` policy on these tables was dropped, with RLS left
-- ENABLED and zero replacement policies, which is default-deny for the
-- anon/authenticated Postgres roles. That's correct and sufficient for
-- today's architecture, where the FastAPI backend is the only thing that
-- ever queries these tables, always via the service_role key (which
-- bypasses RLS regardless of what policies exist).
--
-- This file is what comes NEXT, if a real future feature needs the
-- frontend to query Supabase directly (bypassing the FastAPI backend) --
-- e.g. Supabase Realtime subscriptions for live bill/notification
-- updates, a scenario Supabase is commonly used for and where reasonable
-- to expect someone will eventually want it. Until that need is real,
-- 007's default-deny is the correct state to stay in; this file is
-- preparation, not an outstanding gap.
--
-- HOW THIS APP IDENTIFIES A USER (read from utils/auth.py before writing
-- this -- this is the load-bearing fact the whole file depends on):
-- get_current_user() tries a CUSTOM JWT first -- jwt.decode() with this
-- app's own SECRET_KEY (an app-level env var, generated randomly if
-- unset), extracting a `user_id` claim and looking up `users` by `id`.
-- Only if that fails does it fall back to Supabase Auth token
-- verification (sb.auth.get_user()), matching by `supabase_uid` or
-- email. Most users today authenticate via the custom JWT path, not
-- Supabase Auth -- `users.supabase_uid` is null for most rows.
--
-- WHY NATIVE SUPABASE `auth.uid()` DOES NOT WORK HERE:
-- `auth.uid()` resolves from a JWT that PostgREST itself verified using
-- Supabase's OWN JWT signing secret, populated into `request.jwt.claims`
-- by Supabase's infrastructure before your policy ever runs. This app's
-- custom JWT is signed with a DIFFERENT secret (SECRET_KEY in
-- utils/auth.py) that Supabase's PostgREST layer knows nothing about --
-- handing a custom-JWT-holder's token to PostgREST directly would not
-- verify, and `auth.uid()` would just be null. A policy written as
-- `USING (user_id = auth.uid())` would silently deny every custom-JWT
-- user forever, which is worse than not having the policy at all if
-- anyone ever tries to actually use this file as a template.
--
-- PREREQUISITE: app.current_user_id (does not exist yet):
-- The policies below key off `current_setting('app.current_user_id', true)`
-- -- a Postgres session-local variable, NOT a Supabase/PostgREST built-in.
-- For this to actually work, whatever connection runs a user-scoped query
-- would need to execute `SELECT set_config('app.current_user_id', $1, true)`
-- with the already-verified user id (from EITHER the custom JWT or
-- Supabase Auth path -- get_current_user() already resolves this either
-- way) on the SAME session/transaction, immediately before the actual
-- query. That requires a raw Postgres connection (e.g. psycopg2/asyncpg)
-- -- NOT the current PostgREST-over-HTTP path (supabase_db.py's
-- get_supabase(), which is stateless per call and has no mechanism to
-- carry a session variable across two separate REST calls). This wiring
-- does not exist anywhere in this codebase today. Building it is a
-- separate, real piece of engineering work, not a one-line addition.
--
-- WHY THIS FAILS SAFE IN THE MEANTIME:
-- `current_setting('app.current_user_id', true)` returns NULL when unset
-- (the `true` argument means "don't error if missing"). `user_id = NULL`
-- is never TRUE in SQL (NULL is not equal to anything, including
-- itself) -- so until the session-variable wiring above exists, these
-- policies would behave as pure default-deny for anon/authenticated,
-- identical in effect to 007. Applying this file early would not open
-- any hole; it just wouldn't accomplish anything beyond what 007 already
-- does, while adding review overhead for no benefit -- another reason to
-- hold off until the wiring exists and there's an actual use case.
--
-- WHAT THIS DRAFT DELIBERATELY DOES NOT COVER:
--   - Write policies (INSERT/UPDATE/DELETE) on any table. Read-your-own-
--     row is a safe, generic default; write access is not -- e.g. a
--     naive "users can update their own row" policy on `users` would let
--     a client directly modify wallet_balance, is_admin, role, or
--     subscription_fee on themselves, none of which should ever be
--     client-writable regardless of whose row it is. Getting write
--     policies right requires a column-by-column, table-by-table
--     decision about what a customer should ever be allowed to mutate
--     directly (if anything) -- a product/business decision, not
--     something to infer from column names. Left for a future pass, on
--     purpose, not an oversight.
--   - `audit_log` -- no customer-facing use case for reading this table
--     directly; stays default-deny with no policy at all.
--   - Admin/staff read access (e.g. an admin dashboard querying Supabase
--     directly instead of through the FastAPI backend) -- current admin
--     tooling goes through `get_admin_user()` and the service_role key,
--     so there's no present need, and `is_admin`-aware policies add
--     meaningfully more complexity (a broad "is_admin implies read
--     everything" policy is itself a privilege-escalation surface worth
--     designing carefully, not bolting on here).
--   - Any policy for `bank_accounts`, `collection_attempts`,
--     `disclosure_acknowledgements`, `fund_holds`, `journal_entries`,
--     `ledger_accounts`, `ledger_postings`, `payment_runs`,
--     `payment_run_items`, `reconciliation_runs`, `reconciliation_exceptions`,
--     `refunds` -- these are ledger/ops-internal tables with no
--     customer-facing direct-read use case even hypothetically; stay
--     default-deny (already the case, confirmed via get_advisors after
--     migration 007).

-- ------------------------------------------------------------
-- Read-your-own-row SELECT policies, one per table with a customer-facing
-- read use case. Every policy follows the same shape.
-- ------------------------------------------------------------

CREATE POLICY users_own_select ON users
    FOR SELECT
    USING (id = current_setting('app.current_user_id', true));

CREATE POLICY bills_own_select ON bills
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY transactions_own_select ON transactions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY payment_plans_own_select ON payment_plans
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY payment_structures_own_select ON payment_structures
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY bank_details_own_select ON bank_details
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY direct_debit_requests_own_select ON direct_debit_requests
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY provider_connections_own_select ON provider_connections
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY payment_methods_own_select ON payment_methods
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY notifications_own_select ON notifications
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY subscriptions_own_select ON subscriptions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY payment_transactions_own_select ON payment_transactions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

-- ------------------------------------------------------------
-- Before applying this file for real:
--   1. Build the app.current_user_id session-variable wiring described
--      above (raw Postgres connection, set_config per request) --
--      without it, applying this file is a no-op beyond what migration
--      007 already does.
--   2. Get security review on the policies themselves.
--   3. Decide, table by table, whether ANY write policies are actually
--      wanted, and if so exactly which columns a customer should be
--      allowed to touch -- do not add broad UPDATE/INSERT/DELETE
--      policies without that decision being made explicitly.
--   4. Confirm with whoever owns compliance/privacy obligations for this
--      product that read-your-own-row is sufficient, or whether finer-
--      grained restrictions are needed (e.g. hiding certain fields even
--      from the row's own owner).
-- ------------------------------------------------------------
