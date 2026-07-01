from conftest import CUSTOMER, ADMIN, TEST_USER_PASSWORD, ADMIN_PASSWORD, API_URL
"""Iteration 15: Supabase Auth Migration tests.
Validates:
 - Login via Supabase Auth for existing users
 - /api/auth/me works with returned token
 - /api/bills works with returned token
 - New user registration creates Supabase Auth user
 - Forgot-password endpoint returns 200
 - Admin login + admin endpoints
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"



@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def customer_token(s):
    r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----- Login tests -----

class TestLogin:
    def test_customer_login_returns_token_and_user(self, s):
        r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and len(data["token"]) > 20
        assert data["user"]["email"] == CUSTOMER["email"]

    def test_admin_login_returns_admin_role(self, s):
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == ADMIN["email"]
        assert data["user"].get("is_admin") is True or data["user"].get("role") == "admin"

    def test_invalid_login_returns_401(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "x@y.com", "password": "wrong"}, timeout=30)
        assert r.status_code in (400, 401)


# ----- Token works on protected endpoints -----

class TestProtectedEndpoints:
    def test_auth_me_works(self, s, customer_token):
        r = s.get(f"{API}/auth/me", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == CUSTOMER["email"]

    def test_bills_endpoint_works(self, s, customer_token):
        r = s.get(f"{API}/bills", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
        bills = r.json()
        assert isinstance(bills, list)

    def test_no_token_returns_401(self, s):
        r = s.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403)


# ----- Admin endpoints with admin token -----

class TestAdminEndpoints:
    def test_admin_stats_works(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=_h(admin_token), timeout=30)
        # 200 = success; 500 = decode_token() bug with Supabase token
        assert r.status_code == 200, f"Admin stats failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert "total_users" in data or "total_bills" in data or isinstance(data, dict)

    def test_customer_token_denied_on_admin(self, s, customer_token):
        r = s.get(f"{API}/admin/stats", headers=_h(customer_token), timeout=30)
        assert r.status_code in (401, 403)


# ----- Registration -----

class TestRegister:
    def test_register_new_user(self, s):
        unique = f"TEST_supabase_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique,
            "password": TEST_USER_PASSWORD,
            "full_name": "Supabase Test User",
            "phone": "0400000000",
        }
        r = s.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == unique

        # Login back with the same credentials
        rl = s.post(f"{API}/auth/login", json={"email": unique, "password": TEST_USER_PASSWORD}, timeout=30)
        assert rl.status_code == 200, f"Re-login failed: {rl.text}"

        # Use token to call /auth/me
        token = rl.json()["token"]
        rm = s.get(f"{API}/auth/me", headers=_h(token), timeout=30)
        assert rm.status_code == 200
        assert rm.json()["email"] == unique


# ----- Forgot Password -----

class TestForgotPassword:
    def test_forgot_password_known_email(self, s):
        r = s.post(f"{API}/auth/forgot-password", json={"email": CUSTOMER["email"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert "message" in r.json()

    def test_forgot_password_unknown_email_still_200(self, s):
        r = s.post(f"{API}/auth/forgot-password", json={"email": "nobody@nowhere.test"}, timeout=30)
        # Should not leak existence -> always 200
        assert r.status_code == 200, r.text


# ----- Subscription tier (for tier-gated pages) -----

class TestTier:
    def test_subscription_current(self, s, customer_token):
        r = s.get(f"{API}/v2/subscription/current", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text

    def test_predict_bills_standard_tier(self, s, customer_token):
        r = s.get(f"{API}/v2/predict-bills", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
