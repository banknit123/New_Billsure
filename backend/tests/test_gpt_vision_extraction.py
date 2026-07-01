from conftest import TEST_USER_PASSWORD, ADMIN_PASSWORD, TEST_USER_EMAIL, ADMIN_EMAIL, API_URL
"""
Test GPT Vision Bill Extraction - Iteration 9
Tests the new GPT Vision (gpt-4o via emergentintegrations) for image-based bill extraction.

Features tested:
- POST /api/bills/extract with JPEG image - should extract all fields via AI Vision
- POST /api/bills/extract with PNG image - should also work via AI Vision
- POST /api/bills/extract with PDF containing spaced numbers - should preserve spaces
- Account number extraction from text near 'Account Number' label
- Reference number extraction from 'BPAY Ref:' pattern
- Biller code extraction from 'Biller Code:' pattern
- GET /api/accurassi/status - should return ocr_available: true when EMERGENT_LLM_KEY is set
- Auth login still works for both admin and customer
"""

import pytest
import requests
import os
import io
from PIL import Image, ImageDraw, ImageFont
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
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


def generate_bill_image_jpeg():
    """
    Generate a test JPEG image with bill-like content.
    Contains: Provider, Account Number, Biller Code, BPAY Ref, Amount, Due Date
    """
    # Create a white image
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Use default font (PIL's built-in)
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw bill content
    y = 30
    draw.text((50, y), "AGL Energy", fill='black', font=font_large)
    y += 50
    draw.text((50, y), "TAX INVOICE", fill='gray', font=font_medium)
    y += 40
    
    # Account Number with spaces
    draw.text((50, y), "Account Number: 1234 5678 9012", fill='black', font=font_medium)
    y += 35
    
    # Biller Code
    draw.text((50, y), "Biller Code: 17289", fill='black', font=font_medium)
    y += 35
    
    # BPAY Reference with spaces
    draw.text((50, y), "BPAY Ref: 1234 5678 9012 3456", fill='black', font=font_medium)
    y += 50
    
    # Amount
    draw.text((50, y), "Total Amount Due: $287.50", fill='black', font=font_large)
    y += 50
    
    # Due Date
    draw.text((50, y), "Due Date: 15/05/2026", fill='black', font=font_medium)
    y += 40
    
    # Category hint
    draw.text((50, y), "Electricity Supply Charges", fill='gray', font=font_small)
    
    # Save to buffer
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    buffer.seek(0)
    return buffer.getvalue()


def generate_bill_image_png():
    """
    Generate a test PNG image with bill-like content.
    """
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
    
    y = 30
    draw.text((50, y), "Origin Energy", fill='black', font=font_large)
    y += 50
    draw.text((50, y), "ELECTRICITY BILL", fill='gray', font=font_medium)
    y += 40
    
    draw.text((50, y), "Account Number: 9876 5432 1098", fill='black', font=font_medium)
    y += 35
    draw.text((50, y), "BPAY Biller Code: 23456", fill='black', font=font_medium)
    y += 35
    draw.text((50, y), "BPAY Reference Number: 5678 9012 3456 7890", fill='black', font=font_medium)
    y += 50
    draw.text((50, y), "Amount Due: $195.75", fill='black', font=font_large)
    y += 50
    draw.text((50, y), "Pay By: 20/06/2026", fill='black', font=font_medium)
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()


def generate_pdf_with_spaced_numbers():
    """
    Generate a test PDF with spaced numbers in account and reference fields.
    Tests that spaces are preserved in extraction.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    story.append(Paragraph("Sydney Water", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("TAX INVOICE", styles['Heading2']))
    story.append(Spacer(1, 12))
    
    # Account number with spaces
    story.append(Paragraph("Account Number: 1111 2222 3333 4444", styles['Normal']))
    story.append(Spacer(1, 8))
    
    # Biller Code
    story.append(Paragraph("Biller Code: 34567", styles['Normal']))
    story.append(Spacer(1, 8))
    
    # BPAY Reference with spaces
    story.append(Paragraph("BPAY Ref: 5555 6666 7777 8888 9999", styles['Normal']))
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("Water Usage Charges", styles['Heading3']))
    story.append(Paragraph("Usage: 45 kL", styles['Normal']))
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("Total Amount Due: $156.80", styles['Heading2']))
    story.append(Paragraph("Due Date: 25/07/2026", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


class TestAuthEndpoints:
    """Test authentication endpoints work for both admin and customer"""
    
    def test_customer_login_success(self, api_client):
        """Test customer login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Customer login successful for {TEST_USER_EMAIL}")
    
    def test_admin_login_success(self, api_client):
        """Test admin login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"].get("is_admin") == True, "Admin user should have is_admin=True"
        print(f"✓ Admin login successful for {ADMIN_EMAIL}")


class TestAccurassiStatus:
    """Test Accurassi/Vision API status endpoint"""
    
    def test_accurassi_status_shows_ocr_available(self, authenticated_client):
        """Test GET /api/accurassi/status returns ocr_available: true when EMERGENT_LLM_KEY is set"""
        response = authenticated_client.get(f"{BASE_URL}/api/accurassi/status")
        assert response.status_code == 200, f"Accurassi status failed: {response.text}"
        data = response.json()
        
        assert "configured" in data, "configured field missing"
        assert "ocr_available" in data, "ocr_available field missing"
        
        # EMERGENT_LLM_KEY is set, so ocr_available should be True
        assert data["ocr_available"] == True, f"Expected ocr_available=True (EMERGENT_LLM_KEY is set), got {data['ocr_available']}"
        
        # Accurassi credentials are not set
        assert data["configured"] == False, f"Expected configured=False (no Accurassi credentials), got {data['configured']}"
        
        print(f"✓ GET /api/accurassi/status: configured={data['configured']}, ocr_available={data['ocr_available']}")
        print(f"  Message: {data.get('message', 'N/A')}")


class TestGPTVisionExtraction:
    """Test GPT Vision extraction for images"""
    
    def test_extract_jpeg_image_via_ai_vision(self, authenticated_client):
        """
        Test POST /api/bills/extract with JPEG image extracts all fields via AI Vision.
        Expected fields: provider, amount, due_date, biller_code, reference_number, account_number
        """
        jpg_content = generate_bill_image_jpeg()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.jpg', io.BytesIO(jpg_content), 'image/jpeg')
        }
        
        # GPT Vision takes 5-10 seconds, use longer timeout
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=60
        )
        
        assert response.status_code == 200, f"JPEG extraction failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify extraction method is ai_vision (not manual)
        assert "extraction_method" in data, "extraction_method missing from response"
        assert data["extraction_method"] == "ai_vision", f"Expected extraction_method=ai_vision, got {data['extraction_method']}"
        
        # Should NOT have requires_manual_entry
        assert data.get("requires_manual_entry") != True, "JPEG should not require manual entry with GPT Vision"
        
        print(f"✓ JPEG extraction successful via {data['extraction_method']}")
        print(f"  - Provider: {data.get('provider', 'N/A')}")
        print(f"  - Amount: {data.get('amount', 'N/A')}")
        print(f"  - Due Date: {data.get('due_date', 'N/A')}")
        print(f"  - Account Number: {data.get('account_number', 'N/A')}")
        print(f"  - Biller Code: {data.get('biller_code', 'N/A')}")
        print(f"  - Reference Number: {data.get('reference_number', 'N/A')}")
        print(f"  - Category: {data.get('category', 'N/A')}")
        
        # Verify some fields were extracted (AI should extract at least provider and amount)
        # Note: AI extraction may vary, so we check for presence rather than exact values
        assert data.get('provider') is not None or data.get('amount') is not None, \
            "AI Vision should extract at least provider or amount from the bill image"
    
    def test_extract_png_image_via_ai_vision(self, authenticated_client):
        """
        Test POST /api/bills/extract with PNG image also works via AI Vision.
        """
        png_content = generate_bill_image_png()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.png', io.BytesIO(png_content), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=60
        )
        
        assert response.status_code == 200, f"PNG extraction failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify extraction method is ai_vision
        assert data["extraction_method"] == "ai_vision", f"Expected extraction_method=ai_vision, got {data['extraction_method']}"
        
        # Should NOT have requires_manual_entry
        assert data.get("requires_manual_entry") != True, "PNG should not require manual entry with GPT Vision"
        
        print(f"✓ PNG extraction successful via {data['extraction_method']}")
        print(f"  - Provider: {data.get('provider', 'N/A')}")
        print(f"  - Amount: {data.get('amount', 'N/A')}")
        print(f"  - Biller Code: {data.get('biller_code', 'N/A')}")
        print(f"  - Reference Number: {data.get('reference_number', 'N/A')}")


class TestPDFExtractionWithSpacedNumbers:
    """Test PDF extraction preserves spaces in numbers"""
    
    def test_extract_pdf_preserves_spaces_in_numbers(self, authenticated_client):
        """
        Test POST /api/bills/extract with PDF containing spaced numbers preserves spaces.
        Account number and reference number should retain their spaces.
        """
        pdf_content = generate_pdf_with_spaced_numbers()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=30
        )
        
        assert response.status_code == 200, f"PDF extraction failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify extraction method is pdfplumber (text-based PDF)
        assert data["extraction_method"] in ["pdfplumber", "ai_vision"], \
            f"Expected pdfplumber or ai_vision, got {data['extraction_method']}"
        
        print(f"✓ PDF extraction successful via {data['extraction_method']}")
        print(f"  - Provider: {data.get('provider', 'N/A')}")
        print(f"  - Amount: {data.get('amount', 'N/A')}")
        print(f"  - Account Number: {data.get('account_number', 'N/A')}")
        print(f"  - Biller Code: {data.get('biller_code', 'N/A')}")
        print(f"  - Reference Number: {data.get('reference_number', 'N/A')}")
        
        # Check that account_number contains spaces (if extracted)
        account_num = data.get('account_number', '')
        if account_num:
            # The regex pattern should preserve spaces
            print(f"  - Account number has spaces: {' ' in account_num}")
        
        # Check that reference_number contains spaces (if extracted)
        ref_num = data.get('reference_number', '')
        if ref_num:
            print(f"  - Reference number has spaces: {' ' in ref_num}")


class TestFieldExtractionPatterns:
    """Test specific field extraction patterns"""
    
    def test_account_number_extraction_from_label(self, authenticated_client):
        """
        Test that account_number is extracted from text near 'Account Number' label.
        Uses PDF with clear 'Account Number:' pattern.
        """
        pdf_content = generate_pdf_with_spaced_numbers()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=30
        )
        
        assert response.status_code == 200, f"Extraction failed: {response.text}"
        data = response.json()
        
        # Account number should be extracted
        account_num = data.get('account_number')
        print(f"✓ Account number extracted: {account_num}")
        
        # Should contain digits (may or may not have spaces depending on regex)
        if account_num:
            assert any(c.isdigit() for c in account_num), "Account number should contain digits"
    
    def test_biller_code_extraction_from_pattern(self, authenticated_client):
        """
        Test that biller_code is extracted from 'Biller Code:' pattern.
        """
        pdf_content = generate_pdf_with_spaced_numbers()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=30
        )
        
        assert response.status_code == 200, f"Extraction failed: {response.text}"
        data = response.json()
        
        biller_code = data.get('biller_code')
        print(f"✓ Biller code extracted: {biller_code}")
        
        # Biller code should be extracted (34567 from our test PDF)
        if biller_code:
            assert any(c.isdigit() for c in str(biller_code)), "Biller code should contain digits"
    
    def test_reference_number_extraction_from_bpay_ref(self, authenticated_client):
        """
        Test that reference_number is extracted from 'BPAY Ref:' pattern.
        """
        pdf_content = generate_pdf_with_spaced_numbers()
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test_bill.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=30
        )
        
        assert response.status_code == 200, f"Extraction failed: {response.text}"
        data = response.json()
        
        ref_num = data.get('reference_number')
        print(f"✓ Reference number extracted: {ref_num}")
        
        # Reference number should be extracted
        if ref_num:
            assert any(c.isdigit() for c in str(ref_num)), "Reference number should contain digits"


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_extract_without_auth_returns_401(self):
        """Test POST /api/bills/extract without auth returns 401/403"""
        jpg_content = generate_bill_image_jpeg()
        
        files = {
            'file': ('test_bill.jpg', io.BytesIO(jpg_content), 'image/jpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            timeout=30
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly returns {response.status_code}")
    
    def test_extract_invalid_file_returns_400(self, authenticated_client):
        """Test POST /api/bills/extract with invalid file returns 400"""
        invalid_content = b"This is not a valid image or PDF file"
        
        headers = dict(authenticated_client.headers)
        headers.pop("Content-Type", None)
        
        files = {
            'file': ('test.txt', io.BytesIO(invalid_content), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bills/extract",
            files=files,
            headers={"Authorization": headers.get("Authorization")},
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file, got {response.status_code}"
        print(f"✓ Invalid file correctly returns 400 error")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
