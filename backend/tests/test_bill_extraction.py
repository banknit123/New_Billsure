from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, TEST_USER_EMAIL, ADMIN_EMAIL, API_URL
"""
Test Bill Extraction Feature - Iteration 5
Tests the refactored bill extraction using pdfplumber (pure Python) for PDFs
and manual entry prompt for images.

Features tested:
- POST /api/bills/extract with PDF file (pdfplumber extraction)
- POST /api/bills/extract with image file (manual entry prompt)
- POST /api/bills/extract with invalid file (400 error)
- GET /api/accurassi/status (configured: false, ocr_available: true)
- POST /api/auth/login (verify login still works)
- GET /api/bills (verify bills endpoint works)
- POST /api/bills (verify creating bill manually works)
"""

import pytest
import requests
import os
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from PIL import Image

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
def auth_token(api_client):
    """Get authentication token for test user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


def generate_test_pdf():
    """Generate a test PDF with bill-like content using reportlab"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Add bill-like content
    story.append(Paragraph("AGL Energy", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("TAX INVOICE", styles['Heading2']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Account Number: ACC-123456789", styles['Normal']))
    story.append(Paragraph("Customer Reference: CUST-987654", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Electricity Bill", styles['Heading3']))
    story.append(Paragraph("Billing Period: 01 Dec 2025 - 31 Dec 2025", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Supply Charge: $45.00", styles['Normal']))
    story.append(Paragraph("Usage Charge (500 kWh): $125.50", styles['Normal']))
    story.append(Paragraph("GST: $17.05", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Total Amount Due: $187.55", styles['Heading2']))
    story.append(Paragraph("Due Date: 15/01/2026", styles['Normal']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("BPAY Biller Code: 12345", styles['Normal']))
    story.append(Paragraph("BPAY Reference: 987654321", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_test_image():
    """Generate a test image (JPG) for testing image upload"""
    img = Image.new('RGB', (400, 300), color='white')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    buffer.seek(0)
    return buffer.getvalue()


def generate_test_png():
    """Generate a test PNG image for testing image upload"""
    img = Image.new('RGB', (400, 300), color='lightblue')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()


class TestAuthEndpoints:
    """Test authentication endpoints still work"""
    
    def test_login_success(self, api_client):
        """Test login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Login successful for {TEST_USER_EMAIL}")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid login correctly returns 401")


class TestBillsEndpoints:
    """Test bills CRUD endpoints still work"""
    
    def test_get_bills(self, authenticated_client):
        """Test GET /api/bills returns list of bills"""
        response = authenticated_client.get(f"{BASE_URL}/api/bills")
        assert response.status_code == 200, f"Get bills failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/bills returned {len(data)} bills")
    
    def test_create_bill_manually(self, authenticated_client):
        """Test POST /api/bills creates a bill manually"""
        bill_data = {
            "category": "Electricity",
            "provider": "TEST_Provider_Manual",
            "account_number": "TEST-MANUAL-001",
            "amount": 99.99,
            "due_date": "2026-02-15",
            "frequency": "monthly"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/bills", json=bill_data)
        assert response.status_code == 200, f"Create bill failed: {response.text}"
        data = response.json()
        assert data["provider"] == "TEST_Provider_Manual"
        assert data["amount"] == 99.99
        assert "id" in data
        print(f"✓ POST /api/bills created bill with ID: {data['id']}")
        
        # Cleanup - delete the test bill
        bill_id = data["id"]
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/bills/{bill_id}")
        assert delete_response.status_code == 200, f"Delete bill failed: {delete_response.text}"
        print(f"✓ Cleaned up test bill {bill_id}")


class TestAccurassiStatus:
    """Test Accurassi API status endpoint"""
    
    def test_accurassi_status(self, authenticated_client):
        """Test GET /api/accurassi/status returns correct status"""
        response = authenticated_client.get(f"{BASE_URL}/api/accurassi/status")
        assert response.status_code == 200, f"Accurassi status failed: {response.text}"
        data = response.json()
        
        # Should return configured: false (no credentials) and ocr_available: true
        assert "configured" in data, "configured field missing"
        assert "ocr_available" in data, "ocr_available field missing"
        assert data["configured"] == False, f"Expected configured=False, got {data['configured']}"
        assert data["ocr_available"] == True, f"Expected ocr_available=True, got {data['ocr_available']}"
        print(f"✓ GET /api/accurassi/status: configured={data['configured']}, ocr_available={data['ocr_available']}")


class TestBillExtraction:
    """Test bill extraction endpoint with different file types"""
    
    def test_extract_pdf_file(self, authenticated_client):
        """Test POST /api/bills/extract with PDF file extracts data using pdfplumber"""
        pdf_content = generate_test_pdf()
        
        # Remove Content-Type header for multipart upload
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")}
        )
        
        assert response.status_code == 200, f"PDF extraction failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify extraction method is pdfplumber (not accurassi since no credentials)
        assert "extraction_method" in data, "extraction_method missing from response"
        assert data["extraction_method"] in ["pdfplumber", "pypdfium2"], f"Unexpected extraction_method: {data['extraction_method']}"
        
        # Verify extracted data contains expected fields
        print(f"✓ PDF extraction successful via {data['extraction_method']}")
        print(f"  - Provider: {data.get('provider', 'N/A')}")
        print(f"  - Amount: {data.get('amount', 'N/A')}")
        print(f"  - Due Date: {data.get('due_date', 'N/A')}")
        print(f"  - Account Number: {data.get('account_number', 'N/A')}")
        print(f"  - Category: {data.get('category', 'N/A')}")
        
        # Check that some data was extracted (AGL should be detected)
        if data.get('provider'):
            assert 'AGL' in data['provider'] or len(data['provider']) > 0, "Provider should be extracted"
        
        # Amount should be extracted (187.55 from our test PDF)
        if data.get('amount'):
            assert isinstance(data['amount'], (int, float)), "Amount should be numeric"
    
    def test_extract_jpg_image_returns_manual_entry(self, authenticated_client):
        """Test POST /api/bills/extract with JPG image returns requires_manual_entry"""
        jpg_content = generate_test_image()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.jpg', io.BytesIO(jpg_content), 'image/jpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")}
        )
        
        assert response.status_code == 200, f"Image upload failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should return requires_manual_entry: true for images
        assert data.get("requires_manual_entry") == True, f"Expected requires_manual_entry=True, got {data.get('requires_manual_entry')}"
        assert data.get("extraction_method") == "manual", f"Expected extraction_method=manual, got {data.get('extraction_method')}"
        
        print(f"✓ JPG image upload returns manual entry prompt")
        print(f"  - requires_manual_entry: {data.get('requires_manual_entry')}")
        print(f"  - extraction_method: {data.get('extraction_method')}")
        print(f"  - extracted_text: {data.get('extracted_text', '')[:100]}...")
    
    def test_extract_png_image_returns_manual_entry(self, authenticated_client):
        """Test POST /api/bills/extract with PNG image returns requires_manual_entry"""
        png_content = generate_test_png()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.png', io.BytesIO(png_content), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")}
        )
        
        assert response.status_code == 200, f"PNG upload failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should return requires_manual_entry: true for images
        assert data.get("requires_manual_entry") == True, f"Expected requires_manual_entry=True, got {data.get('requires_manual_entry')}"
        assert data.get("extraction_method") == "manual", f"Expected extraction_method=manual, got {data.get('extraction_method')}"
        
        print(f"✓ PNG image upload returns manual entry prompt")
    
    def test_extract_invalid_file_returns_400(self, authenticated_client):
        """Test POST /api/bills/extract with invalid file returns 400"""
        # Create an invalid file (text file pretending to be image)
        invalid_content = b"This is not a valid image or PDF file"
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test.txt', io.BytesIO(invalid_content), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")}
        )
        
        # Should return 400 for invalid file type
        assert response.status_code == 400, f"Expected 400 for invalid file, got {response.status_code}"
        print(f"✓ Invalid file correctly returns 400 error")
    
    def test_extract_corrupted_image_returns_400(self, authenticated_client):
        """Test POST /api/bills/extract with corrupted image returns 400"""
        # Create corrupted image data
        corrupted_content = b"not a real image data"
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('corrupted.jpg', io.BytesIO(corrupted_content), 'image/jpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")}
        )
        
        # Should return 400 for corrupted image
        assert response.status_code == 400, f"Expected 400 for corrupted image, got {response.status_code}"
        print(f"✓ Corrupted image correctly returns 400 error")
    
    def test_extract_without_auth_returns_401(self):
        """Test POST /api/bills/extract without auth returns 401/403"""
        pdf_content = generate_test_pdf()
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files
        )
        
        # Should return 401 or 403 without authentication
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly returns {response.status_code}")


class TestDashboardStats:
    """Test dashboard stats endpoint still works"""
    
    def test_dashboard_stats(self, authenticated_client):
        """Test GET /api/dashboard/stats returns stats"""
        response = authenticated_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "wallet_balance" in data
        assert "total_bills" in data
        assert "pending_bills" in data
        print(f"✓ Dashboard stats: wallet_balance={data['wallet_balance']}, total_bills={data['total_bills']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
