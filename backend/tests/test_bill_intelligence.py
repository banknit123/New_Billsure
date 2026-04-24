"""Tests for /api/insights/analyze endpoint (Bill Intelligence feature)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pay-manager-stage.preview.emergentagent.com").rstrip("/")

CUSTOMER = {"email": "test@billseasypay.com", "password": "Test123!"}
ADMIN = {"email": "admin@billseasypay.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


# --- Auth sanity check (regression) ---
def test_customer_login_works():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("token") or data.get("access_token")


def test_admin_login_works():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200


# --- Insights endpoint ---
def test_insights_requires_auth():
    r = requests.get(f"{BASE_URL}/api/insights/analyze", timeout=30)
    assert r.status_code in (401, 403)


def test_insights_returns_analytics_and_ai_for_customer(customer_token):
    headers = {"Authorization": f"Bearer {customer_token}"}
    # GPT-4o may take 10-20s
    r = requests.get(f"{BASE_URL}/api/insights/analyze", headers=headers, timeout=90)
    assert r.status_code == 200, f"Got {r.status_code}: {r.text[:500]}"
    body = r.json()

    # Must contain these top-level keys
    assert "analytics" in body, f"Missing 'analytics' key. Keys: {list(body.keys())}"
    assert "ai_insights" in body, f"Missing 'ai_insights' key. Keys: {list(body.keys())}"

    analytics = body["analytics"]
    assert analytics is not None, "analytics is None for customer who has bills"

    # Required analytics fields per review request
    required = ["total_spend", "bill_count", "category_insights", "provider_comparison", "monthly_trend", "trend_direction"]
    for key in required:
        assert key in analytics, f"analytics missing '{key}'. Got: {list(analytics.keys())}"

    assert isinstance(analytics["total_spend"], (int, float))
    assert isinstance(analytics["bill_count"], int)
    assert analytics["bill_count"] > 0, "Expected customer to have bills"
    assert isinstance(analytics["category_insights"], list)
    assert len(analytics["category_insights"]) >= 1
    assert isinstance(analytics["provider_comparison"], list)
    assert isinstance(analytics["monthly_trend"], list)
    assert analytics["trend_direction"] in ("increasing", "decreasing", "stable")

    # Check a category_insight shape
    ci0 = analytics["category_insights"][0]
    for k in ["category", "total_spent", "bill_count", "avg_per_bill", "benchmark_avg", "status"]:
        assert k in ci0, f"category_insights[0] missing '{k}'"

    # ai_insights may be None if LLM failed, but ideally present
    if body["ai_insights"] is not None:
        ai = body["ai_insights"]
        # Expected keys per backend prompt
        assert isinstance(ai, dict)
        # At least summary or highlights should exist
        assert any(k in ai for k in ["summary", "highlights", "savings_tips"]), \
            f"ai_insights has unexpected shape: {list(ai.keys())}"


def test_insights_returns_message_for_admin_no_bills(admin_token):
    """Admin account typically has no bills — should return message, analytics None."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/insights/analyze", headers=headers, timeout=60)
    # Either returns the no-bills message, or 200 with empty analytics, or 403 if admin blocked
    if r.status_code == 200:
        body = r.json()
        assert "analytics" in body
        # If no bills, analytics should be None and message present
        if body.get("analytics") is None:
            assert "message" in body
            assert "bills" in body["message"].lower() or "upload" in body["message"].lower()
    else:
        # Some apps block admin from customer endpoints — acceptable
        assert r.status_code in (401, 403)
