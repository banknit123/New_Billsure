-- ============================================================
-- 009 -- payment_transactions.paid_at (closes a real gap found
-- while hotfixing the Stripe checkout syntax error)
-- ============================================================
-- check_payment_status()/stripe_webhook() in server.py both write this
-- column on the "paid" transition -- confirmed via information_schema
-- that it did not exist on the live table. Purely additive.

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
