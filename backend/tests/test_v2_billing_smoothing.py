from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, API_URL
"""
EasyBillsPay v2 — Backend integration tests for billing smoothing engine
& subscription pricing layer.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pay-manager-stage.preview.emergentagent.com").rstrip("/")

CUSTOMER_EMAIL = "test@billseasypay.com"
CUSTOMER_PASSWORD = TEST_USER_PASSWORD  # from conftest


# ---------- Auth fixture ----------
@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


# ---------- /v2/predict-bills ----------
class TestPredictBills:
    def test_predict_bills_returns_12_month_forecast(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/predict-bills", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prediction" in data
        p = data["prediction"]
        assert p is not None, "Customer should have bills"
        assert "monthly_forecast" in p
        assert len(p["monthly_forecast"]) == 12
        assert p["total_predicted_annual"] > 0
        # category breakdown should include at least the 4 seeded categories
        cats = set(p["category_breakdown"].keys())
        assert {"Electricity", "Water", "Internet", "Gas"}.issubset(cats), f"Got {cats}"

    def test_predict_bills_seasonal_weighting(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/predict-bills", headers=auth_headers, timeout=30)
        forecast = r.json()["prediction"]["monthly_forecast"]
        totals = [m["total"] for m in forecast]
        # Seasonal weighting must produce variation across the year
        assert max(totals) > min(totals), "No seasonal variation in forecast"

    def test_predict_bills_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/v2/predict-bills", timeout=15)
        assert r.status_code in (401, 403)


# ---------- /v2/simulate-plan ----------
class TestSimulatePlan:
    def test_simulate_plan_monthly(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/simulate-plan?frequency=monthly", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        sim = r.json()["simulation"]
        assert sim is not None
        for k in ("smoothed_amount", "peak_month", "trough_month", "seasonal_variance", "annual_predicted"):
            assert k in sim
        assert sim["frequency"] == "monthly"
        assert sim["periods_per_year"] == 12
        assert sim["smoothed_amount"] > 0
        assert sim["seasonal_variance"] >= 0

    def test_simulate_plan_frequency_changes_amount(self, auth_headers):
        amounts = {}
        for freq, periods in [("weekly", 52), ("fortnightly", 26), ("monthly", 12)]:
            r = requests.get(f"{BASE_URL}/api/v2/simulate-plan?frequency={freq}", headers=auth_headers, timeout=30)
            assert r.status_code == 200, f"{freq}: {r.text}"
            sim = r.json()["simulation"]
            assert sim["periods_per_year"] == periods
            amounts[freq] = sim["smoothed_amount"]
        # Each frequency should yield a different per-period amount
        assert amounts["weekly"] < amounts["fortnightly"] < amounts["monthly"], amounts

    def test_simulate_plan_invalid_frequency(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/simulate-plan?frequency=daily", headers=auth_headers, timeout=15)
        assert r.status_code == 400


# ---------- /v2/plan-health ----------
class TestPlanHealth:
    def test_plan_health_response_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/plan-health", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Either an active plan exists, or message returned
        if data.get("health") is None:
            assert "message" in data
        else:
            h = data["health"]
            assert h["status"] in ("healthy", "tight", "deficit")
            for k in ("wallet_balance", "projected_balance_90d", "upcoming_bills_90d", "surplus"):
                assert k in h


# ---------- /v2/savings-comparison ----------
class TestSavingsComparison:
    def test_savings_comparison_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/v2/savings-comparison", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()["comparison"]
        assert c is not None
        assert c["has_data"] is True
        assert "traditional" in c and "smoothed" in c and "savings_analysis" in c
        assert 0 <= c["traditional"]["predictability_score"] <= 100
        assert c["smoothed"]["predictability_score"] == 100
        assert len(c["monthly_comparison"]) == 12


# ---------- /v2/subscription/* ----------
class TestSubscription:
    def test_get_tiers_returns_three(self):
        r = requests.get(f"{BASE_URL}/api/v2/subscription/tiers", timeout=15)
        assert r.status_code == 200, r.text
        tiers = r.json()["tiers"]
        assert len(tiers) == 3
        tier_ids = {t["id"] for t in tiers}
        assert tier_ids == {"basic", "standard", "premium"}
        for t in tiers:
            for k in ("name", "monthly_fee", "features", "buffer_pct"):
                assert k in t
        # Pricing sanity
        by_id = {t["id"]: t for t in tiers}
        assert by_id["basic"]["monthly_fee"] == 0
        assert by_id["standard"]["monthly_fee"] == 9.90
        assert by_id["premium"]["monthly_fee"] == 19.90

    def test_get_current_default_basic(self, auth_headers):
        # Reset to basic first
        requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=basic", headers=auth_headers, timeout=15)
        r = requests.get(f"{BASE_URL}/api/v2/subscription/current", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tier"] == "basic"
        assert data["subscription"]["id"] == "basic"

    def test_select_subscription_updates_tier(self, auth_headers):
        # Select standard
        r = requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=standard", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tier"] == "standard"
        # Verify persistence
        cur = requests.get(f"{BASE_URL}/api/v2/subscription/current", headers=auth_headers, timeout=15).json()
        assert cur["tier"] == "standard"

        # Select premium and verify
        r2 = requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=premium", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["tier"] == "premium"
        cur2 = requests.get(f"{BASE_URL}/api/v2/subscription/current", headers=auth_headers, timeout=15).json()
        assert cur2["tier"] == "premium"

        # Reset back to basic for downstream tests
        requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=basic", headers=auth_headers, timeout=15)

    def test_select_invalid_tier(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=enterprise", headers=auth_headers, timeout=15)
        assert r.status_code == 400

    def test_premium_buffer_is_lower(self, auth_headers):
        """Premium tier should use 5% buffer (vs 8% for basic) — verified via simulate-plan."""
        # Set basic
        requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=basic", headers=auth_headers, timeout=15)
        s_basic = requests.get(f"{BASE_URL}/api/v2/simulate-plan?frequency=monthly", headers=auth_headers, timeout=30).json()["simulation"]
        # Set premium
        requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=premium", headers=auth_headers, timeout=15)
        s_prem = requests.get(f"{BASE_URL}/api/v2/simulate-plan?frequency=monthly", headers=auth_headers, timeout=30).json()["simulation"]
        # Premium has lower buffer => smaller buffered_annual => smaller smoothed_amount
        assert s_prem["buffer_pct"] == 5
        assert s_basic["buffer_pct"] == 8
        assert s_prem["smoothed_amount"] < s_basic["smoothed_amount"]
        # Reset
        requests.post(f"{BASE_URL}/api/v2/subscription/select?tier=basic", headers=auth_headers, timeout=15)
