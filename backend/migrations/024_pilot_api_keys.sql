-- ============================================================
-- 024 -- Pilot API key authentication schema
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-023.
--
-- Only key_hash is ever stored -- the raw API key is never persisted
-- anywhere (see backend/pilot_auth.py's module docstring). A leaked
-- database dump does not expose usable API keys, only their hashes.

CREATE TABLE IF NOT EXISTS pilot_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash        TEXT NOT NULL UNIQUE,
    actor_id        TEXT NOT NULL,
    role            TEXT NOT NULL,
    mfa_verified    BOOLEAN NOT NULL DEFAULT false,
    issued_by       TEXT NOT NULL,
    notes           TEXT,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked         BOOLEAN NOT NULL DEFAULT false,
    revoked_by      TEXT,
    revoked_reason  TEXT,
    revoked_at      TIMESTAMPTZ,

    CONSTRAINT chk_pilot_api_key_role CHECK (role IN ('customer', 'case_worker', 'compliance_reviewer', 'admin', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_pilot_api_keys_actor ON pilot_api_keys(actor_id);

ALTER TABLE pilot_api_keys ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_pilot_api_keys ON pilot_api_keys;
CREATE TRIGGER audit_pilot_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON pilot_api_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
