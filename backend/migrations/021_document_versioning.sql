-- ============================================================
-- 021 -- ASIC ERS document versioning + customer acceptance schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-020.

CREATE TABLE IF NOT EXISTS document_versions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type     TEXT NOT NULL,
    version           INTEGER NOT NULL,
    content           TEXT NOT NULL,
    content_hash      TEXT NOT NULL,
    effective_date    TEXT NOT NULL,
    is_material_change BOOLEAN NOT NULL DEFAULT false,
    is_template       BOOLEAN NOT NULL DEFAULT true,
    template_warning  TEXT,
    status            TEXT NOT NULL DEFAULT 'draft',
    created_by        TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by       TEXT,
    approved_at       TIMESTAMPTZ,

    CONSTRAINT chk_document_type CHECK (document_type IN (
        'ers_disclosure', 'credit_guide', 'credit_contract', 'repayment_schedule_disclosure',
        'non_cash_payment_facility_terms', 'product_disclosure_material', 'target_market_determination',
        'privacy_policy', 'privacy_collection_notice', 'customer_funds_disclosure',
        'fees_and_remuneration_disclosure', 'complaints_and_afca_information',
        'hardship_information', 'exit_and_wind_down_disclosure'
    )),
    CONSTRAINT chk_document_status CHECK (status IN ('draft', 'approved', 'archived')),
    CONSTRAINT chk_document_distinct_approver CHECK (approved_by IS NULL OR approved_by <> created_by),
    CONSTRAINT chk_document_version_positive CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_version_per_type ON document_versions(document_type, version);
-- Only one approved (active) version per document_type at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_approved_version_per_type
    ON document_versions(document_type) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS document_acceptances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID NOT NULL,
    document_type    TEXT NOT NULL,
    version_id       UUID NOT NULL REFERENCES document_versions(id),
    version_number   INTEGER NOT NULL,
    content_hash     TEXT NOT NULL,
    accepted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address       TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_acceptances_customer ON document_acceptances(customer_id);
CREATE INDEX IF NOT EXISTS idx_document_acceptances_type ON document_acceptances(document_type);

-- Acceptances are append-only -- a customer's acceptance history is
-- never edited or deleted, only added to.
REVOKE UPDATE, DELETE ON document_acceptances FROM PUBLIC;

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_acceptances ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_document_versions ON document_versions;
CREATE TRIGGER audit_document_versions
    AFTER INSERT OR UPDATE OR DELETE ON document_versions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_document_acceptances ON document_acceptances;
CREATE TRIGGER audit_document_acceptances
    AFTER INSERT OR UPDATE OR DELETE ON document_acceptances
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
