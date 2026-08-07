-- ============================================================
-- 014 -- ASIC ERS bill verification + permitted-use disbursement schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations 012/013.
-- Apply this only to a dedicated sandbox Postgres instance.
--
-- Deliberately separate from the existing `bills` table (see schema.sql)
-- which belongs to the current bill-smoothing product and has a
-- different data model with no cryptographic hash, no fraud indicators,
-- and no verification workflow. Do not repurpose that table for pilot
-- credit disbursements -- these are new, additive tables only.

-- ------------------------------------------------------------
-- 1. Pilot bill submissions. One row per uploaded bill. Immutable once
--    verified -- a manual review decision updates status/reviewer
--    fields only, never the extracted bill data itself (that would
--    defeat the point of hashing the original file).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pilot_bill_submissions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id                 UUID NOT NULL,
    biller_name_extracted       TEXT NOT NULL,
    biller_reference            TEXT NOT NULL,
    category                    TEXT NOT NULL,
    amount                      NUMERIC(12,2) NOT NULL,
    due_date                    TEXT NOT NULL,
    customer_name_on_bill       TEXT,
    extraction_confidence       NUMERIC(4,3) NOT NULL DEFAULT 1.0,
    fraud_indicators            TEXT[] NOT NULL DEFAULT '{}',
    bill_hash                   TEXT NOT NULL,
    verification_status         TEXT NOT NULL DEFAULT 'pending',
    verification_reasons        TEXT[] NOT NULL DEFAULT '{}',
    verification_evidence       JSONB,
    manual_reviewed_by          TEXT,
    manual_review_notes         TEXT,
    manual_reviewed_at          TIMESTAMPTZ,
    disbursement_id             UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_bill_verification_status CHECK (verification_status IN ('pending', 'verified', 'manual_review', 'rejected')),
    CONSTRAINT chk_bill_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_bill_category CHECK (category IN ('electricity', 'gas', 'water', 'telecommunications')),
    CONSTRAINT chk_bill_confidence_range CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_pilot_bill_submissions_customer ON pilot_bill_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pilot_bill_submissions_hash ON pilot_bill_submissions(bill_hash);
-- A verified/paid bill's (biller, reference, amount, due_date) combination
-- and hash should not repeat for the same customer -- duplicate detection
-- is enforced in application logic (bill_verification.py) against the
-- full customer history rather than a DB uniqueness constraint, because
-- "duplicate" here is deliberately a *review outcome*, not an insert-time
-- rejection -- a duplicate bill is still recorded (status='rejected'),
-- not bounced at the database layer, to preserve the audit trail of the
-- attempt itself.

-- ------------------------------------------------------------
-- 2. Pilot bill disbursements. Append-only. Every disbursement links to
--    exactly one bill via bill_id AND the bill's immutable hash, so a
--    disbursement can never be reattributed to a different bill by
--    editing bill_id alone.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pilot_bill_disbursements (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id                  UUID NOT NULL REFERENCES pilot_bill_submissions(id),
    bill_hash                TEXT NOT NULL,
    amount                   NUMERIC(12,2) NOT NULL,
    recipient_biller_name    TEXT NOT NULL,
    payment_type             TEXT NOT NULL,
    requested_by             TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'queued',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_disbursement_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_disbursement_payment_type CHECK (payment_type = 'verified_utility_biller'),
    CONSTRAINT chk_disbursement_status CHECK (status IN ('queued', 'submitted', 'cleared', 'failed', 'reversed'))
);

CREATE INDEX IF NOT EXISTS idx_pilot_bill_disbursements_bill ON pilot_bill_disbursements(bill_id);

-- A bill can have at most one non-failed/non-reversed disbursement --
-- enforced at the DB layer as well as in payment_permitted_use.py's
-- application-level check, so a race between two concurrent disbursement
-- requests for the same bill can't both succeed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_disbursement_per_bill
    ON pilot_bill_disbursements (bill_id)
    WHERE status NOT IN ('failed', 'reversed');

-- ------------------------------------------------------------
-- 3. RLS default-deny + audit triggers, matching prior pilot migrations.
-- ------------------------------------------------------------
ALTER TABLE pilot_bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_bill_disbursements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_pilot_bill_submissions ON pilot_bill_submissions;
CREATE TRIGGER audit_pilot_bill_submissions
    AFTER INSERT OR UPDATE OR DELETE ON pilot_bill_submissions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_pilot_bill_disbursements ON pilot_bill_disbursements;
CREATE TRIGGER audit_pilot_bill_disbursements
    AFTER INSERT OR UPDATE OR DELETE ON pilot_bill_disbursements
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
