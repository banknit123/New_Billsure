from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, TEST_USER_EMAIL, ADMIN_EMAIL, API_URL
"""
Test suite for Iteration 6: Encryption at Rest & BECS Direct Debit Integration
Tests:
- Bank details encryption (POST/GET /api/bank-details)
- Direct Debit mandate encryption (POST/GET /api/direct-debit/*)
- Payment methods encryption (POST/GET /api/payment-methods)
- Stripe checkout with card and BECS payment types
- PCI compliance status endpoint (admin only)
- Data migration endpoint (admin only)
- MongoDB encryption verification
"""
import pytest
import requests
import os
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@billseasypay.com"
# Loaded from conftest
ADMIN_EMAIL = "admin@billseasypay.com"
# Loaded from conftest


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def user_token(api_client):
    """Get regular user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"User authentication failed: {response.text}")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, user_token):
    """Session with user auth header"""
    api_client.headers.update({"Authorization": f"Bearer {user_token}"})
    return api_client


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture(scope="module")
def mongo_client():
    """Direct MongoDB connection for encryption verification"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    client = MongoClient(mongo_url)
    return client[db_name]


class TestBankDetailsEncryption:
    """Test bank details encryption at rest"""
    
    created_bank_id = None
    
    def test_create_bank_details_returns_masked(self, authenticated_client):
        """POST /api/bank-details should return masked account/routing numbers"""
        payload = {
            "account_holder_name": "TEST_Encryption User",
            "bank_name": "Commonwealth Bank",
            "account_number": "123456789012",
            "routing_number": "062000",
            "account_type": "checking"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/bank-details", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify masked values returned (****XXXX format)
        assert data["account_number"] == "****9012", f"Expected masked account ****9012, got {data['account_number']}"
        assert data["routing_number"] == "****0000" or data["routing_number"] == "****2000", f"Expected masked routing, got {data['routing_number']}"
        assert data["account_holder_name"] == "TEST_Encryption User"
        assert "id" in data
        
        TestBankDetailsEncryption.created_bank_id = data["id"]
        print(f"Created bank details with ID: {data['id']}, masked account: {data['account_number']}")
    
    def test_get_bank_details_returns_masked(self, authenticated_client):
        """GET /api/bank-details should return masked values, never raw or encrypted"""
        response = authenticated_client.get(f"{BASE_URL}/api/bank-details")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected list of bank accounts"
        
        # Find our test account
        test_account = next((a for a in data if a.get("account_holder_name") == "TEST_Encryption User"), None)
        if test_account:
            # Verify masked format
            assert test_account["account_number"].startswith("****"), f"Account should be masked: {test_account['account_number']}"
            assert test_account["routing_number"].startswith("****"), f"Routing should be masked: {test_account['routing_number']}"
            # Verify NOT encrypted (no gAAAAAB prefix)
            assert not test_account["account_number"].startswith("gAAAAAB"), "Should not return encrypted value"
            print(f"GET bank details returns masked: {test_account['account_number']}")
    
    def test_mongodb_stores_encrypted_values(self, mongo_client):
        """Verify MongoDB actually stores encrypted values (gAAAAAB prefix)"""
        bank_doc = mongo_client.bank_details.find_one({"account_holder_name": "TEST_Encryption User"})
        
        if bank_doc:
            acct = bank_doc.get("account_number", "")
            rout = bank_doc.get("routing_number", "")
            
            # Fernet encrypted values start with 'gAAAAAB'
            assert acct.startswith("gAAAAAB"), f"MongoDB account_number should be encrypted (gAAAAAB prefix), got: {acct[:20]}..."
            assert rout.startswith("gAAAAAB"), f"MongoDB routing_number should be encrypted (gAAAAAB prefix), got: {rout[:20]}..."
            print(f"MongoDB stores encrypted: account={acct[:30]}..., routing={rout[:30]}...")
        else:
            pytest.skip("Test bank account not found in MongoDB")


class TestDirectDebitEncryption:
    """Test Direct Debit Request (DDR) encryption"""
    
    created_mandate_id = None
    
    def test_create_ddr_returns_masked(self, authenticated_client):
        """POST /api/direct-debit/create should encrypt and return masked values"""
        payload = {
            "bank_name": "ANZ",
            "bsb": "012345",
            "account_number": "987654321",
            "account_holder_name": "TEST_DDR User",
            "account_type": "savings",
            "provider": "AGL Energy",
            "provider_type": "Electricity",
            "provider_account_number": "ACC123456",
            "payment_frequency": "monthly",
            "max_payment_amount": 500.00,
            "start_date": "2026-02-01",
            "signature": "TEST_DDR User"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/direct-debit/create", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify masked values
        assert data["bsb"] == "012-***", f"Expected BSB 012-***, got {data['bsb']}"
        assert data["account_number"] == "****4321", f"Expected masked account ****4321, got {data['account_number']}"
        assert data["provider_account_number"] == "****3456", f"Expected masked provider account, got {data['provider_account_number']}"
        assert "mandate_reference" in data
        assert data["mandate_reference"].startswith("DDR-")
        
        TestDirectDebitEncryption.created_mandate_id = data["id"]
        print(f"Created DDR mandate: {data['mandate_reference']}, masked BSB: {data['bsb']}")
    
    def test_get_ddr_mandates_returns_masked(self, authenticated_client):
        """GET /api/direct-debit/mandates should return masked sensitive fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/direct-debit/mandates")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected list of mandates"
        
        # Find our test mandate
        test_mandate = next((m for m in data if m.get("account_holder_name") == "TEST_DDR User"), None)
        if test_mandate:
            # Verify masked format
            assert "-***" in test_mandate["bsb"], f"BSB should be masked: {test_mandate['bsb']}"
            assert test_mandate["account_number"].startswith("****"), f"Account should be masked: {test_mandate['account_number']}"
            assert test_mandate["provider_account_number"].startswith("****"), f"Provider account should be masked"
            print(f"GET DDR mandates returns masked: BSB={test_mandate['bsb']}, account={test_mandate['account_number']}")
    
    def test_mongodb_stores_encrypted_ddr(self, mongo_client):
        """Verify MongoDB stores encrypted DDR data"""
        ddr_doc = mongo_client.direct_debit_requests.find_one({"account_holder_name": "TEST_DDR User"})
        
        if ddr_doc:
            bsb = ddr_doc.get("bsb", "")
            acct = ddr_doc.get("account_number", "")
            prov_acct = ddr_doc.get("provider_account_number", "")
            
            assert bsb.startswith("gAAAAAB"), f"MongoDB BSB should be encrypted, got: {bsb[:20]}..."
            assert acct.startswith("gAAAAAB"), f"MongoDB account_number should be encrypted, got: {acct[:20]}..."
            assert prov_acct.startswith("gAAAAAB"), f"MongoDB provider_account_number should be encrypted, got: {prov_acct[:20]}..."
            print(f"MongoDB DDR encrypted: bsb={bsb[:30]}...")
        else:
            pytest.skip("Test DDR mandate not found in MongoDB")


class TestPaymentMethodsEncryption:
    """Test payment methods encryption (BSB for bank accounts, no raw card storage)"""
    
    created_pm_id = None
    
    def test_create_bank_payment_method_encrypts_bsb(self, authenticated_client):
        """POST /api/payment-methods with bank_account type should encrypt BSB"""
        payload = {
            "type": "bank_account",
            "label": "TEST_Bank Account",
            "bank_name": "Westpac",
            "bsb": "033-456",
            "account_number": "112233445566",
            "is_primary": False
        }
        response = authenticated_client.post(f"{BASE_URL}/api/payment-methods", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify BSB is masked (XXX-***)
        assert data["bsb"] == "033-***", f"Expected masked BSB 033-***, got {data['bsb']}"
        assert data["account_number_masked"] == "****5566", f"Expected masked account, got {data['account_number_masked']}"
        assert data["type"] == "bank_account"
        
        TestPaymentMethodsEncryption.created_pm_id = data["id"]
        print(f"Created payment method: {data['label']}, masked BSB: {data['bsb']}")
    
    def test_create_card_payment_method_no_raw_storage(self, authenticated_client):
        """POST /api/payment-methods with card should only store last 4 digits"""
        payload = {
            "type": "credit_card",
            "label": "TEST_Visa Card",
            "card_number": "4111111111111111",
            "card_brand": "Visa",
            "is_primary": False
        }
        response = authenticated_client.post(f"{BASE_URL}/api/payment-methods", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify only last 4 digits stored
        assert data["card_last4"] == "1111", f"Expected card_last4=1111, got {data['card_last4']}"
        assert data["card_brand"] == "Visa"
        # Verify no full card number in response
        assert "card_number" not in data or data.get("card_number") is None
        print(f"Created card payment method: {data['label']}, last4: {data['card_last4']}")
    
    def test_get_payment_methods_returns_masked(self, authenticated_client):
        """GET /api/payment-methods should return masked BSB values"""
        response = authenticated_client.get(f"{BASE_URL}/api/payment-methods")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected list of payment methods"
        
        # Find our test bank account
        test_pm = next((m for m in data if m.get("label") == "TEST_Bank Account"), None)
        if test_pm:
            assert "-***" in test_pm["bsb"], f"BSB should be masked: {test_pm['bsb']}"
            print(f"GET payment methods returns masked BSB: {test_pm['bsb']}")
    
    def test_mongodb_stores_encrypted_bsb(self, mongo_client):
        """Verify MongoDB stores encrypted BSB for payment methods"""
        pm_doc = mongo_client.payment_methods.find_one({"label": "TEST_Bank Account"})
        
        if pm_doc:
            bsb = pm_doc.get("bsb", "")
            if bsb:
                assert bsb.startswith("gAAAAAB"), f"MongoDB BSB should be encrypted, got: {bsb[:20]}..."
                print(f"MongoDB payment method BSB encrypted: {bsb[:30]}...")
        else:
            pytest.skip("Test payment method not found in MongoDB")
    
    def test_mongodb_no_raw_card_number(self, mongo_client):
        """Verify MongoDB does NOT store raw card numbers"""
        pm_doc = mongo_client.payment_methods.find_one({"label": "TEST_Visa Card"})
        
        if pm_doc:
            # Should only have card_last4, not full card_number
            assert pm_doc.get("card_last4") == "1111"
            # card_number field should be None or not exist
            card_num = pm_doc.get("card_number")
            assert card_num is None or card_num == "", f"Raw card number should not be stored, got: {card_num}"
            print("MongoDB correctly stores only card_last4, no raw card number")
        else:
            pytest.skip("Test card payment method not found in MongoDB")


class TestStripeCheckout:
    """Test Stripe checkout with card and BECS payment types"""
    
    def test_checkout_with_card_succeeds(self, authenticated_client):
        """POST /api/payments/create-checkout with card should create session"""
        # First ensure user has an active payment plan
        authenticated_client.post(f"{BASE_URL}/api/payment-plan/select?frequency=monthly")
        
        payload = {
            "package_id": "small",
            "origin_url": "https://pay-manager-stage.preview.emergentagent.com",
            "payment_method_type": "card"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/payments/create-checkout", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "url" in data, "Response should contain checkout URL"
        assert "session_id" in data, "Response should contain session_id"
        assert data["url"].startswith("https://"), "URL should be HTTPS"
        print(f"Card checkout session created: {data['session_id'][:20]}...")
    
    def test_checkout_with_becs_returns_clear_error(self, authenticated_client):
        """POST /api/payments/create-checkout with au_becs_debit should return clear error"""
        payload = {
            "package_id": "small",
            "origin_url": "https://pay-manager-stage.preview.emergentagent.com",
            "payment_method_type": "au_becs_debit"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/payments/create-checkout", json=payload)
        
        # Should return 400 with clear error about BECS not enabled
        assert response.status_code == 400, f"Expected 400 for BECS, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "detail" in data
        assert "BECS" in data["detail"], f"Error should mention BECS: {data['detail']}"
        assert "not" in data["detail"].lower() and "enabled" in data["detail"].lower(), f"Error should say BECS not enabled: {data['detail']}"
        print(f"BECS checkout correctly returns error: {data['detail'][:80]}...")


class TestComplianceEndpoints:
    """Test PCI compliance status and data migration endpoints (admin only)"""
    
    def test_compliance_status_admin_only(self, authenticated_client, admin_client):
        """GET /api/security/compliance-status should require admin"""
        # Regular user should get 403
        response = authenticated_client.get(f"{BASE_URL}/api/security/compliance-status")
        assert response.status_code == 403, f"Regular user should get 403, got {response.status_code}"
        
        # Admin should get 200
        response = admin_client.get(f"{BASE_URL}/api/security/compliance-status")
        assert response.status_code == 200, f"Admin should get 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["encryption_at_rest"] == True, "Encryption should be active"
        assert "AES" in data["encryption_algorithm"], f"Should use AES encryption: {data['encryption_algorithm']}"
        assert data["bank_details_encrypted"] == True
        assert data["ddr_data_encrypted"] == True
        assert "sensitive_fields_encrypted" in data
        assert len(data["sensitive_fields_encrypted"]) > 0
        print(f"Compliance status: encryption={data['encryption_at_rest']}, algorithm={data['encryption_algorithm']}")
    
    def test_encrypt_existing_data_admin_only(self, authenticated_client, admin_client):
        """POST /api/admin/encrypt-existing-data should require admin"""
        # Regular user should get 403
        response = authenticated_client.post(f"{BASE_URL}/api/admin/encrypt-existing-data")
        assert response.status_code == 403, f"Regular user should get 403, got {response.status_code}"
        
        # Admin should get 200
        response = admin_client.post(f"{BASE_URL}/api/admin/encrypt-existing-data")
        assert response.status_code == 200, f"Admin should get 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "migrated_records" in data
        assert "bank_details" in data["migrated_records"]
        assert "ddr_mandates" in data["migrated_records"]
        assert "payment_methods" in data["migrated_records"]
        print(f"Data migration result: {data['migrated_records']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, authenticated_client, mongo_client):
        """Delete test-created data"""
        # Delete test bank details
        if TestBankDetailsEncryption.created_bank_id:
            authenticated_client.delete(f"{BASE_URL}/api/bank-details/{TestBankDetailsEncryption.created_bank_id}")
        
        # Delete test DDR mandate
        if TestDirectDebitEncryption.created_mandate_id:
            authenticated_client.put(f"{BASE_URL}/api/direct-debit/mandate/{TestDirectDebitEncryption.created_mandate_id}/cancel")
        
        # Delete test payment methods
        if TestPaymentMethodsEncryption.created_pm_id:
            authenticated_client.delete(f"{BASE_URL}/api/payment-methods/{TestPaymentMethodsEncryption.created_pm_id}")
        
        # Direct MongoDB cleanup for TEST_ prefixed data
        mongo_client.bank_details.delete_many({"account_holder_name": {"$regex": "^TEST_"}})
        mongo_client.direct_debit_requests.delete_many({"account_holder_name": {"$regex": "^TEST_"}})
        mongo_client.payment_methods.delete_many({"label": {"$regex": "^TEST_"}})
        
        print("Test data cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
