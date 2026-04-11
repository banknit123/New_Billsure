"""
BillEasyPay API Backend Tests
Tests all API endpoints including:
- Authentication (register, login)
- Bills CRUD
- Wallet/Transactions
- Direct Debit (DDR)
- Provider Connections
- Admin endpoints
- Accurassi/OCR bill extraction
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@billseasypay.com"
TEST_USER_PASSWORD = "Test123!"
ADMIN_USER_EMAIL = "admin@billseasypay.com"
ADMIN_USER_PASSWORD = "Admin123!"


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "BillEasyPay" in data["message"]
        print(f"✓ API root working: {data['message']}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        print(f"✓ Login successful for {TEST_USER_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": "Test123!",
            "full_name": "Duplicate User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print("✓ Duplicate email registration correctly rejected")
    
    def test_register_new_user(self):
        """Test registration of new user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@billseasypay.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "full_name": "New Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ New user registered: {unique_email}")


class TestBillsCRUD:
    """Bill management CRUD tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_bills(self, auth_headers):
        """Test fetching user bills"""
        response = requests.get(f"{BASE_URL}/api/bills", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fetched {len(data)} bills")
    
    def test_create_bill(self, auth_headers):
        """Test creating a new bill"""
        due_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        bill_data = {
            "category": "Water",
            "provider": "Sydney Water",
            "account_number": f"TEST_{uuid.uuid4().hex[:8]}",
            "amount": 75.50,
            "due_date": due_date,
            "frequency": "quarterly"
        }
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Water"
        assert data["provider"] == "Sydney Water"
        assert data["amount"] == 75.50
        assert "id" in data
        print(f"✓ Created bill: {data['id']}")
        return data["id"]
    
    def test_create_and_get_bill(self, auth_headers):
        """Test creating a bill and verifying persistence"""
        due_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        bill_data = {
            "category": "Internet",
            "provider": "Aussie Broadband",
            "account_number": f"TEST_{uuid.uuid4().hex[:8]}",
            "amount": 89.00,
            "due_date": due_date,
            "frequency": "monthly"
        }
        
        # Create
        create_response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
        assert create_response.status_code == 200
        created_bill = create_response.json()
        bill_id = created_bill["id"]
        
        # Get to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched_bill = get_response.json()
        assert fetched_bill["category"] == "Internet"
        assert fetched_bill["provider"] == "Aussie Broadband"
        assert fetched_bill["amount"] == 89.00
        print(f"✓ Bill created and verified: {bill_id}")
    
    def test_update_bill(self, auth_headers):
        """Test updating a bill"""
        # First create a bill
        due_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        bill_data = {
            "category": "Gas",
            "provider": "Origin Energy",
            "account_number": f"TEST_{uuid.uuid4().hex[:8]}",
            "amount": 120.00,
            "due_date": due_date,
            "frequency": "monthly"
        }
        create_response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
        bill_id = create_response.json()["id"]
        
        # Update the bill
        updated_data = {
            "category": "Gas",
            "provider": "Origin Energy",
            "account_number": bill_data["account_number"],
            "amount": 150.00,  # Updated amount
            "due_date": due_date,
            "frequency": "quarterly"  # Updated frequency
        }
        update_response = requests.put(f"{BASE_URL}/api/bills/{bill_id}", json=updated_data, headers=auth_headers)
        assert update_response.status_code == 200
        updated_bill = update_response.json()
        assert updated_bill["amount"] == 150.00
        assert updated_bill["frequency"] == "quarterly"
        print(f"✓ Bill updated: {bill_id}")
    
    def test_delete_bill(self, auth_headers):
        """Test deleting a bill"""
        # First create a bill
        due_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        bill_data = {
            "category": "Mobile",
            "provider": "Telstra",
            "account_number": f"TEST_DELETE_{uuid.uuid4().hex[:8]}",
            "amount": 65.00,
            "due_date": due_date,
            "frequency": "monthly"
        }
        create_response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
        bill_id = create_response.json()["id"]
        
        # Delete the bill
        delete_response = requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
        assert get_response.status_code == 404
        print(f"✓ Bill deleted and verified: {bill_id}")


class TestWalletTransactions:
    """Wallet and transaction tests"""
    
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
    
    def test_deposit_to_wallet(self, auth_headers):
        """Test depositing money to wallet"""
        response = requests.post(f"{BASE_URL}/api/transactions/deposit", 
            json={"amount": 100.00, "payment_method": "card"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "transaction" in data
        assert data["transaction"]["type"] == "deposit"
        assert data["transaction"]["amount"] == 100.00
        print("✓ Wallet deposit successful")
    
    def test_get_transactions(self, auth_headers):
        """Test fetching transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fetched {len(data)} transactions")
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "wallet_balance" in data
        assert "total_bills" in data
        assert "pending_bills" in data
        print(f"✓ Dashboard stats: balance=${data['wallet_balance']}, bills={data['total_bills']}")


class TestDirectDebit:
    """Direct Debit Request (DDR) tests"""
    
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
    
    def test_validate_bsb_valid(self, auth_headers):
        """Test BSB validation with valid BSB"""
        response = requests.post(f"{BASE_URL}/api/direct-debit/validate-bsb?bsb=062000")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["formatted"] == "062-000"
        print(f"✓ BSB validation: {data['formatted']} - {data.get('bank_name', 'Unknown')}")
    
    def test_validate_bsb_invalid(self, auth_headers):
        """Test BSB validation with invalid BSB"""
        response = requests.post(f"{BASE_URL}/api/direct-debit/validate-bsb?bsb=12345")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == False
        print("✓ Invalid BSB correctly rejected")
    
    def test_create_ddr_mandate(self, auth_headers):
        """Test creating a DDR mandate"""
        start_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        ddr_data = {
            "bank_name": "Commonwealth Bank",
            "bsb": "062-000",
            "account_number": "12345678",
            "account_holder_name": "Test User",
            "account_type": "savings",
            "provider": "AGL Energy",
            "provider_type": "Electricity",
            "provider_account_number": "ACC123456",
            "payment_frequency": "monthly",
            "max_payment_amount": 500.00,
            "start_date": start_date,
            "signature": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/direct-debit/create", json=ddr_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "mandate_reference" in data
        assert data["mandate_reference"].startswith("DDR-")
        assert data["status"] == "active"
        print(f"✓ DDR mandate created: {data['mandate_reference']}")
        return data["id"]
    
    def test_get_ddr_mandates(self, auth_headers):
        """Test fetching DDR mandates"""
        response = requests.get(f"{BASE_URL}/api/direct-debit/mandates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fetched {len(data)} DDR mandates")


class TestProviderConnections:
    """Provider connection tests"""
    
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
    
    def test_connect_provider(self, auth_headers):
        """Test connecting to a provider"""
        provider_data = {
            "provider_name": f"Test Provider {uuid.uuid4().hex[:6]}",
            "provider_type": "Electricity",
            "account_number": f"ACC_{uuid.uuid4().hex[:8]}"
        }
        response = requests.post(f"{BASE_URL}/api/provider/connect", json=provider_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert "id" in data
        print(f"✓ Provider connected: {data['provider_name']}")
        return data["id"]
    
    def test_get_provider_connections(self, auth_headers):
        """Test fetching provider connections"""
        response = requests.get(f"{BASE_URL}/api/provider/connections", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fetched {len(data)} provider connections")


class TestAccurassiOCR:
    """Accurassi/OCR bill extraction tests"""
    
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
    
    def test_accurassi_status(self, auth_headers):
        """Test Accurassi API status endpoint"""
        response = requests.get(f"{BASE_URL}/api/accurassi/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "ocr_available" in data
        assert data["ocr_available"] == True
        print(f"✓ Accurassi status: configured={data['configured']}, ocr={data['ocr_available']}")
    
    def test_bill_extract_endpoint_exists(self, auth_headers):
        """Test that bill extract endpoint exists (without actual file)"""
        # Just verify the endpoint exists and requires a file
        response = requests.post(f"{BASE_URL}/api/bills/extract", headers=auth_headers)
        # Should return 422 (validation error) because no file was provided
        assert response.status_code == 422
        print("✓ Bill extract endpoint exists and requires file upload")


class TestAdminEndpoints:
    """Admin panel endpoint tests"""
    
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
    
    @pytest.fixture
    def user_headers(self):
        """Get headers with regular user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("User authentication failed")
    
    def test_admin_login(self):
        """Test admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_USER_EMAIL,
            "password": ADMIN_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful: {ADMIN_USER_EMAIL}")
    
    def test_admin_stats(self, admin_headers):
        """Test admin statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_bills" in data
        assert "total_transactions" in data
        print(f"✓ Admin stats: users={data['total_users']}, bills={data['total_bills']}")
    
    def test_admin_stats_requires_admin(self, user_headers):
        """Test that admin stats requires admin role"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=user_headers)
        assert response.status_code == 403
        print("✓ Admin stats correctly requires admin role")
    
    def test_admin_bulk_payment_report_daily(self, admin_headers):
        """Test admin bulk payment report - daily"""
        response = requests.get(f"{BASE_URL}/api/admin/bulk-payment-report?report_type=daily", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "report_type" in data
        assert "total_bills" in data
        assert "total_amount" in data
        assert "providers_summary" in data
        print(f"✓ Daily report: {data['total_bills']} bills, ${data['total_amount']}")
    
    def test_admin_bulk_payment_report_monthly(self, admin_headers):
        """Test admin bulk payment report - monthly"""
        response = requests.get(f"{BASE_URL}/api/admin/bulk-payment-report?report_type=monthly", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["report_type"] == "monthly"
        print(f"✓ Monthly report: {data['total_bills']} bills, ${data['total_amount']}")
    
    def test_admin_bulk_payment_report_with_dates(self, admin_headers):
        """Test admin bulk payment report with custom date range"""
        start_date = "2025-01-01T00:00:00Z"
        end_date = "2027-12-31T23:59:59Z"
        response = requests.get(
            f"{BASE_URL}/api/admin/bulk-payment-report?start_date={start_date}&end_date={end_date}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_bills" in data
        print(f"✓ Custom date range report: {data['total_bills']} bills")
    
    def test_admin_users_list(self, admin_headers):
        """Test admin users list endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify password is not exposed
        for user in data:
            assert "password" not in user
        print(f"✓ Admin users list: {len(data)} users")


class TestOpenElectricityRemoved:
    """Verify OpenElectricity API endpoints are removed"""
    
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
    
    def test_no_electricity_endpoints(self, auth_headers):
        """Verify /api/electricity/* endpoints don't exist"""
        endpoints_to_check = [
            "/api/electricity/status",
            "/api/electricity/connect",
            "/api/electricity/bills"
        ]
        for endpoint in endpoints_to_check:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=auth_headers)
            # Should return 404 (not found) or 405 (method not allowed)
            assert response.status_code in [404, 405, 422], f"Endpoint {endpoint} should not exist"
        print("✓ OpenElectricity endpoints correctly removed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
