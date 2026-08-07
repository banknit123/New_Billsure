-- ============================================================
-- 020 -- ASIC ERS complaints / IDR / AFCA escalation schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-019.
--
-- No table here represents an AFCA API integration -- AFCA has no
-- public API (confirmed against their member portal documentation
-- before building this; see backend/complaints.py's module docstring).
-- afca_reference_number is a plain nullable text column populated
-- manually by a human copying it from AFCA's member portal.

CREATE TABLE IF NOT EXISTS complaints (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id                 UUID NOT NULL,
    channel                     TEXT NOT NULL,
    description                 TEXT NOT NULL,
    category                    TEXT NOT NULL,
    severity                    TEXT NOT NULL,
    vulnerability_indicators    TEXT[] NOT NULL DEFAULT '{}',
    status                      TEXT NOT NULL DEFAULT 'open',
    stage                       TEXT NOT NULL DEFAULT 'received',
    owner                       TEXT,
    credit_decision_id          UUID,
    bill_id                     UUID,
    disbursement_id             UUID,
    application_id              UUID,
    received_by                 TEXT NOT NULL,
    received_at                 TIMESTAMPTZ NOT NULL,
    acknowledgement_due_at      TIMESTAMPTZ NOT NULL,
    acknowledged_by             TEXT,
    acknowledged_at             TIMESTAMPTZ,
    acknowledgement_late        BOOLEAN,
    response_due_at             TIMESTAMPTZ NOT NULL,
    policy_version               TEXT NOT NULL,
    investigation_notes         JSONB NOT NULL DEFAULT '[]',
    communications              JSONB NOT NULL DEFAULT '[]',
    outcome                     TEXT,
    root_cause_category         TEXT,
    resolution_notes            TEXT,
    resolved_by                 TEXT,
    resolved_at                 TIMESTAMPTZ,
    resolved_late               BOOLEAN,
    escalated_to_afca_at        TIMESTAMPTZ,
    escalated_by                TEXT,
    afca_reference_number        TEXT,   -- manually entered from AFCA's member portal; never auto-populated

    CONSTRAINT chk_complaint_status CHECK (status IN ('open', 'closed')),
    CONSTRAINT chk_complaint_stage CHECK (stage IN (
        'received', 'acknowledged', 'investigating', 'awaiting_customer',
        'remedy_proposed', 'resolved', 'escalated_to_afca', 'closed'
    )),
    CONSTRAINT chk_complaint_channel CHECK (channel IN ('phone', 'email', 'web_form', 'in_person', 'mail', 'social_media')),
    CONSTRAINT chk_complaint_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_complaint_category CHECK (category IN ('standard', 'credit_default_notice', 'superannuation_trustee')),
    CONSTRAINT chk_complaint_root_cause CHECK (root_cause_category IS NULL OR root_cause_category IN (
        'process_failure', 'system_error', 'staff_conduct', 'communication_failure',
        'product_design', 'third_party_provider', 'policy_or_pricing', 'other'
    ))
);

CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_response_due ON complaints(response_due_at);

CREATE TABLE IF NOT EXISTS complaint_remedies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id          UUID NOT NULL REFERENCES complaints(id),
    description           TEXT NOT NULL,
    compensation_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    proposed_by           TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'proposed',
    approved_by           TEXT,
    approved_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_remedy_status CHECK (status IN ('proposed', 'approved')),
    CONSTRAINT chk_remedy_compensation_nonneg CHECK (compensation_amount >= 0),
    CONSTRAINT chk_remedy_distinct_approver CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);

CREATE TABLE IF NOT EXISTS complaint_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    complaint_id    UUID NOT NULL,
    action          TEXT NOT NULL,
    actor           TEXT NOT NULL,
    reason          TEXT,
    previous_state  JSONB,
    new_state       JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON complaint_audit_log FROM PUBLIC;

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_remedies ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_audit_log ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_complaints ON complaints;
CREATE TRIGGER audit_complaints
    AFTER INSERT OR UPDATE OR DELETE ON complaints
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_complaint_remedies ON complaint_remedies;
CREATE TRIGGER audit_complaint_remedies
    AFTER INSERT OR UPDATE OR DELETE ON complaint_remedies
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
