-- Fix two issues the security advisor caught, both introduced by migration 002:
--
-- 1. ledger_account_balances / customer_balances were created as
--    SECURITY DEFINER views (Postgres/Supabase's default for views created
--    by a privileged migration role). That means they'd run with the view
--    creator's permissions rather than the querying role's — which would
--    silently bypass the RLS just enabled on ledger_accounts/ledger_postings.
--    security_invoker = true (Postgres 15+, this project is on 17) makes
--    the view respect the querying role's own RLS instead.
ALTER VIEW ledger_account_balances SET (security_invoker = true);
ALTER VIEW customer_balances SET (security_invoker = true);

-- 2. check_journal_balanced() didn't pin search_path, which is a standard
--    Postgres hardening step for any SECURITY DEFINER-adjacent function
--    (trigger functions run with the privileges of the table owner) —
--    without it, a role that can create objects earlier in the caller's
--    search_path could shadow objects the function references.
ALTER FUNCTION check_journal_balanced() SET search_path = public, pg_temp;
