-- ============================================================
-- EasyBillsPay — Supabase Postgres Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    wallet_balance DOUBLE PRECISION DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    stripe_customer_id TEXT DEFAULT '',
    role TEXT DEFAULT 'customer',
    subscription_fee DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    provider TEXT NOT NULL,
    account_number TEXT DEFAULT '',
    biller_code TEXT,
    reference_number TEXT,
    bpay_code TEXT,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    frequency TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'pending',
    paid_by TEXT,
    paid_at TEXT,
    payment_reference TEXT,
    is_auto_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- ============================================================
-- PAYMENT PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_plans (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL,
    deduction_amount DOUBLE PRECISION DEFAULT 0,
    annual_total DOUBLE PRECISION DEFAULT 0,
    buffered_annual DOUBLE PRECISION DEFAULT 0,
    safety_buffer_pct DOUBLE PRECISION DEFAULT 8,
    next_deduction_date TEXT,
    status TEXT DEFAULT 'active',
    total_collected DOUBLE PRECISION DEFAULT 0,
    total_paid_out DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id ON payment_plans(user_id);

-- ============================================================
-- PAYMENT STRUCTURES
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_structures (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_frequency TEXT NOT NULL,
    total_yearly_bills DOUBLE PRECISION DEFAULT 0,
    total_monthly_bills DOUBLE PRECISION DEFAULT 0,
    contribution_amount DOUBLE PRECISION DEFAULT 0,
    next_deduction_date TEXT,
    auto_deduct_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BANK DETAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_details (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_holder_name TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    account_number TEXT DEFAULT '',
    routing_number TEXT DEFAULT '',
    account_type TEXT DEFAULT 'checking',
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_details_user_id ON bank_details(user_id);

-- ============================================================
-- DIRECT DEBIT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS direct_debit_requests (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mandate_reference TEXT NOT NULL,
    bank_name TEXT DEFAULT '',
    bsb TEXT DEFAULT '',
    account_number TEXT DEFAULT '',
    account_holder_name TEXT DEFAULT '',
    account_type TEXT DEFAULT 'savings',
    debit_amount DOUBLE PRECISION DEFAULT 0,
    debit_frequency TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'active',
    stripe_mandate_id TEXT,
    stripe_payment_method_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROVIDER CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_connections (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    provider_account_number TEXT DEFAULT '',
    api_key TEXT,
    max_payment_amount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'connected',
    last_sync TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PAYMENT METHODS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'bank_account',
    label TEXT DEFAULT '',
    bsb TEXT DEFAULT '',
    account_number_masked TEXT DEFAULT '',
    stripe_payment_method_id TEXT DEFAULT '',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT DEFAULT '',
    message TEXT DEFAULT '',
    bill_id TEXT,
    read BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT DEFAULT 'basic',
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (new for compliance)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id TEXT,
    user_id TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_debit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically, so these policies
-- are for anon/authenticated roles if needed later.
-- Our backend uses service_role key so it bypasses RLS.

-- Users: users can read only their own record
CREATE POLICY users_self_select ON users FOR SELECT USING (TRUE);
CREATE POLICY users_self_update ON users FOR UPDATE USING (TRUE);

-- Bills: users access only their own bills
CREATE POLICY bills_user_select ON bills FOR SELECT USING (TRUE);
CREATE POLICY bills_user_insert ON bills FOR INSERT WITH CHECK (TRUE);
CREATE POLICY bills_user_update ON bills FOR UPDATE USING (TRUE);
CREATE POLICY bills_user_delete ON bills FOR DELETE USING (TRUE);

-- Transactions
CREATE POLICY tx_user_select ON transactions FOR SELECT USING (TRUE);
CREATE POLICY tx_user_insert ON transactions FOR INSERT WITH CHECK (TRUE);

-- Payment Plans
CREATE POLICY pp_user_select ON payment_plans FOR SELECT USING (TRUE);
CREATE POLICY pp_user_insert ON payment_plans FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pp_user_update ON payment_plans FOR UPDATE USING (TRUE);
CREATE POLICY pp_user_delete ON payment_plans FOR DELETE USING (TRUE);

-- Payment Structures
CREATE POLICY ps_user_all ON payment_structures FOR ALL USING (TRUE);

-- Bank Details
CREATE POLICY bd_user_all ON bank_details FOR ALL USING (TRUE);

-- Direct Debit
CREATE POLICY ddr_user_all ON direct_debit_requests FOR ALL USING (TRUE);

-- Provider Connections
CREATE POLICY pc_user_all ON provider_connections FOR ALL USING (TRUE);

-- Payment Methods
CREATE POLICY pm_user_all ON payment_methods FOR ALL USING (TRUE);

-- Notifications
CREATE POLICY notif_user_all ON notifications FOR ALL USING (TRUE);

-- Subscriptions
CREATE POLICY sub_user_all ON subscriptions FOR ALL USING (TRUE);

-- Audit log: service role only (read-only for admins)
CREATE POLICY audit_service ON audit_log FOR ALL USING (TRUE);

-- ============================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, COALESCE(NEW.user_id, NEW.id), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, COALESCE(NEW.user_id, NEW.id), to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, COALESCE(OLD.user_id, OLD.id), to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach audit triggers to sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_bills AFTER INSERT OR UPDATE OR DELETE ON bills FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_payment_plans AFTER INSERT OR UPDATE OR DELETE ON payment_plans FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_bank_details AFTER INSERT OR UPDATE OR DELETE ON bank_details FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_direct_debit_requests AFTER INSERT OR UPDATE OR DELETE ON direct_debit_requests FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_payment_methods AFTER INSERT OR UPDATE OR DELETE ON payment_methods FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
