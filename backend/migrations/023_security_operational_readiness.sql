-- ============================================================
-- 023 -- ASIC ERS security controls + operational readiness schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-022.

CREATE TABLE IF NOT EXISTS mfa_verifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT NOT NULL,
    role         TEXT NOT NULL,
    method       TEXT NOT NULL,
    verified_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL,
    requested_by      TEXT NOT NULL,
    reason            TEXT NOT NULL,
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_until   TIMESTAMPTZ NOT NULL,
    retention_source  TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending_retention_period',

    CONSTRAINT chk_deletion_status CHECK (status IN ('pending_retention_period', 'deleted', 'rejected'))
);

CREATE TABLE IF NOT EXISTS data_breach_assessments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description                 TEXT NOT NULL,
    affected_data_categories    TEXT[] NOT NULL DEFAULT '{}',
    severity                    TEXT NOT NULL,
    assessed_by                 TEXT NOT NULL,
    notifiable                  BOOLEAN,
    assessed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    status                      TEXT NOT NULL DEFAULT 'under_assessment',

    CONSTRAINT chk_breach_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS feature_flag_changes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name    TEXT NOT NULL,
    enabled      BOOLEAN NOT NULL,
    changed_by   TEXT NOT NULL,
    reason       TEXT NOT NULL,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_changes_name ON feature_flag_changes(flag_name);

CREATE TABLE IF NOT EXISTS job_heartbeats (
    id            BIGSERIAL PRIMARY KEY,
    job_name      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'ok',
    detail        TEXT,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_heartbeats_name ON job_heartbeats(job_name);

CREATE TABLE IF NOT EXISTS backup_verifications (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_reference   TEXT NOT NULL,
    verified_by        TEXT NOT NULL,
    restore_tested     BOOLEAN NOT NULL DEFAULT false,
    notes              TEXT,
    verified_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mfa_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_breach_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_verifications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_account_deletion_requests ON account_deletion_requests;
CREATE TRIGGER audit_account_deletion_requests
    AFTER INSERT OR UPDATE OR DELETE ON account_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_data_breach_assessments ON data_breach_assessments;
CREATE TRIGGER audit_data_breach_assessments
    AFTER INSERT OR UPDATE OR DELETE ON data_breach_assessments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_feature_flag_changes ON feature_flag_changes;
CREATE TRIGGER audit_feature_flag_changes
    AFTER INSERT OR UPDATE OR DELETE ON feature_flag_changes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
