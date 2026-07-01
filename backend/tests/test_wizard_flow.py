from conftest import CUSTOMER, ADMIN, API_URL
"""
Iteration 16: Backend tests for BillSetupWizard flow.
Validates:
  - Customer/admin login
  - POST /api/bills (create bill via wizard step 2)
  - POST /api/payment-methods (bank_account: bank_name, no 500 from missing cols)
  - POST /api/payment-methods (debit_card: card_last4, card_brand)
  - POST /api/bills/extract (multipart file upload, PDF)
  - GET  /api/payment-plan/current and /calculate (wizard step 3)
  - GET  /api/payment-methods (wizard step 4)
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pay-manager-stage.preview.emergentagent.com").rstrip("/")


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "token" in data or "access_token" in data
    return data.get("token") or data.get("access_token"), data.get("user", {})


@pytest.fixture(scope="session")
def customer_token(session):
    tok, _ = _login(session, *CUSTOMER)
    return tok


@pytest.fixture(scope="session")
def admin_token(session):
    tok, _ = _login(session, *ADMIN)
    return tok


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- AUTH ----------
class TestAuth:
    def test_customer_login(self, session):
        tok, user = _login(session, *CUSTOMER)
        assert tok and isinstance(tok, str)
        assert user.get("email") == CUSTOMER[0]

    def test_admin_login(self, session):
        tok, user = _login(session, *ADMIN)
        assert tok and isinstance(tok, str)
        assert user.get("email") == ADMIN[0]
        assert user.get("role") == "admin" or user.get("is_admin") is True or user.get("email") == ADMIN[0]


# ---------- BILL EXTRACT (multipart) ----------
class TestBillExtract:
    def _make_pdf(self):
        # Minimal valid PDF bytes with text containing bill-like data
        try:
            from reportlab.pdfgen import canvas
            buf = io.BytesIO()
            c = canvas.Canvas(buf)
            c.drawString(100, 750, "AGL Energy")
            c.drawString(100, 730, "Account Number: 1234567890")
            c.drawString(100, 710, "Amount Due: $125.50")
            c.drawString(100, 690, "Due Date: 15/02/2026")
            c.drawString(100, 670, "Biller Code: 12345")
            c.save()
            return buf.getvalue()
        except Exception:
            # fallback: tiny pdf header (server should still respond, maybe 400)
            return b"%PDF-1.4\n%minimal\n"

    def test_extract_pdf_returns_data_or_400(self, customer_token):
        pdf_bytes = self._make_pdf()
        files = {"file": ("test_bill.pdf", pdf_bytes, "application/pdf")}
        headers = {"Authorization": f"Bearer {customer_token}"}
        r = requests.post(f"{BASE_URL}/api/bills/extract", files=files, headers=headers, timeout=90)
        # Either 200 with extracted fields, or 400 with detail (NOT 500)
        assert r.status_code in (200, 400), f"unexpected {r.status_code}: {r.text[:400]}"
        if r.status_code == 200:
            d = r.json()
            # Should have at least these keys (may be None)
            for k in ("provider", "amount", "due_date", "category", "account_number", "biller_code"):
                assert k in d, f"missing key {k} in response: {d}"

    def test_extract_no_file_returns_422(self, customer_token):
        headers = {"Authorization": f"Bearer {customer_token}"}
        r = requests.post(f"{BASE_URL}/api/bills/extract", headers=headers, timeout=20)
        assert r.status_code == 422


# ---------- BILLS CRUD ----------
class TestBillCRUD:
    created_bill_id = None

    def test_create_bill(self, session, customer_token):
        payload = {
            "category": "Electricity",
            "provider": "TEST_Wizard_Provider",
            "amount": 142.75,
            "due_date": "2026-03-15",
            "frequency": "monthly",
            "account_number": "TEST123",
        }
        r = session.post(f"{BASE_URL}/api/bills", json=payload, headers=_auth(customer_token), timeout=20)
        assert r.status_code in (200, 201), f"create bill failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        assert "id" in d
        assert d["provider"] == payload["provider"]
        assert float(d["amount"]) == 142.75
        TestBillCRUD.created_bill_id = d["id"]

    def test_get_bills_includes_created(self, session, customer_token):
        r = session.get(f"{BASE_URL}/api/bills", headers=_auth(customer_token), timeout=20)
        assert r.status_code == 200
        bills = r.json()
        assert isinstance(bills, list)
        if TestBillCRUD.created_bill_id:
            ids = [b.get("id") for b in bills]
            assert TestBillCRUD.created_bill_id in ids

    def test_delete_created_bill(self, session, customer_token):
        if not TestBillCRUD.created_bill_id:
            pytest.skip("no bill created")
        r = session.delete(
            f"{BASE_URL}/api/bills/{TestBillCRUD.created_bill_id}",
            headers=_auth(customer_token),
            timeout=20,
        )
        assert r.status_code in (200, 204)


# ---------- PAYMENT METHODS ----------
class TestPaymentMethods:
    created_method_ids = []

    def test_save_bank_account_no_500(self, session, customer_token):
        payload = {
            "type": "bank_account",
            "label": "TEST_Wizard_Bank",
            "bank_name": "Commonwealth Bank",
            "bsb": "062-000",
            "account_number": "12345678",
            "is_primary": False,
        }
        r = session.post(f"{BASE_URL}/api/payment-methods", json=payload, headers=_auth(customer_token), timeout=20)
        assert r.status_code in (200, 201), f"500 regression? {r.status_code} {r.text[:400]}"
        d = r.json()
        assert d.get("type") == "bank_account"
        assert d.get("bank_name") == "Commonwealth Bank"
        assert d.get("account_number_masked", "").endswith("5678")
        if "id" in d:
            TestPaymentMethods.created_method_ids.append(d["id"])

    def test_save_debit_card(self, session, customer_token):
        payload = {
            "type": "debit_card",
            "label": "TEST_Wizard_Card",
            "card_number": "4111111111111234",
            "card_brand": "Visa",
            "is_primary": False,
        }
        r = session.post(f"{BASE_URL}/api/payment-methods", json=payload, headers=_auth(customer_token), timeout=20)
        assert r.status_code in (200, 201), f"card save failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        assert d.get("card_last4") == "1234"
        assert d.get("card_brand") == "Visa"
        if "id" in d:
            TestPaymentMethods.created_method_ids.append(d["id"])

    def test_get_payment_methods(self, session, customer_token):
        r = session.get(f"{BASE_URL}/api/payment-methods", headers=_auth(customer_token), timeout=20)
        assert r.status_code == 200
        methods = r.json()
        assert isinstance(methods, list)
        # Verify our created methods are present
        labels = [m.get("label") for m in methods]
        if TestPaymentMethods.created_method_ids:
            assert "TEST_Wizard_Bank" in labels or "TEST_Wizard_Card" in labels

    def test_cleanup_methods(self, session, customer_token):
        for mid in TestPaymentMethods.created_method_ids:
            session.delete(f"{BASE_URL}/api/payment-methods/{mid}", headers=_auth(customer_token), timeout=15)


# ---------- PAYMENT PLAN (wizard step 3 deps) ----------
class TestPaymentPlan:
    def test_calc_plan(self, session, customer_token):
        r = session.get(f"{BASE_URL}/api/payment-plan/calculate", headers=_auth(customer_token), timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        # may return zeros if no outstanding bills, but keys should exist
        for k in ("weekly", "fortnightly", "monthly"):
            assert k in d

    def test_current_plan(self, session, customer_token):
        r = session.get(f"{BASE_URL}/api/payment-plan/current", headers=_auth(customer_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "status" in d  # 'none' or 'active' etc.


# ---------- ADMIN ----------
class TestAdmin:
    def test_admin_stats_accessible(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/stats", headers=_auth(admin_token), timeout=20)
        assert r.status_code == 200, f"admin stats: {r.status_code} {r.text[:300]}"
