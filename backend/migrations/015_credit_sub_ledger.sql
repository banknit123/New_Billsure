-- ============================================================
-- 015 -- ASIC ERS credit sub-ledger (pilot_config integration)
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012/013/014. Apply this only to a dedicated sandbox Postgres instance.
--
-- Deliberately a SEPARATE set of tables from ledger_accounts/
-- journal_entries/ledger_postings (migration 002), which track customer
-- trust contributions for the bill-smoothing product -- a liability to
-- the customer. This credit sub-ledger tracks the opposite: money
-- BillSure has lent a customer (a receivable, an asset), funded from a
-- distinct CREDIT_FUNDING pool, never from trust funds. See
-- backend/credit_ledger.py's module docstring for the full reasoning.

-- ------------------------------------------------------------
-- 1. Credit ledger accounts: one row per active customer credit
--    facility, plus the single CREDIT_FUNDING system account.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_ledger_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type        TEXT NOT NULL CHECK (account_type IN ('customer_credit', 'credit_funding')),
    code                TEXT,                          -- set only for the system account ('CREDIT_FUNDING')
    customer_id         UUID,                          -- set only for account_type='customer_credit'
    contractual_limit    NUMERIC(12,2),                 -- set only for account_type='customer_credit'
    status              TEXT NOT NULL DEFAULT 'active',
    activated_by        TEXT,
    activated_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_credit_account_status CHECK (status IN ('active', 'closed', 'wind_down')),
    -- Every dollar of contractual limit must fit the pilot's per-customer
    -- ceiling at the DB layer too, not just pilot_config.py.
    CONSTRAINT chk_credit_account_limit_ceiling CHECK (contractual_limit IS NULL OR contractual_limit <= 2500.00),
    CONSTRAINT chk_credit_account_customer_fields CHECK (
        (account_type = 'customer_credit' AND customer_id IS NOT NULL AND contractual_limit IS NOT NULL)
        OR (account_type = 'credit_funding' AND code IS NOT NULL AND customer_id IS NULL AND contractual_limit IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_account_per_customer
    ON credit_ledger_accounts(customer_id) WHERE account_type = 'customer_credit';
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_funding_account
    ON credit_ledger_accounts(code) WHERE account_type = 'credit_funding';

-- Enforce the pilot customer cap (max 25 ACTIVE customer_credit accounts)
-- at the database layer as well as in pilot_config.check_customer_cap() /
-- credit_ledger.activate_customer_credit_account(). Belt and braces: the
-- application-layer check has a check-then-insert race window under
-- concurrent requests that this trigger closes.
CREATE OR REPLACE FUNCTION enforce_pilot_customer_cap()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    IF NEW.account_type = 'customer_credit' AND NEW.status = 'active' THEN
        SELECT count(*) INTO active_count
        FROM credit_ledger_accounts
        WHERE account_type = 'customer_credit' AND status = 'active';
        IF active_count > 25 THEN
            RAISE EXCEPTION 'pilot customer cap (25) exceeded — cannot activate another customer credit account';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_pilot_customer_cap ON credit_ledger_accounts;
CREATE CONSTRAINT TRIGGER trg_enforce_pilot_customer_cap
    AFTER INSERT OR UPDATE ON credit_ledger_accounts
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION enforce_pilot_customer_cap();

-- Enforce the aggregate contractual exposure cap ($62,500) at the
-- database layer too.
CREATE OR REPLACE FUNCTION enforce_aggregate_exposure_cap()
RETURNS TRIGGER AS $$
DECLARE
    aggregate NUMERIC(14,2);
BEGIN
    IF NEW.account_type = 'customer_credit' AND NEW.status = 'active' THEN
        SELECT COALESCE(sum(contractual_limit), 0) INTO aggregate
        FROM credit_ledger_accounts
        WHERE account_type = 'customer_credit' AND status = 'active';
        IF aggregate > 62500.00 THEN
            RAISE EXCEPTION 'aggregate contractual exposure cap ($62,500) exceeded';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_aggregate_exposure_cap ON credit_ledger_accounts;
CREATE CONSTRAINT TRIGGER trg_enforce_aggregate_exposure_cap
    AFTER INSERT OR UPDATE ON credit_ledger_accounts
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION enforce_aggregate_exposure_cap();

-- ------------------------------------------------------------
-- 2. Credit journal entries + postings (immutable, balanced), mirroring
--    migration 002's journal_entries/ledger_postings pattern.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type      TEXT NOT NULL,
    reference_type  TEXT,
    reference_id    TEXT,
    description     TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_credit_entry_type CHECK (entry_type IN ('credit_draw', 'credit_repayment', 'write_off', 'reversal'))
);

CREATE TABLE IF NOT EXISTS credit_ledger_postings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id                  UUID NOT NULL REFERENCES credit_journal_entries(id),
    credit_ledger_account_id    UUID NOT NULL REFERENCES credit_ledger_accounts(id),
    direction                   TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount                      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_postings_account ON credit_ledger_postings(credit_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_postings_journal ON credit_ledger_postings(journal_id);

-- Deferred balance check: every journal's postings must balance (sum of
-- debits == sum of credits), same discipline as migration 002's ledger.
CREATE OR REPLACE FUNCTION check_credit_journal_balanced()
RETURNS TRIGGER AS $$
DECLARE
    total_debit NUMERIC(14,2);
    total_credit NUMERIC(14,2);
    jid UUID;
BEGIN
    jid := COALESCE(NEW.journal_id, OLD.journal_id);
    SELECT COALESCE(sum(amount) FILTER (WHERE direction = 'debit'), 0),
           COALESCE(sum(amount) FILTER (WHERE direction = 'credit'), 0)
    INTO total_debit, total_credit
    FROM credit_ledger_postings WHERE journal_id = jid;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'credit journal % does not balance: debits=% credits=%', jid, total_debit, total_credit;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_credit_journal_balanced ON credit_ledger_postings;
CREATE CONSTRAINT TRIGGER trg_check_credit_journal_balanced
    AFTER INSERT OR UPDATE OR DELETE ON credit_ledger_postings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_credit_journal_balanced();

-- No UPDATE/DELETE from application code -- postings are immutable;
-- corrections are reversing + replacement journals, never edits.
REVOKE UPDATE, DELETE ON credit_ledger_postings FROM PUBLIC;
REVOKE UPDATE, DELETE ON credit_journal_entries FROM PUBLIC;

-- ------------------------------------------------------------
-- 3. Convenience view: outstanding principal per customer, computed the
--    same "sum of postings" way credit_ledger.py does, so a direct SQL
--    query and the application code can never silently disagree.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW credit_account_balances AS
SELECT
    la.id AS credit_ledger_account_id,
    la.customer_id,
    la.contractual_limit,
    COALESCE(SUM(CASE WHEN p.direction = 'debit' THEN p.amount ELSE -p.amount END), 0) AS outstanding_principal
FROM credit_ledger_accounts la
LEFT JOIN credit_ledger_postings p ON p.credit_ledger_account_id = la.id
WHERE la.account_type = 'customer_credit'
GROUP BY la.id, la.customer_id, la.contractual_limit;

-- ------------------------------------------------------------
-- 4. RLS default-deny, matching prior pilot migrations.
-- ------------------------------------------------------------
ALTER TABLE credit_ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger_postings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_credit_ledger_accounts ON credit_ledger_accounts;
CREATE TRIGGER audit_credit_ledger_accounts
    AFTER INSERT OR UPDATE OR DELETE ON credit_ledger_accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
