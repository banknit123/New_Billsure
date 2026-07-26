-- ============================================================
-- 005 -- ASIC ERS Annexure B gap remediation (P0/P1/P2)
-- ============================================================
-- Builds on the ledger/reconciliation schema already applied in
-- 002_ledger_and_reconciliation / 003_scheduled_collection_tracking /
-- 004_fix_view_security_and_search_path. This migration adds the
-- remaining tables/columns/functions the application code needs to
-- actually USE that ledger, plus the refund, disclosure-acknowledgement,
-- and manual-review pieces that had no schema at all yet.

-- ------------------------------------------------------------
-- 0. audit_trigger_func() currently does `NEW.user_id` unconditionally
--    for every non-"users" table it's attached to. That's a runtime
--    error ("record NEW has no field user_id") on tables that legitimately
--    don't have a user_id column (payment_runs, reconciliation_exceptions,
--    journal_entries, ledger_postings) -- attaching the trigger to those
--    as-is would make every INSERT into them fail. Switch to a jsonb
--    lookup, which returns NULL for a missing key instead of erroring.
--    No behaviour change for existing audited tables that do have user_id.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    uid TEXT;
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        uid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    ELSIF TG_OP = 'DELETE' THEN
        uid := (to_jsonb(OLD) ->> 'user_id');
    ELSE
        uid := (to_jsonb(NEW) ->> 'user_id');
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, uid, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, uid, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, uid, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp';

-- ------------------------------------------------------------
-- 1. Atomic double-entry posting RPC (P0: segregated money account)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_journal_entry(
    p_entry_type TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_description TEXT,
    p_created_by TEXT,
    p_postings JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_journal_id TEXT;
    v_debit_total NUMERIC := 0;
    v_credit_total NUMERIC := 0;
    v_posting JSONB;
BEGIN
    IF jsonb_array_length(p_postings) < 2 THEN
        RAISE EXCEPTION 'A journal entry needs at least two postings (double-entry)';
    END IF;

    SELECT COALESCE(SUM((p->>'amount')::NUMERIC) FILTER (WHERE p->>'direction' = 'debit'), 0),
           COALESCE(SUM((p->>'amount')::NUMERIC) FILTER (WHERE p->>'direction' = 'credit'), 0)
      INTO v_debit_total, v_credit_total
      FROM jsonb_array_elements(p_postings) AS p;

    IF v_debit_total <> v_credit_total THEN
        RAISE EXCEPTION 'Unbalanced journal entry: debits % != credits %', v_debit_total, v_credit_total;
    END IF;
    IF v_debit_total <= 0 THEN
        RAISE EXCEPTION 'Journal entry must post a positive amount';
    END IF;

    INSERT INTO journal_entries (entry_type, reference_type, reference_id, description, created_by)
    VALUES (p_entry_type, p_reference_type, p_reference_id, p_description, p_created_by)
    RETURNING id INTO v_journal_id;

    FOR v_posting IN SELECT * FROM jsonb_array_elements(p_postings)
    LOOP
        INSERT INTO ledger_postings (journal_id, ledger_account_id, direction, amount)
        VALUES (
            v_journal_id,
            v_posting->>'ledger_account_id',
            v_posting->>'direction',
            (v_posting->>'amount')::NUMERIC
        );
    END LOOP;

    RETURN v_journal_id;
END;
$$;

REVOKE ALL ON FUNCTION post_journal_entry(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_journal_entry(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION get_or_create_customer_ledger_account(p_user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_id TEXT;
    v_code TEXT := 'CUST:' || p_user_id;
BEGIN
    INSERT INTO ledger_accounts (account_type, user_id, code)
    VALUES ('customer', p_user_id, v_code)
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_id FROM ledger_accounts WHERE code = v_code;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_customer_ledger_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_or_create_customer_ledger_account(TEXT) TO service_role;

GRANT SELECT ON ledger_account_balances TO service_role;
GRANT SELECT ON customer_balances TO service_role;

-- ------------------------------------------------------------
-- 2. Refunds & adjustments (P1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
    transaction_id TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    refund_type TEXT NOT NULL DEFAULT 'customer_requested'
        CHECK (refund_type IN ('customer_requested', 'operational_adjustment', 'overpayment', 'billing_error')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    requested_by TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    journal_id TEXT REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. ERS / no-personal-advice disclosure acknowledgement (P0)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disclosure_acknowledgements (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    disclosure_type TEXT NOT NULL DEFAULT 'ers_sandbox_no_advice',
    disclosure_version TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT
);
CREATE INDEX IF NOT EXISTS idx_disclosure_ack_user ON disclosure_acknowledgements(user_id);
ALTER TABLE disclosure_acknowledgements ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. Payment-time verification / manual review (P1)
-- ------------------------------------------------------------
ALTER TABLE payment_run_items
    ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS review_reason TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_result JSONB,
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_run_items_requires_review ON payment_run_items(requires_review) WHERE requires_review = TRUE;

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS last_verified_account_number TEXT,
    ADD COLUMN IF NOT EXISTS last_verified_biller_code TEXT,
    ADD COLUMN IF NOT EXISTS insufficient_funds_action TEXT,
    ADD COLUMN IF NOT EXISTS insufficient_funds_action_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 5. Contribution schedule approval step (P1)
-- ------------------------------------------------------------
ALTER TABLE payment_plans
    ADD COLUMN IF NOT EXISTS schedule_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS schedule_approved_by TEXT;

-- ------------------------------------------------------------
-- 6. Audit coverage for everything added by 002-005 (P2)
-- ------------------------------------------------------------
CREATE TRIGGER audit_refunds AFTER INSERT OR UPDATE OR DELETE ON refunds FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_disclosure_acknowledgements AFTER INSERT ON disclosure_acknowledgements FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_payment_run_items AFTER INSERT OR UPDATE OR DELETE ON payment_run_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_payment_runs AFTER INSERT OR UPDATE OR DELETE ON payment_runs FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_reconciliation_exceptions AFTER INSERT OR UPDATE ON reconciliation_exceptions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_collection_attempts AFTER INSERT OR UPDATE ON collection_attempts FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_journal_entries AFTER INSERT ON journal_entries FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_ledger_postings AFTER INSERT ON ledger_postings FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_fund_holds AFTER INSERT OR UPDATE ON fund_holds FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
