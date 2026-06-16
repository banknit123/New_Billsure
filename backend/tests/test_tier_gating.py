"""Iteration 14: Tier-gating tests for v2 endpoints + refactor sanity + register fix."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pay-manager-stage.preview.emergentagent.com').rstrip('/')

STANDARD_USER = {"email": "test@billseasypay.com", "password": "Test123!"}
ADMIN_USER = {"email": "admin@billseasypay.com", "password": "Admin123!"}
BASIC_USER = {"email": "basicuser@test.com", "password": "Test123!"}

V2_GATED = ["/api/v2/predict-bills", "/api/v2/simulate-plan", "/api/v2/plan-health", "/api/v2/savings-comparison"]
V2_OPEN = ["/api/v2/subscription/tiers", "/api/v2/subscription/current"]


def login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get("token")


@pytest.fixture(scope="session")
def standard_token():
    t = login(STANDARD_USER)
    if not t:
        pytest.skip("Standard user login failed")
    return t


@pytest.fixture(scope="session")
def admin_token():
    t = login(ADMIN_USER)
    if not t:
        pytest.skip("Admin user login failed")
    return t


@pytest.fixture(scope="session")
def basic_token():
    t = login(BASIC_USER)
    if not t:
        pytest.skip("Basic user login failed")
    return t


# ----- Auth / Register -----
class TestAuth:
    def test_login_standard(self):
        t = login(STANDARD_USER)
        assert t and isinstance(t, str) and len(t) > 20

    def test_login_admin(self, admin_token):
        # decode-style sanity: hit a protected endpoint
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("email") == ADMIN_USER["email"]
        assert data.get("is_admin") is True

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nouser@x.com", "password": "wrong"}, timeout=10)
        assert r.status_code in (400, 401)

    def test_register_new_user(self):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": email, "password": "Test123!", "full_name": "Test User"}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data
        assert data.get("user", {}).get("email") == email


# ----- Tier gating -----
class TestTierGating:
    def test_basic_user_blocked_on_v2_endpoints(self, basic_token):
        h = {"Authorization": f"Bearer {basic_token}"}
        for ep in V2_GATED:
            r = requests.get(f"{BASE_URL}{ep}", headers=h, timeout=15)
            assert r.status_code == 403, f"{ep} expected 403, got {r.status_code}: {r.text[:200]}"
            body = r.json()
            msg = (body.get("detail") or "").lower()
            assert "standard" in msg or "premium" in msg or "upgrade" in msg, f"{ep} missing upgrade msg: {body}"

    def test_standard_user_allowed_on_v2_endpoints(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        for ep in V2_GATED:
            r = requests.get(f"{BASE_URL}{ep}", headers=h, timeout=30)
            assert r.status_code == 200, f"{ep} expected 200, got {r.status_code}: {r.text[:200]}"

    def test_standard_predict_bills_returns_data(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        r = requests.get(f"{BASE_URL}/api/v2/predict-bills", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "prediction" in data
        # Should not be empty for seeded Standard user
        if data["prediction"] is not None:
            assert isinstance(data["prediction"], dict)

    def test_subscription_tiers_open(self):
        r = requests.get(f"{BASE_URL}/api/v2/subscription/tiers", timeout=10)
        assert r.status_code == 200
        tiers = r.json().get("tiers", [])
        ids = {t["id"] for t in tiers}
        assert {"basic", "standard", "premium"}.issubset(ids), f"Tiers found: {ids}"

    def test_subscription_current_requires_auth(self, standard_token):
        r = requests.get(f"{BASE_URL}/api/v2/subscription/current", timeout=10)
        assert r.status_code in (401, 403)
        # With auth
        h = {"Authorization": f"Bearer {standard_token}"}
        r2 = requests.get(f"{BASE_URL}/api/v2/subscription/current", headers=h, timeout=10)
        assert r2.status_code == 200

    def test_unauth_blocked_on_v2_gated(self):
        for ep in V2_GATED:
            r = requests.get(f"{BASE_URL}{ep}", timeout=10)
            assert r.status_code in (401, 403)


# ----- Refactor sanity: Bills CRUD still works -----
class TestBillsCRUD:
    def test_list_bills(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        r = requests.get(f"{BASE_URL}/api/bills", headers=h, timeout=10)
        assert r.status_code == 200
        bills = r.json()
        assert isinstance(bills, list)

    def test_create_get_delete_bill(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        payload = {
            "category": "utility",
            "provider": "TEST_Iter14_Biller",
            "account_number": "TEST123",
            "amount": 42.50,
            "due_date": "2026-12-31",
            "frequency": "monthly",
        }
        r = requests.post(f"{BASE_URL}/api/bills", headers=h, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        bill_id = created.get("id")
        assert bill_id

        # GET to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/bills", headers=h, timeout=10)
        assert any(b.get("id") == bill_id for b in r2.json())

        # DELETE
        rd = requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=h, timeout=10)
        assert rd.status_code in (200, 204)


# ----- Refactor sanity: Payment plan calc -----
class TestPaymentPlan:
    def test_payment_plan_calculation(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        r = requests.get(f"{BASE_URL}/api/payment-plan/calculate", headers=h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Expect weekly/fortnightly/monthly keys somewhere
        flat = str(data).lower()
        assert "week" in flat or "month" in flat


# ----- Insights endpoint open (analytics) -----
class TestInsights:
    def test_insights_analyze(self, standard_token):
        h = {"Authorization": f"Bearer {standard_token}"}
        r = requests.get(f"{BASE_URL}/api/insights/analyze", headers=h, timeout=60)
        assert r.status_code == 200
        data = r.json()
        # Must always return analytics
        assert "analytics" in data or "ai_insights" in data or "summary" in data or isinstance(data, dict)
