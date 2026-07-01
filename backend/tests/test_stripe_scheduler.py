from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, TEST_USER_EMAIL, ADMIN_EMAIL, API_URL
"""
BillEasyPay Stripe Payment & Scheduler Tests
Tests new endpoints for iteration 3:
- POST /api/payments/create-checkout - Stripe checkout session
- GET /api/payments/status/{session_id} - Payment status
- POST /api/webhook/stripe - Stripe webhook handler
- GET /api/payments/history - User payment transactions
- POST /api/scheduler/trigger-now - Manual scheduler trigger
- GET /api/transactions/history - All transaction types
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@billseasypay.com"
# Loaded from conftest
ADMIN_USER_EMAIL = "admin@billseasypay.com"
ADMIN_USER_PASSWORD = ADMIN_PASSWORD  # from conftest


class TestStripeCheckout:
    """Stripe checkout session tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_create_checkout_small_package(self, auth_headers):
        """Test POST /api/payments/create-checkout with small package ($50)"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "small",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        assert "amount" in data
        assert data["amount"] == 50.0
        # Verify Stripe URL format
        assert data["url"].startswith("https://checkout.stripe.com/")
        print(f"✓ Checkout session created: ${data['amount']}, session={data['session_id'][:20]}...")
    
    def test_create_checkout_medium_package(self, auth_headers):
        """Test POST /api/payments/create-checkout with medium package ($100)"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "medium",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 100.0
        assert data["url"].startswith("https://checkout.stripe.com/")
        print(f"✓ Medium package checkout: ${data['amount']}")
    
    def test_create_checkout_large_package(self, auth_headers):
        """Test POST /api/payments/create-checkout with large package ($250)"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "large",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 250.0
        assert data["url"].startswith("https://checkout.stripe.com/")
        print(f"✓ Large package checkout: ${data['amount']}")
    
    def test_create_checkout_custom_plan(self, auth_headers):
        """Test POST /api/payments/create-checkout with custom_plan (uses plan deduction amount)"""
        # First ensure we have an active plan
        requests.post(f"{BASE_URL}/api/payment-plan/select?frequency=monthly", headers=auth_headers)
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "custom_plan",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "amount" in data
        # Amount should match the plan's deduction amount
        assert data["amount"] > 0
        print(f"✓ Custom plan checkout: ${data['amount']}")
    
    def test_create_checkout_invalid_package(self, auth_headers):
        """Test POST /api/payments/create-checkout with invalid package"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "invalid_package",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid package" in data.get("detail", "")
        print("✓ Invalid package correctly rejected")
    
    def test_create_checkout_requires_auth(self):
        """Test that checkout requires authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "small",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            }
        )
        assert response.status_code in [401, 403]
        print("✓ Checkout correctly requires authentication")


class TestPaymentStatus:
    """Payment status endpoint tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_payment_status_valid_session(self, auth_headers):
        """Test GET /api/payments/status/{session_id} with valid session"""
        # First create a checkout session
        create_response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            json={
                "package_id": "small",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            },
            headers=auth_headers
        )
        session_id = create_response.json()["session_id"]
        
        # Check status
        response = requests.get(f"{BASE_URL}/api/payments/status/{session_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "payment_status" in data
        assert "amount" in data
        # New session should be open/unpaid/pending (or fallback from DB)
        assert data["payment_status"] in ["unpaid", "paid", "no_payment_required", "pending", "initiated"]
        print(f"✓ Payment status: {data['status']}, payment={data['payment_status']}")
    
    def test_payment_status_invalid_session(self, auth_headers):
        """Test GET /api/payments/status/{session_id} with invalid session"""
        response = requests.get(f"{BASE_URL}/api/payments/status/invalid_session_id", headers=auth_headers)
        assert response.status_code == 404
        print("✓ Invalid session correctly returns 404")


class TestStripeWebhook:
    """Stripe webhook endpoint tests"""
    
    def test_webhook_endpoint_exists(self):
        """Test POST /api/webhook/stripe endpoint exists"""
        # Send empty body - should return error but endpoint exists
        response = requests.post(f"{BASE_URL}/api/webhook/stripe", 
            data=b"",
            headers={"Content-Type": "application/json"}
        )
        # Should return 200 with error status (not 404)
        assert response.status_code == 200
        data = response.json()
        # Webhook handler returns status ok or error
        assert "status" in data
        print(f"✓ Webhook endpoint exists, status={data['status']}")


class TestPaymentHistory:
    """Payment history endpoint tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_payment_history(self, auth_headers):
        """Test GET /api/payments/history returns user payment transactions"""
        response = requests.get(f"{BASE_URL}/api/payments/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # If there are transactions, verify structure
        if len(data) > 0:
            tx = data[0]
            assert "session_id" in tx
            assert "amount" in tx
            assert "payment_status" in tx
            assert "type" in tx
        print(f"✓ Payment history: {len(data)} transactions")
    
    def test_payment_history_requires_auth(self):
        """Test that payment history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/history")
        assert response.status_code in [401, 403]
        print("✓ Payment history correctly requires authentication")


class TestSchedulerTrigger:
    """Scheduler trigger endpoint tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_trigger_scheduler_now(self, auth_headers):
        """Test POST /api/scheduler/trigger-now processes deductions and auto-pays"""
        response = requests.post(f"{BASE_URL}/api/scheduler/trigger-now", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "deductions_made" in data
        assert "bills_paid" in data
        assert isinstance(data["deductions_made"], int)
        assert isinstance(data["bills_paid"], int)
        print(f"✓ Scheduler triggered: deductions={data['deductions_made']}, bills_paid={data['bills_paid']}")
    
    def test_trigger_scheduler_requires_auth(self):
        """Test that scheduler trigger requires authentication"""
        response = requests.post(f"{BASE_URL}/api/scheduler/trigger-now")
        assert response.status_code in [401, 403]
        print("✓ Scheduler trigger correctly requires authentication")


class TestTransactionHistory:
    """Transaction history endpoint tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_transaction_history(self, auth_headers):
        """Test GET /api/transactions/history returns all transaction types"""
        response = requests.get(f"{BASE_URL}/api/transactions/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # If there are transactions, verify structure
        if len(data) > 0:
            tx = data[0]
            assert "id" in tx
            assert "user_id" in tx
            assert "type" in tx
            assert "amount" in tx
            assert "description" in tx
            assert "created_at" in tx
            # Type should be one of the valid types
            valid_types = ["deposit", "bill_payment", "auto_bill_payment", "auto_deduction", 
                          "plan_deduction", "stripe_topup", "subscription_fee"]
            assert tx["type"] in valid_types, f"Unknown transaction type: {tx['type']}"
        print(f"✓ Transaction history: {len(data)} transactions")
    
    def test_transaction_history_sorted_by_date(self, auth_headers):
        """Test that transaction history is sorted by date descending"""
        response = requests.get(f"{BASE_URL}/api/transactions/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        if len(data) >= 2:
            # Verify descending order
            for i in range(len(data) - 1):
                assert data[i]["created_at"] >= data[i+1]["created_at"], "Transactions not sorted by date"
        print("✓ Transaction history sorted correctly")
    
    def test_transaction_history_requires_auth(self):
        """Test that transaction history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/transactions/history")
        assert response.status_code in [401, 403]
        print("✓ Transaction history correctly requires authentication")


class TestAccurassiStatus:
    """Accurassi API status tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_accurassi_status_returns_ocr_fallback(self, auth_headers):
        """Test GET /api/accurassi/status returns OCR fallback status"""
        response = requests.get(f"{BASE_URL}/api/accurassi/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "ocr_available" in data
        assert "message" in data
        # OCR should always be available
        assert data["ocr_available"] == True
        # Since no Accurassi credentials, configured should be False
        # and message should mention OCR fallback
        if not data["configured"]:
            assert "OCR" in data["message"]
        print(f"✓ Accurassi status: configured={data['configured']}, ocr={data['ocr_available']}")


class TestPaymentPlanWithNextDeduction:
    """Payment plan tests verifying next_deduction_date"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get headers with auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_select_plan_creates_next_deduction_date(self, auth_headers):
        """Test POST /api/payment-plan/select creates plan with next_deduction_date"""
        response = requests.post(f"{BASE_URL}/api/payment-plan/select?frequency=weekly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "next_deduction_date" in data
        assert data["next_deduction_date"] is not None
        # Verify date is in the future
        next_date = datetime.fromisoformat(data["next_deduction_date"].replace('Z', '+00:00'))
        now = datetime.now(next_date.tzinfo)
        assert next_date > now, "next_deduction_date should be in the future"
        print(f"✓ Plan created with next_deduction_date: {data['next_deduction_date'][:10]}")
    
    def test_plan_has_total_collected_and_paid_out(self, auth_headers):
        """Test that plan tracks total_collected and total_paid_out"""
        # Select a plan first
        requests.post(f"{BASE_URL}/api/payment-plan/select?frequency=monthly", headers=auth_headers)
        
        # Get current plan
        response = requests.get(f"{BASE_URL}/api/payment-plan/current", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_collected" in data
        assert "total_paid_out" in data
        assert isinstance(data["total_collected"], (int, float))
        assert isinstance(data["total_paid_out"], (int, float))
        print(f"✓ Plan tracking: collected=${data['total_collected']}, paid_out=${data['total_paid_out']}")


class TestAdminFinancialOverviewWithPayments:
    """Admin financial overview tests with payment data"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get headers with admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_USER_EMAIL,
            "password": ADMIN_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    def test_financial_overview_includes_collected_and_paid(self, admin_headers):
        """Test GET /api/admin/financial-overview includes collected and paid amounts"""
        response = requests.get(f"{BASE_URL}/api/admin/financial-overview", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_collected" in data
        assert "total_paid_out" in data
        assert "company_float" in data
        # Company float should be collected - paid_out
        expected_float = data["total_collected"] - data["total_paid_out"]
        assert abs(data["company_float"] - expected_float) < 0.01, "Company float calculation incorrect"
        print(f"✓ Financial overview: collected=${data['total_collected']}, paid=${data['total_paid_out']}, float=${data['company_float']}")


class TestAdminCustomerAnalyticsRiskLevels:
    """Admin customer analytics risk level tests"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get headers with admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_USER_EMAIL,
            "password": ADMIN_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    def test_customer_analytics_has_risk_levels(self, admin_headers):
        """Test GET /api/admin/customer-analytics returns correct risk levels"""
        response = requests.get(f"{BASE_URL}/api/admin/customer-analytics", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        
        # Verify all customers have valid risk levels
        for customer in data["customers"]:
            assert "risk_level" in customer
            assert customer["risk_level"] in ["low", "medium", "high"]
            assert "wallet_balance" in customer
            assert "total_pending_amount" in customer
        
        print(f"✓ Customer analytics: {len(data['customers'])} customers with risk levels")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
