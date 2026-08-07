-- ============================================================
-- 018 -- Didit webhook idempotency tracking
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-017.
--
-- Additive-only: one new table so onboarding.apply_identity_verification
-- _webhook() can detect and skip an already-processed delivery (Didit
-- retries up to twice on 5xx/404 -- see identity_verification.py). The
-- primary key on event_id makes a duplicate insert fail fast even if
-- the application-layer check is ever bypassed or raced.

CREATE TABLE IF NOT EXISTS didit_webhook_events (
    event_id        TEXT PRIMARY KEY,
    session_id       TEXT NOT NULL,
    application_id   TEXT,
    status           TEXT NOT NULL,
    received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_application ON didit_webhook_events(application_id);

ALTER TABLE didit_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON didit_webhook_events FROM PUBLIC;

DROP TRIGGER IF EXISTS audit_didit_webhook_events ON didit_webhook_events;
CREATE TRIGGER audit_didit_webhook_events
    AFTER INSERT OR UPDATE OR DELETE ON didit_webhook_events
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
