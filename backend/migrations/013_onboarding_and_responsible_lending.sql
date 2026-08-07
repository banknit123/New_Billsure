-- ============================================================
-- 013 -- ASIC ERS onboarding/eligibility + responsible-lending schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migration 012. See
-- that file's header for why. Apply this only to a dedicated sandbox
-- Postgres instance.
--
-- Purely additive: new tables only, no changes to any existing table.
-- RLS default-deny, audit-trigger coverage, and hard CHECK constraints
-- follow the same pattern established in 007/012.

-- ------------------------------------------------------------
-- 1. Onboarding applications. One application can be re-submitted (a new
--    row) if withdrawn or declined and the applicant reapplies -- this
--    table is never updated to erase a prior application's outcome.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_applications (
    id                                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                                  UUID NOT NULL,
    identity_verification_status             TEXT NOT NULL DEFAULT 'pending',
    age_confirmed                            BOOLEAN NOT NULL DEFAULT false,
    residential_state                        TEXT,
    residential_country                      TEXT NOT NULL DEFAULT 'AU',
    bank_account_verified                    BOOLEAN NOT NULL DEFAULT false,
    employment_status                        TEXT,
    requested_credit_purpose                 TEXT,
    requirements_and_objectives              TEXT,
    vulnerability_indicators                 TEXT[] NOT NULL DEFAULT '{}',
    bankruptcy_status                        TEXT NOT NULL DEFAULT 'unknown',
    utility_bill_ownership_verified          BOOLEAN NOT NULL DEFAULT false,
    consents                                 JSONB NOT NULL DEFAULT '{}',
    -- Sensitive financial fields are stored pre-encrypted (Fernet, via
    -- utils.auth.encrypt_field) by the caller -- this table never
    -- receives plaintext income/expense figures.
    income_amount_encrypted                  TEXT,
    income_frequency                         TEXT,
    recurring_living_expenses_encrypted      TEXT,
    existing_debts_and_bnpl_encrypted        TEXT,
    eligibility_outcome                      TEXT,
    eligibility_evidence                     JSONB,
    final_outcome                            TEXT,
    reason_codes                             TEXT[] NOT NULL DEFAULT '{}',
    policy_version                           TEXT NOT NULL,
    manual_review_notes                      TEXT,
    manual_reviewed_by                       TEXT,
    manual_reviewed_at                       TIMESTAMPTZ,
    created_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_identity_status CHECK (identity_verification_status IN ('pending', 'verified', 'failed')),
    CONSTRAINT chk_bankruptcy_status CHECK (bankruptcy_status IN ('none', 'undischarged', 'discharged', 'unknown')),
    CONSTRAINT chk_eligibility_outcome CHECK (eligibility_outcome IS NULL OR eligibility_outcome IN ('eligible', 'declined', 'referred', 'withdrawn')),
    CONSTRAINT chk_final_outcome CHECK (final_outcome IS NULL OR final_outcome IN ('approved', 'declined', 'referred', 'withdrawn')),
    -- A non-approved final outcome must carry at least one reason code.
    CONSTRAINT chk_reasons_required CHECK (
        final_outcome IS NULL OR final_outcome = 'approved' OR array_length(reason_codes, 1) > 0
    ),
    -- Reviewer cannot be blank when a manual outcome is recorded.
    CONSTRAINT chk_manual_review_consistency CHECK (
        final_outcome IS NULL OR manual_reviewed_by IS NOT NULL OR final_outcome = 'approved'
    )
);

CREATE INDEX IF NOT EXISTS idx_onboarding_applications_user ON onboarding_applications(user_id);

-- ------------------------------------------------------------
-- 2. Append-only onboarding audit log.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    application_id  UUID NOT NULL,
    action          TEXT NOT NULL,
    actor           TEXT NOT NULL,
    reason          TEXT,
    previous_state  JSONB,
    new_state       JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON onboarding_audit_log FROM PUBLIC;

-- ------------------------------------------------------------
-- 3. Maker-checker credit activation events. Append-only. approved_by
--    must differ from prepared_by at the DB layer too.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_activation_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL,
    prepared_by     TEXT NOT NULL,
    approved_by     TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_activation_distinct_people CHECK (prepared_by <> approved_by)
);
REVOKE UPDATE, DELETE ON credit_activation_events FROM PUBLIC;

-- ------------------------------------------------------------
-- 4. Responsible-lending assessments. Immutable once created; a
--    reassessment is a new row, with `superseded` flipped true on the
--    prior one (application logic's job, not a trigger, since "prior
--    assessment for the same application" is an app-level concept here).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responsible_lending_assessments (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id                  UUID NOT NULL,
    assessed_by                     TEXT NOT NULL,
    verified_net_income_monthly     NUMERIC(12,2) NOT NULL,
    essential_expenditure_monthly   NUMERIC(12,2) NOT NULL,
    existing_repayments_monthly     NUMERIC(12,2) NOT NULL,
    proposed_repayment_monthly      NUMERIC(12,2) NOT NULL,
    surplus_monthly                 NUMERIC(12,2) NOT NULL,
    affordability_pass              BOOLEAN NOT NULL,
    evidence_issues                 TEXT[] NOT NULL DEFAULT '{}',
    referral_required               BOOLEAN NOT NULL DEFAULT false,
    recommendation                  TEXT NOT NULL,
    reasons                         TEXT[] NOT NULL DEFAULT '{}',
    policy_version                  TEXT NOT NULL,
    human_readable_report           TEXT NOT NULL,
    assessed_at                     TIMESTAMPTZ NOT NULL,
    superseded                      BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT chk_recommendation CHECK (recommendation IN ('approve', 'decline', 'refer'))
);

CREATE INDEX IF NOT EXISTS idx_rl_assessments_application ON responsible_lending_assessments(application_id);

-- ------------------------------------------------------------
-- 5. Documented, independently-approved overrides of an assessment
--    recommendation. Append-only; approver must differ from the person
--    requesting the override at the DB layer too.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responsible_lending_overrides (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id            UUID NOT NULL,
    original_recommendation  TEXT NOT NULL,
    override_to              TEXT NOT NULL,
    reason                   TEXT NOT NULL,
    overridden_by            TEXT NOT NULL,
    approved_by              TEXT NOT NULL,
    timestamp                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_override_distinct_people CHECK (overridden_by <> approved_by),
    CONSTRAINT chk_override_reason_required CHECK (length(trim(reason)) > 0),
    CONSTRAINT chk_override_to CHECK (override_to IN ('approve', 'decline', 'refer'))
);
REVOKE UPDATE, DELETE ON responsible_lending_overrides FROM PUBLIC;

-- ------------------------------------------------------------
-- 6. RLS default-deny + audit triggers, matching 007/012's posture.
-- ------------------------------------------------------------
ALTER TABLE onboarding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_activation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsible_lending_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsible_lending_overrides ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_onboarding_applications ON onboarding_applications;
CREATE TRIGGER audit_onboarding_applications
    AFTER INSERT OR UPDATE OR DELETE ON onboarding_applications
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_credit_activation_events ON credit_activation_events;
CREATE TRIGGER audit_credit_activation_events
    AFTER INSERT OR UPDATE OR DELETE ON credit_activation_events
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_responsible_lending_assessments ON responsible_lending_assessments;
CREATE TRIGGER audit_responsible_lending_assessments
    AFTER INSERT OR UPDATE OR DELETE ON responsible_lending_assessments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_responsible_lending_overrides ON responsible_lending_overrides;
CREATE TRIGGER audit_responsible_lending_overrides
    AFTER INSERT OR UPDATE OR DELETE ON responsible_lending_overrides
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
