-- ============================================================
-- 017 -- link onboarding applications to an identity_verification.py session
-- ============================================================
-- STATUS: NOT APPLIED to the live EasyBillsPay Supabase project (or any
-- other live/production database) -- same posture as migrations
-- 012-016.
--
-- Additive-only: one nullable column so onboarding.start_identity_
-- verification() has somewhere to record the provider session id it
-- gets back, and onboarding.apply_identity_verification_result() has
-- somewhere to read it from.

ALTER TABLE onboarding_applications
    ADD COLUMN IF NOT EXISTS identity_verification_session_id TEXT;
