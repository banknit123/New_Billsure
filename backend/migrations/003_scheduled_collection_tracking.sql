-- ============================================================
-- 003_scheduled_collection_tracking.sql
--
-- Supports stripe_collections.py: tracks every scheduled-contribution
-- charge attempt with a unique idempotency key (the actual mechanism that
-- prevents a scheduler crash-and-retry from double-charging a customer),
-- and adds failure-tracking columns to payment_plans so repeated failures
-- surface to admins instead of silently retrying forever.
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_attempts (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    payment_plan_id TEXT NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending -> succeeded / processing / failed
    stripe_payment_intent_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_plan ON collection_attempts(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_user ON collection_attempts(user_id);

ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS last_collection_attempt_at TIMESTAMPTZ;
ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS last_collection_status TEXT;
ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- payment_methods needs the token column actually used for charging, plus
-- the card/BECS display fields stripe_collections.py writes.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

ALTER TABLE collection_attempts ENABLE ROW LEVEL SECURITY;
