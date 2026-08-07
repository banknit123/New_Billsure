-- ============================================================
-- 022 -- ASIC ERS unified audit events schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-021.
--
-- Additive. Does not replace or migrate data from the existing
-- audit_log / onboarding_audit_log / launch_gate_audit_log /
-- complaint_audit_log tables -- see backend/audit_events.py's module
-- docstring for the honest scope note on why those remain separate for
-- now.

CREATE TABLE IF NOT EXISTS audit_events (
    id                BIGSERIAL PRIMARY KEY,
    category          TEXT NOT NULL,
    action            TEXT NOT NULL,
    actor             TEXT NOT NULL,
    role              TEXT NOT NULL,
    object_type       TEXT NOT NULL,
    object_id         TEXT NOT NULL,
    previous_state    JSONB,
    new_state         JSONB,
    reason            TEXT,
    correlation_id    TEXT,
    source            TEXT NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_audit_event_category CHECK (category IN (
        'login', 'security', 'onboarding', 'consent', 'credit_assessment',
        'override', 'limit_change', 'bill_approval', 'payment', 'ledger_posting',
        'reconciliation', 'complaint', 'hardship', 'document_change',
        'administrative_access', 'launch_gate_change', 'configuration_change',
        'data_export'
    ))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_object ON audit_events(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_category ON audit_events(category);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);

-- Append-only: no UPDATE/DELETE from application code, ever.
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
