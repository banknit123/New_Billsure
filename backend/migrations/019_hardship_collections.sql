-- ============================================================
-- 019 -- ASIC ERS repayments, hardship, and collections schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-018.

-- ------------------------------------------------------------
-- 1. Repayment schedules + installments.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repayment_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL,
    principal     NUMERIC(12,2) NOT NULL,
    term_months   INTEGER NOT NULL,
    created_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_schedule_principal_positive CHECK (principal > 0),
    CONSTRAINT chk_schedule_term_positive CHECK (term_months > 0)
);

CREATE TABLE IF NOT EXISTS repayment_installments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id           UUID NOT NULL REFERENCES repayment_schedules(id),
    sequence              INTEGER NOT NULL,
    due_date              TEXT NOT NULL,
    scheduled_amount      NUMERIC(12,2) NOT NULL,
    status                TEXT NOT NULL DEFAULT 'scheduled',
    amount_paid           NUMERIC(12,2),
    payment_date          TEXT,
    credit_journal_id     UUID REFERENCES credit_journal_entries(id),
    is_advance            BOOLEAN,
    failure_reason        TEXT,
    failed_recorded_by    TEXT,
    failed_at             TIMESTAMPTZ,
    reschedule_count      INTEGER NOT NULL DEFAULT 0,
    reschedule_reason     TEXT,
    rescheduled_by        TEXT,

    CONSTRAINT chk_installment_status CHECK (status IN ('scheduled', 'paid', 'partial', 'failed', 'skipped')),
    CONSTRAINT chk_installment_amount_positive CHECK (scheduled_amount > 0),
    -- No fee/interest columns exist on this table at all -- not merely
    -- zeroed, structurally absent, so there is nothing here a future
    -- change could accidentally set to a nonzero value.
    CONSTRAINT chk_reschedule_bound CHECK (reschedule_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_repayment_installments_schedule ON repayment_installments(schedule_id);

-- ------------------------------------------------------------
-- 2. Hardship cases, collection pauses, arrangements.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hardship_cases (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id             UUID NOT NULL,
    reason                  TEXT NOT NULL,
    vulnerability_indicators TEXT[] NOT NULL DEFAULT '{}',
    status                  TEXT NOT NULL DEFAULT 'open',
    requested_by            TEXT NOT NULL,
    escalation_history      JSONB NOT NULL DEFAULT '[]',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_hardship_status CHECK (status IN ('open', 'arrangement_proposed', 'arrangement_active', 'escalated', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_hardship_cases_customer ON hardship_cases(customer_id);

CREATE TABLE IF NOT EXISTS collection_pauses (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardship_case_id   UUID NOT NULL REFERENCES hardship_cases(id),
    customer_id        UUID NOT NULL,
    paused_by          TEXT NOT NULL,
    approved_by        TEXT NOT NULL,
    pause_until        TEXT NOT NULL,
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_pause_distinct_people CHECK (paused_by <> approved_by)
);

CREATE INDEX IF NOT EXISTS idx_collection_pauses_customer ON collection_pauses(customer_id);

CREATE TABLE IF NOT EXISTS hardship_arrangements (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardship_case_id       UUID NOT NULL REFERENCES hardship_cases(id),
    customer_id            UUID NOT NULL,
    proposed_installments  JSONB NOT NULL,
    proposed_by            TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'proposed',
    approved_by            TEXT,
    approved_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_arrangement_status CHECK (status IN ('proposed', 'approved')),
    CONSTRAINT chk_arrangement_distinct_approver CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);

-- ------------------------------------------------------------
-- 3. RLS default-deny + audit triggers, matching prior pilot migrations.
-- ------------------------------------------------------------
ALTER TABLE repayment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardship_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardship_arrangements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_repayment_schedules ON repayment_schedules;
CREATE TRIGGER audit_repayment_schedules
    AFTER INSERT OR UPDATE OR DELETE ON repayment_schedules
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_repayment_installments ON repayment_installments;
CREATE TRIGGER audit_repayment_installments
    AFTER INSERT OR UPDATE OR DELETE ON repayment_installments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_hardship_cases ON hardship_cases;
CREATE TRIGGER audit_hardship_cases
    AFTER INSERT OR UPDATE OR DELETE ON hardship_cases
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_collection_pauses ON collection_pauses;
CREATE TRIGGER audit_collection_pauses
    AFTER INSERT OR UPDATE OR DELETE ON collection_pauses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_hardship_arrangements ON hardship_arrangements;
CREATE TRIGGER audit_hardship_arrangements
    AFTER INSERT OR UPDATE OR DELETE ON hardship_arrangements
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
