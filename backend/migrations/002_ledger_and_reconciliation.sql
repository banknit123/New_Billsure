-- ============================================================
-- 002_ledger_and_reconciliation.sql
--
-- Adds: a real double-entry ledger, a bank-account registry that separates
-- the customer trust account from BillSure's operating account, a
-- prioritised/maker-checker payment-run workflow, and reconciliation
-- tracking. This is additive — it does not touch or drop the existing
-- users.wallet_balance column, so nothing breaks while you migrate callers
-- over one at a time. Once ledger.py is the only writer of money movement,
-- wallet_balance should be dropped (left as a follow-up migration so you
-- can dual-run and compare during cutover).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BANK ACCOUNTS — metadata registry only. No balances live here; balances
-- are always computed from ledger_postings. This table just records which
-- real-world account each system ledger account corresponds to, so there
-- is one auditable place answering "which physical bank account holds
-- customer money, and which is BillSure's own."
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    account_code TEXT UNIQUE NOT NULL,        -- 'TRUST_BANK' | 'OPERATING'
    account_purpose TEXT NOT NULL CHECK (account_purpose IN ('customer_trust', 'operating')),
    institution_name TEXT NOT NULL,           -- ADI / payment-infrastructure provider name
    bsb TEXT,
    account_number_masked TEXT,
    external_reference TEXT,                  -- provider's account/virtual-account id, if applicable
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- LEDGER ACCOUNTS — the chart of accounts. One row per customer
-- (account_type='customer'), plus fixed system accounts.
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    account_type TEXT NOT NULL CHECK (account_type IN ('customer', 'trust_bank', 'fees_receivable', 'operating', 'suspense')),
    user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,  -- set only when account_type='customer'
    code TEXT UNIQUE,                                       -- set only for system accounts, e.g. 'TRUST_BANK'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_accounts_customer
    ON ledger_accounts(user_id) WHERE account_type = 'customer';

-- ============================================================
-- JOURNAL ENTRIES — one journal = one balanced transaction (>=2 postings)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    entry_type TEXT NOT NULL,       -- 'contribution_cleared' | 'bill_payment' | 'refund' | 'fee_sweep' | 'adjustment'
    reference_type TEXT,            -- table name this journal was triggered by, e.g. 'payment_transactions'
    reference_id TEXT,
    description TEXT,
    created_by TEXT,                -- user_id of the admin/system actor, for audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- LEDGER POSTINGS — the individual debit/credit lines of a journal.
-- Postings are append-only. Nothing ever UPDATEs an amount; corrections are
-- new reversing journals, so the full history is always reconstructable.
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_postings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_postings_journal ON ledger_postings(journal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_account ON ledger_postings(ledger_account_id);

-- ENFORCEMENT: every journal must balance (sum of debits = sum of credits).
-- This is a deferred constraint trigger so both postings of one journal can
-- be inserted in the same statement/transaction and only checked at the end
-- of it — a single multi-row INSERT (see ledger.py post_journal()) satisfies
-- this in one round trip.
CREATE OR REPLACE FUNCTION check_journal_balanced() RETURNS TRIGGER AS $$
DECLARE
    imbalance NUMERIC;
    jid TEXT;
BEGIN
    jid := COALESCE(NEW.journal_id, OLD.journal_id);
    SELECT COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END), 0)
    INTO imbalance FROM ledger_postings WHERE journal_id = jid;
    IF imbalance <> 0 THEN
        RAISE EXCEPTION 'Journal % is not balanced (debits - credits = %)', jid, imbalance;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_balanced ON ledger_postings;
CREATE CONSTRAINT TRIGGER trg_journal_balanced
    AFTER INSERT OR UPDATE OR DELETE ON ledger_postings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_journal_balanced();

-- ============================================================
-- BALANCE VIEWS — computed from postings, never stored/mutated directly.
--
-- Sign convention: 'trust_bank', 'fees_receivable', 'operating' and
-- 'suspense' are debit-normal (they behave like assets — a debit
-- increases the balance, matching how record_contribution_cleared debits
-- TRUST_BANK when cash comes in). 'customer' accounts are credit-normal
-- (they represent a LIABILITY — money BillSure owes back to that customer
-- / owes to pay on their behalf — so a credit increases the balance).
-- Getting this backwards makes every customer balance compute as the
-- negative of the correct amount, so it's worth this comment existing in
-- both the SQL and ledger.py.
-- ============================================================
CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
    la.id AS ledger_account_id,
    la.account_type,
    la.user_id,
    la.code,
    COALESCE(SUM(
        CASE
            WHEN la.account_type = 'customer' THEN
                CASE WHEN lp.direction = 'credit' THEN lp.amount ELSE -lp.amount END
            ELSE
                CASE WHEN lp.direction = 'debit' THEN lp.amount ELSE -lp.amount END
        END
    ), 0) AS balance
FROM ledger_accounts la
LEFT JOIN ledger_postings lp ON lp.ledger_account_id = la.id
GROUP BY la.id, la.account_type, la.user_id, la.code;

CREATE OR REPLACE VIEW customer_balances AS
SELECT user_id, balance AS ledger_balance
FROM ledger_account_balances
WHERE account_type = 'customer';

-- ============================================================
-- FUND HOLDS — settlement-risk hold for direct-debit-sourced contributions.
-- BECS direct debits can be dishonoured days after Stripe first reports
-- them as paid. A contribution is posted to the ledger (so the accounting
-- record matches Stripe) but is NOT treated as available for outbound bill
-- payment until its hold clears. Confirm actual BECS dishonour timing for
-- your Stripe account and adjust HOLD_DAYS in ledger.py accordingly —
-- treat the default in this codebase as a conservative placeholder, not a
-- verified figure.
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_holds (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    hold_reason TEXT NOT NULL,          -- 'becs_dd_clearing'
    available_at TIMESTAMPTZ NOT NULL,
    released BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fund_holds_user ON fund_holds(user_id);

-- ============================================================
-- PAYMENT RUNS — prioritised, maker-checker-approved batches of biller
-- payments.
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_runs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    status TEXT NOT NULL DEFAULT 'draft',   -- draft -> approved -> completed / cancelled
    created_by TEXT,                         -- "maker" — null if system-triggered
    approved_by TEXT,                        -- "checker" — must differ from created_by
    approved_at TIMESTAMPTZ,
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(14,2) DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_run_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    payment_run_id TEXT NOT NULL REFERENCES payment_runs(id) ON DELETE CASCADE,
    bill_id TEXT NOT NULL REFERENCES bills(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    amount NUMERIC(14,2) NOT NULL,
    priority_rank INTEGER NOT NULL,          -- lower = paid first
    status TEXT NOT NULL DEFAULT 'queued',   -- queued -> submitted -> cleared / failed / cancelled
    biller_code TEXT,
    reference_number TEXT,
    provider_payment_reference TEXT,          -- BPAY receipt / bank transaction id once executed
    journal_id TEXT REFERENCES journal_entries(id),  -- set only once cleared (ledger actually debited)
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pri_run ON payment_run_items(payment_run_id);
CREATE INDEX IF NOT EXISTS idx_pri_user ON payment_run_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pri_status ON payment_run_items(status);

-- ============================================================
-- RECONCILIATION
-- ============================================================
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    run_at TIMESTAMPTZ DEFAULT now(),
    trust_ledger_balance NUMERIC(14,2) NOT NULL,
    sum_customer_balances NUMERIC(14,2) NOT NULL,
    external_bank_balance NUMERIC(14,2),          -- null until a real bank-feed integration is wired up
    internal_variance NUMERIC(14,2) NOT NULL,     -- trust_ledger_balance - sum_customer_balances (must be 0)
    external_variance NUMERIC(14,2),              -- trust_ledger_balance - external_bank_balance (must be 0)
    status TEXT NOT NULL DEFAULT 'ok',            -- ok | variance_detected
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    reconciliation_run_id TEXT NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    exception_type TEXT NOT NULL,   -- 'internal_variance' | 'external_variance'
    amount NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',   -- open -> investigating -> resolved
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY — same posture as the rest of this schema: RLS
-- enabled, zero policies for anon/authenticated (default deny), only the
-- backend's service_role key can read/write. See schema.sql for the full
-- rationale already documented there.
-- ============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_exceptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED: the two system bank accounts + matching ledger accounts.
-- Fill in real institution/account details before going live — these
-- placeholders exist so the rest of the system has something to reference
-- immediately in dev/test.
-- ============================================================
INSERT INTO bank_accounts (account_code, account_purpose, institution_name)
VALUES
    ('TRUST_BANK', 'customer_trust', 'REPLACE_WITH_ADI_OR_PROVIDER_NAME'),
    ('OPERATING', 'operating', 'REPLACE_WITH_ADI_NAME')
ON CONFLICT (account_code) DO NOTHING;

INSERT INTO ledger_accounts (account_type, code)
VALUES
    ('trust_bank', 'TRUST_BANK'),
    ('fees_receivable', 'FEES_RECEIVABLE'),
    ('operating', 'OPERATING'),
    ('suspense', 'SUSPENSE')
ON CONFLICT (code) DO NOTHING;
