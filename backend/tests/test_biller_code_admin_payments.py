from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, TEST_USER_EMAIL, ADMIN_EMAIL, API_URL
"""
Test Biller Code, Reference Number Extraction and Admin Payment Processing - Iteration 8

Features tested:
1. POST /api/bills/extract - PDF with Biller Code and Reference Number extraction
2. POST /api/bills - Creating bill with biller_code and reference_number fields
3. GET /api/bills - Returns bills with biller_code and reference_number fields
4. GET /api/admin/payment-queue - Returns all pending bills grouped by provider
5. POST /api/admin/pay-bill - Admin marks single bill as paid
6. POST /api/admin/pay-bills-bulk - Admin marks multiple bills as paid in bulk
"""

import pytest
import requests
import os
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

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
def customer_token(api_client):
    """Get authentication token for test customer"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Customer authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def customer_client(api_client, customer_token):
    """Session with customer auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {customer_token}"
    })
    return session


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


def generate_test_pdf_with_biller_code():
    """Generate a test PDF with Biller Code: 23456 and Ref: 901234567812"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Add bill-like content with specific biller code and reference
    story.append(Paragraph("Origin Energy", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("TAX INVOICE", styles['Heading2']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Account Number: ACC-TEST-789012", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Electricity Bill", styles['Heading3']))
    story.append(Paragraph("Billing Period: 01 Jan 2026 - 31 Jan 2026", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Supply Charge: $55.00", styles['Normal']))
    story.append(Paragraph("Usage Charge (600 kWh): $145.50", styles['Normal']))
    story.append(Paragraph("GST: $20.05", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Total Amount Due: $220.55", styles['Heading2']))
    story.append(Paragraph("Due Date: 28/02/2026", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("BPAY Payment Details:", styles['Heading3']))
    story.append(Paragraph("Biller Code: 23456", styles['Normal']))
    story.append(Paragraph("Ref: 901234567812", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


class TestBillExtractionWithBillerCode:
    """Test bill extraction extracts Biller Code and Reference Number"""
    
    def test_extract_pdf_with_biller_code_and_reference(self, customer_client, customer_token):
        """Test POST /api/bills/extract extracts biller_code and reference_number from PDF"""
        pdf_content = generate_test_pdf_with_biller_code()
        
        files = {
            'file': ('test_bill_bpay.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"PDF extraction failed: {response.status_code} - {response.text}"
        data = response.json()
        
        print(f"Extraction result: {data}")
        
        # Verify biller_code is extracted (should be 23456)
        assert "biller_code" in data, "biller_code field missing from extraction response"
        if data.get("biller_code"):
            print(f"✓ Biller Code extracted: {data['biller_code']}")
            assert data["biller_code"] == "23456", f"Expected biller_code=23456, got {data['biller_code']}"
        
        # Verify reference_number is extracted (should be 901234567812)
        assert "reference_number" in data, "reference_number field missing from extraction response"
        if data.get("reference_number"):
            print(f"✓ Reference Number extracted: {data['reference_number']}")
            assert data["reference_number"] == "901234567812", f"Expected reference_number=901234567812, got {data['reference_number']}"
        
        # Verify other fields
        print(f"  - Provider: {data.get('provider', 'N/A')}")
        print(f"  - Amount: {data.get('amount', 'N/A')}")
        print(f"  - Category: {data.get('category', 'N/A')}")


class TestBillCRUDWithBillerCode:
    """Test creating and retrieving bills with biller_code and reference_number"""
    
    created_bill_id = None
    
    def test_create_bill_with_biller_code_and_reference(self, customer_client):
        """Test POST /api/bills creates bill with biller_code and reference_number"""
        bill_data = {
            "category": "Electricity",
            "provider": "TEST_Origin_Energy",
            "account_number": "TEST-ACC-123456",
            "biller_code": "23456",
            "reference_number": "901234567812",
            "amount": 220.55,
            "due_date": "2026-02-28",
            "frequency": "quarterly"
        }
        
        response = customer_client.post(f"{BASE_URL}/api/bills", json=bill_data)
        assert response.status_code == 200, f"Create bill failed: {response.status_code} - {response.text}"
        
        data = response.json()
        TestBillCRUDWithBillerCode.created_bill_id = data["id"]
        
        # Verify biller_code and reference_number are saved
        assert data.get("biller_code") == "23456", f"biller_code not saved correctly: {data.get('biller_code')}"
        assert data.get("reference_number") == "901234567812", f"reference_number not saved correctly: {data.get('reference_number')}"
        
        print(f"✓ Created bill with ID: {data['id']}")
        print(f"  - Biller Code: {data.get('biller_code')}")
        print(f"  - Reference Number: {data.get('reference_number')}")
    
    def test_get_bills_returns_biller_code_and_reference(self, customer_client):
        """Test GET /api/bills returns bills with biller_code and reference_number"""
        response = customer_client.get(f"{BASE_URL}/api/bills")
        assert response.status_code == 200, f"Get bills failed: {response.text}"
        
        bills = response.json()
        assert isinstance(bills, list), "Response should be a list"
        
        # Find our test bill
        test_bill = next((b for b in bills if b.get("provider") == "TEST_Origin_Energy"), None)
        
        if test_bill:
            assert "biller_code" in test_bill, "biller_code field missing from bill"
            assert "reference_number" in test_bill, "reference_number field missing from bill"
            print(f"✓ GET /api/bills returns biller_code and reference_number")
            print(f"  - Bill ID: {test_bill['id']}")
            print(f"  - Biller Code: {test_bill.get('biller_code')}")
            print(f"  - Reference Number: {test_bill.get('reference_number')}")
        else:
            print("⚠ Test bill not found in response (may have been cleaned up)")


class TestAdminPaymentQueue:
    """Test admin payment queue endpoint"""
    
    def test_admin_payment_queue_returns_pending_bills(self, admin_client):
        """Test GET /api/admin/payment-queue returns pending bills with biller codes"""
        response = admin_client.get(f"{BASE_URL}/api/admin/payment-queue")
        assert response.status_code == 200, f"Payment queue failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "total_pending" in data, "total_pending field missing"
        assert "total_amount" in data, "total_amount field missing"
        assert "providers" in data, "providers field missing"
        assert "bills" in data, "bills field missing"
        
        print(f"✓ GET /api/admin/payment-queue successful")
        print(f"  - Total Pending: {data['total_pending']}")
        print(f"  - Total Amount: ${data['total_amount']:.2f}")
        print(f"  - Providers: {len(data['providers'])}")
        
        # Verify bills have biller_code and reference_number fields
        if data['bills']:
            sample_bill = data['bills'][0]
            assert "biller_code" in sample_bill, "biller_code missing from bill in queue"
            assert "reference_number" in sample_bill, "reference_number missing from bill in queue"
            assert "user_name" in sample_bill, "user_name missing from bill in queue"
            assert "user_email" in sample_bill, "user_email missing from bill in queue"
            print(f"  - Sample bill has biller_code: {sample_bill.get('biller_code')}")
            print(f"  - Sample bill has reference_number: {sample_bill.get('reference_number')}")
    
    def test_admin_payment_queue_groups_by_provider(self, admin_client):
        """Test payment queue groups bills by provider"""
        response = admin_client.get(f"{BASE_URL}/api/admin/payment-queue")
        assert response.status_code == 200
        
        data = response.json()
        
        if data['providers']:
            provider = data['providers'][0]
            assert "provider" in provider, "provider name missing"
            assert "total_amount" in provider, "total_amount missing from provider group"
            assert "bill_count" in provider, "bill_count missing from provider group"
            assert "bills" in provider, "bills list missing from provider group"
            
            print(f"✓ Provider grouping verified")
            print(f"  - Provider: {provider['provider']}")
            print(f"  - Bill Count: {provider['bill_count']}")
            print(f"  - Total Amount: ${provider['total_amount']:.2f}")


class TestAdminPayBill:
    """Test admin pay single bill endpoint"""
    
    test_bill_id = None
    
    @pytest.fixture(autouse=True)
    def setup_test_bill(self, customer_client, admin_client):
        """Create a test bill for payment testing"""
        bill_data = {
            "category": "Water",
            "provider": "TEST_Sydney_Water",
            "account_number": "TEST-WATER-001",
            "biller_code": "54321",
            "reference_number": "123456789012",
            "amount": 85.50,
            "due_date": "2026-03-15",
            "frequency": "quarterly"
        }
        
        response = customer_client.post(f"{BASE_URL}/api/bills", json=bill_data)
        if response.status_code == 200:
            TestAdminPayBill.test_bill_id = response.json()["id"]
            print(f"Created test bill: {TestAdminPayBill.test_bill_id}")
        yield
        # Cleanup handled in test or left for verification
    
    def test_admin_pay_single_bill(self, admin_client):
        """Test POST /api/admin/pay-bill marks bill as paid"""
        if not TestAdminPayBill.test_bill_id:
            pytest.skip("No test bill created")
        
        pay_data = {
            "bill_id": TestAdminPayBill.test_bill_id,
            "payment_reference": "BPAY-REF-12345"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/pay-bill", json=pay_data)
        assert response.status_code == 200, f"Pay bill failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "message" in data, "message missing from response"
        assert "bill_id" in data, "bill_id missing from response"
        
        print(f"✓ POST /api/admin/pay-bill successful")
        print(f"  - Message: {data['message']}")
        print(f"  - Bill ID: {data['bill_id']}")
    
    def test_admin_pay_already_paid_bill_returns_404(self, admin_client):
        """Test paying already paid bill returns 404"""
        if not TestAdminPayBill.test_bill_id:
            pytest.skip("No test bill created")
        
        pay_data = {
            "bill_id": TestAdminPayBill.test_bill_id,
            "payment_reference": "BPAY-REF-DUPLICATE"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/pay-bill", json=pay_data)
        # Should return 404 since bill is already paid
        assert response.status_code == 404, f"Expected 404 for already paid bill, got {response.status_code}"
        print(f"✓ Already paid bill correctly returns 404")


class TestAdminBulkPayment:
    """Test admin bulk payment endpoint"""
    
    test_bill_ids = []
    
    @pytest.fixture(autouse=True)
    def setup_test_bills(self, customer_client):
        """Create multiple test bills for bulk payment testing"""
        TestAdminBulkPayment.test_bill_ids = []
        
        for i in range(3):
            bill_data = {
                "category": "Gas",
                "provider": "TEST_AGL_Gas",
                "account_number": f"TEST-GAS-00{i+1}",
                "biller_code": "67890",
                "reference_number": f"BULK-REF-{i+1:03d}",
                "amount": 50.00 + (i * 10),
                "due_date": "2026-03-20",
                "frequency": "monthly"
            }
            
            response = customer_client.post(f"{BASE_URL}/api/bills", json=bill_data)
            if response.status_code == 200:
                TestAdminBulkPayment.test_bill_ids.append(response.json()["id"])
        
        print(f"Created {len(TestAdminBulkPayment.test_bill_ids)} test bills for bulk payment")
        yield
    
    def test_admin_bulk_pay_bills(self, admin_client):
        """Test POST /api/admin/pay-bills-bulk marks multiple bills as paid"""
        if len(TestAdminBulkPayment.test_bill_ids) < 2:
            pytest.skip("Not enough test bills created")
        
        bulk_data = {
            "bill_ids": TestAdminBulkPayment.test_bill_ids,
            "payment_reference": "BULK-BPAY-REF-001"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/pay-bills-bulk", json=bulk_data)
        assert response.status_code == 200, f"Bulk pay failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "message" in data, "message missing from response"
        assert "paid_count" in data, "paid_count missing from response"
        assert "total_amount" in data, "total_amount missing from response"
        
        print(f"✓ POST /api/admin/pay-bills-bulk successful")
        print(f"  - Message: {data['message']}")
        print(f"  - Paid Count: {data['paid_count']}")
        print(f"  - Total Amount: ${data['total_amount']:.2f}")
        
        # Verify paid_count matches number of bills
        assert data['paid_count'] == len(TestAdminBulkPayment.test_bill_ids), \
            f"Expected {len(TestAdminBulkPayment.test_bill_ids)} bills paid, got {data['paid_count']}"


class TestAdminAccessControl:
    """Test admin endpoints require admin access"""
    
    def test_payment_queue_requires_admin(self, customer_client):
        """Test GET /api/admin/payment-queue requires admin access"""
        response = customer_client.get(f"{BASE_URL}/api/admin/payment-queue")
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"✓ Payment queue correctly requires admin access (403)")
    
    def test_pay_bill_requires_admin(self, customer_client):
        """Test POST /api/admin/pay-bill requires admin access"""
        response = customer_client.post(f"{BASE_URL}/api/admin/pay-bill", json={
            "bill_id": "fake-id",
            "payment_reference": "test"
        })
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"✓ Pay bill correctly requires admin access (403)")
    
    def test_bulk_pay_requires_admin(self, customer_client):
        """Test POST /api/admin/pay-bills-bulk requires admin access"""
        response = customer_client.post(f"{BASE_URL}/api/admin/pay-bills-bulk", json={
            "bill_ids": ["fake-id"],
            "payment_reference": "test"
        })
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"✓ Bulk pay correctly requires admin access (403)")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bills(self, customer_client):
        """Delete all TEST_ prefixed bills"""
        response = customer_client.get(f"{BASE_URL}/api/bills")
        if response.status_code == 200:
            bills = response.json()
            test_bills = [b for b in bills if b.get("provider", "").startswith("TEST_")]
            
            for bill in test_bills:
                delete_response = customer_client.delete(f"{BASE_URL}/api/bills/{bill['id']}")
                if delete_response.status_code == 200:
                    print(f"  Deleted test bill: {bill['id']}")
            
            print(f"✓ Cleaned up {len(test_bills)} test bills")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
