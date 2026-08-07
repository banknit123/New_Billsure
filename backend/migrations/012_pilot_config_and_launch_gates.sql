-- ============================================================
-- 012 -- ASIC ERS pilot configuration + regulatory launch-gate system
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database). This migration targets a SEPARATE
-- sandbox database only, per the ASIC ERS readiness task's explicit
-- instruction to use sandbox providers and synthetic data and to keep
-- pilot-readiness work off any database holding real customer rows.
-- Apply this only to a local/sandbox Postgres instance dedicated to the
-- pilot build. Do not run this against `nojrxsbgcmoonnobagcv` (EasyBillsPay)
-- or `epvozejhiawittzpfboe` (Billseasypay) — see CLAUDE.md for why those
-- are off-limits for this work.
--
-- This migration is purely additive: new tables only, no changes to any
-- existing table. It follows the same discipline as 002/005: hard database
-- CHECK constraints (not just application logic), RLS default-deny (no
-- policies -- only service_role reads/writes, same posture as 007), and
-- audit-trigger coverage.

-- ------------------------------------------------------------
-- 1. Versioned, immutable pilot product configuration.
--    A "change" is a new row, never an UPDATE of contractual_credit_limit
--    etc. on an existing row -- only is_active/approved_by/reviewer-style
--    bookkeeping columns are ever updated post-insert.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pilot_config_versions (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version                             INTEGER NOT NULL,
    max_pilot_customers                 INTEGER NOT NULL,
    contractual_credit_limit            NUMERIC(12,2) NOT NULL,
    initial_available_credit_min        NUMERIC(12,2) NOT NULL,
    initial_available_credit_max        NUMERIC(12,2) NOT NULL,
    max_single_bill_payment             NUMERIC(12,2) NOT NULL,
    max_outstanding_balance             NUMERIC(12,2) NOT NULL,
    aggregate_contractual_exposure_cap  NUMERIC(12,2) NOT NULL,
    contract_term_months                INTEGER NOT NULL,
    interest_rate_percent               NUMERIC(5,2) NOT NULL DEFAULT 0,
    late_fee_amount                     NUMERIC(12,2) NOT NULL DEFAULT 0,
    early_repayment_fee_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_withdrawals_enabled            BOOLEAN NOT NULL DEFAULT false,
    customer_transfers_enabled          BOOLEAN NOT NULL DEFAULT false,
    approved_bill_categories            TEXT[] NOT NULL,
    geographic_areas                    TEXT[] NOT NULL,
    pilot_duration_months               INTEGER NOT NULL,
    real_money_enabled                  BOOLEAN NOT NULL DEFAULT false,
    label                               TEXT NOT NULL DEFAULT 'subject to final Australian legal confirmation',
    proposed_by                         TEXT NOT NULL,
    approved_by                         TEXT,
    is_active                           BOOLEAN NOT NULL DEFAULT false,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Hard ceilings enforced at the database layer too, not just in
    -- pilot_config.py -- app-layer validation can have bugs or be
    -- bypassed by a direct DB write; these constraints cannot.
    CONSTRAINT chk_max_customers CHECK (max_pilot_customers <= 25),
    CONSTRAINT chk_credit_limit CHECK (contractual_credit_limit <= 2500.00),
    CONSTRAINT chk_initial_credit_range CHECK (
        initial_available_credit_min >= 300.00
        AND initial_available_credit_max <= 500.00
        AND initial_available_credit_min <= initial_available_credit_max
    ),
    CONSTRAINT chk_single_bill_limit CHECK (max_single_bill_payment <= 500.00),
    CONSTRAINT chk_outstanding_limit CHECK (max_outstanding_balance <= 2500.00),
    CONSTRAINT chk_aggregate_cap CHECK (aggregate_contractual_exposure_cap <= 62500.00),
    CONSTRAINT chk_aggregate_implied CHECK (
        (max_pilot_customers * contractual_credit_limit) <= 62500.00
    ),
    CONSTRAINT chk_contract_term CHECK (contract_term_months = 12),
    CONSTRAINT chk_pilot_duration CHECK (pilot_duration_months <= 6),
    CONSTRAINT chk_no_cash_withdrawals CHECK (cash_withdrawals_enabled = false),
    CONSTRAINT chk_no_customer_transfers CHECK (customer_transfers_enabled = false),
    CONSTRAINT chk_zero_interest CHECK (interest_rate_percent = 0),
    CONSTRAINT chk_zero_late_fee CHECK (late_fee_amount = 0),
    CONSTRAINT chk_zero_early_repayment_fee CHECK (early_repayment_fee_amount = 0),
    CONSTRAINT chk_approver_distinct CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);

-- Only one active config version at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pilot_config_single_active
    ON pilot_config_versions ((is_active))
    WHERE is_active = true;

-- ------------------------------------------------------------
-- 2. Launch gates: one row per mandatory gate (see launch_gates.py
--    MANDATORY_GATES for the canonical list of gate_key values).
--    Absence of a row for a given gate_key = that gate is closed;
--    application code (get_all_gate_statuses) defaults missing gates to
--    'not_started', matching this table's fail-closed intent.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS launch_gates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_key          TEXT NOT NULL UNIQUE,
    description       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'not_started',
    owner             TEXT,
    evidence_reference TEXT,
    reviewer          TEXT,
    approval_date     TIMESTAMPTZ,
    expiry_date       TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_gate_status CHECK (status IN ('not_started', 'evidence_submitted', 'approved', 'expired', 'failed')),
    -- Maker-checker at the DB layer: reviewer can never equal owner for
    -- an approved gate. (Also enforced in launch_gates.approve_gate();
    -- this is the belt to that braces.)
    CONSTRAINT chk_gate_maker_checker CHECK (
        status <> 'approved' OR (reviewer IS NOT NULL AND reviewer <> owner)
    )
);

CREATE OR REPLACE FUNCTION touch_launch_gate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_launch_gates_updated_at ON launch_gates;
CREATE TRIGGER trg_launch_gates_updated_at
    BEFORE UPDATE ON launch_gates
    FOR EACH ROW EXECUTE FUNCTION touch_launch_gate_updated_at();

-- ------------------------------------------------------------
-- 3. Append-only audit history for gate changes. Never updated or
--    deleted from application code -- see engineering/audit rules in
--    the top-level task spec (audit-event immutability).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS launch_gate_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    gate_key        TEXT NOT NULL,
    action          TEXT NOT NULL,
    actor           TEXT NOT NULL,
    reason          TEXT,
    previous_state  JSONB,
    new_state       JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Belt-and-braces immutability: revoke UPDATE/DELETE from anything but
-- the owning role at the Postgres level. service_role (used by the
-- backend) bypasses table privileges via RLS but not GRANT/REVOKE, so
-- this still matters if a future code path uses a lesser-privileged role.
REVOKE UPDATE, DELETE ON launch_gate_audit_log FROM PUBLIC;

-- ------------------------------------------------------------
-- 4. Two-person production activation events. Append-only.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_activation_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by   TEXT NOT NULL,
    approver_1     TEXT NOT NULL,
    approver_2     TEXT NOT NULL,
    reason         TEXT,
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_distinct_approvers CHECK (approver_1 <> approver_2),
    CONSTRAINT chk_requester_not_approver CHECK (
        requested_by <> approver_1 AND requested_by <> approver_2
    )
);

REVOKE UPDATE, DELETE ON production_activation_events FROM PUBLIC;

-- ------------------------------------------------------------
-- 5. RLS default-deny, matching migration 007's posture: enable RLS,
--    add zero policies. Only service_role (used exclusively by the
--    FastAPI backend) can read/write; anon/authenticated get nothing.
-- ------------------------------------------------------------
ALTER TABLE pilot_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_gate_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_activation_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. Audit-log trigger coverage, consistent with 005's approach for the
--    ledger tables (jsonb-based user_id lookup, safe for tables with no
--    user_id column at all).
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_pilot_config_versions ON pilot_config_versions;
CREATE TRIGGER audit_pilot_config_versions
    AFTER INSERT OR UPDATE OR DELETE ON pilot_config_versions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_launch_gates ON launch_gates;
CREATE TRIGGER audit_launch_gates
    AFTER INSERT OR UPDATE OR DELETE ON launch_gates
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_production_activation_events ON production_activation_events;
CREATE TRIGGER audit_production_activation_events
    AFTER INSERT OR UPDATE OR DELETE ON production_activation_events
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
