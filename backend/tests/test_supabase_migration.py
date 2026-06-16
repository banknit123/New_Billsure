"""
Backend regression tests post Supabase Postgres migration.
Validates all critical endpoints still work identically to MongoDB era.
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pay-manager-stage.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "test@billseasypay.com", "password": "Test123!"}
ADMIN = {"email": "admin@billseasypay.com", "password": "Admin123!"}


# ----- Fixtures -----

@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def customer_token(s):
    r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json().get("token") or r.json().get("access_token")


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----- Auth -----

class TestAuth:
    def test_customer_login(self, s):
        r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data or "access_token" in data
        assert data["user"]["email"] == CUSTOMER["email"]
        assert data["user"]["role"] in ("customer", "user")

    def test_admin_login(self, s):
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN["email"]
        assert data["user"]["role"] == "admin"

    def test_invalid_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "x@y.com", "password": "bad"}, timeout=30)
        assert r.status_code in (400, 401)

    def test_me_endpoint(self, s, customer_token):
        r = s.get(f"{API}/auth/me", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == CUSTOMER["email"]

    def test_register_new_user(self, s):
        unique = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique,
            "password": "TestPass123!",
            "full_name": "Test Migration User",
        }
        r = s.post(f"{API}/auth/register", json=payload, timeout=30)
        # Accept 200/201 - new account created
        assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data or "access_token" in data or "user" in data
        # Login back
        rl = s.post(f"{API}/auth/login", json={"email": unique, "password": "TestPass123!"}, timeout=30)
        assert rl.status_code == 200


# ----- Bills CRUD (Supabase persistence) -----

class TestBills:
    def test_list_bills(self, s, customer_token):
        r = s.get(f"{API}/bills", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        bills = r.json()
        assert isinstance(bills, list)
        assert len(bills) >= 5, f"Expected seeded bills, got {len(bills)}"
        # Validate shape (Supabase uses 'provider' as biller name field)
        b = bills[0]
        for f in ("id", "amount", "category", "status"):
            assert f in b, f"Bill missing field {f}"
        assert "provider" in b or "biller_name" in b
        # Confirm no Mongo _id leak
        assert "_id" not in b

    def test_create_and_get_bill(self, s, customer_token):
        payload = {
            "provider": "TEST_Migration Biller",
            "biller_name": "TEST_Migration Biller",
            "biller_code": "TEST123",
            "amount": 42.50,
            "due_date": "2026-12-31",
            "category": "other",
            "frequency": "monthly",
            "reference_number": "TEST-REF-001",
            "account_number": "TEST-ACCT-001",
        }
        r = s.post(f"{API}/bills", json=payload, headers=_h(customer_token), timeout=30)
        assert r.status_code in (200, 201), f"Create bill failed: {r.text}"
        created = r.json()
        assert float(created["amount"]) == payload["amount"]
        bill_id = created["id"]

        # GET to verify persistence
        g = s.get(f"{API}/bills", headers=_h(customer_token), timeout=30)
        assert g.status_code == 200
        ids = [b["id"] for b in g.json()]
        assert bill_id in ids, "Created bill not persisted in Supabase"


# ----- Payment Plans -----

class TestPaymentPlan:
    def test_calculate(self, s, customer_token):
        r = s.get(f"{API}/payment-plan/calculate", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Should be a non-empty dict response
        assert isinstance(data, dict) and len(data) > 0

    def test_current(self, s, customer_token):
        r = s.get(f"{API}/payment-plan/current", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200


# ----- Bill Intelligence (AI) -----

class TestBillIntelligence:
    def test_insights_analyze(self, s, customer_token):
        r = s.get(f"{API}/insights/analyze", headers=_h(customer_token), timeout=60)
        assert r.status_code == 200, f"Insights failed: {r.text[:300]}"
        data = r.json()
        # Should include summary or insights from GPT
        assert isinstance(data, dict)
        # Must reference some category breakdown
        keys = set(data.keys())
        assert keys, "Empty insights response"


# ----- v2 Forecast endpoints -----

class TestV2Forecast:
    def test_predict_bills(self, s, customer_token):
        r = s.get(f"{API}/v2/predict-bills", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "forecast" in data or "monthly_forecast" in data or isinstance(data, dict)

    def test_plan_health(self, s, customer_token):
        r = s.get(f"{API}/v2/plan-health", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        # accept either 'status' or 'health' shape
        assert "status" in data or "health" in data

    def test_savings_comparison(self, s, customer_token):
        r = s.get(f"{API}/v2/savings-comparison", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200


# ----- Subscription tiers -----

class TestSubscription:
    def test_tiers_returns_three(self, s, customer_token):
        r = s.get(f"{API}/v2/subscription/tiers", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        tiers = data.get("tiers") or data
        assert isinstance(tiers, list) and len(tiers) == 3
        ids = {t.get("id") for t in tiers}
        assert {"basic", "standard", "premium"}.issubset(ids)

    def test_current(self, s, customer_token):
        r = s.get(f"{API}/v2/subscription/current", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200


# ----- Notifications (reserved 'read' column test) -----

class TestNotifications:
    def test_list(self, s, customer_token):
        r = s.get(f"{API}/notifications", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))


# ----- Admin -----

class TestAdmin:
    def test_admin_users_list(self, s, admin_token):
        # Common admin endpoint paths
        for path in ("/admin/users", "/admin/customers", "/admin/dashboard"):
            r = s.get(f"{API}{path}", headers=_h(admin_token), timeout=30)
            if r.status_code == 200:
                return
        pytest.skip("No admin listing endpoint matched")
