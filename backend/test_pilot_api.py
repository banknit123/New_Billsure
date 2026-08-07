"""
HTTP-layer test for pilot_api.py, using FastAPI's TestClient (real
HTTP request/response cycle through Starlette's ASGI transport, not a
direct Python function call) — this is the first test in this
workstream that actually exercises the FastAPI routing, request
validation, and status-code mapping layer, not just the underlying
modules directly.

Same in-memory fake supabase_db pattern as every other test_*.py file
in this repo — no live database, no live network. What's different
here versus test_end_to_end_dummy_customer_journey.py is the boundary
being tested: this proves the HTTP plumbing (routes, Pydantic request
models, error-to-status-code mapping) is correct, not just that the
underlying Python functions compose correctly.

Run: python3 test_pilot_api.py
"""
import asyncio
import io
import sys
import types
import uuid
from decimal import Decimal
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

# ---- in-memory fake of supabase_db's public interface ----
_tables = {}


def _matches(row, filters):
    for k, v in filters.items():
        if row.get(k) != v:
            return False
    return True


async def find_one(table, filters, exclude_fields=None):
    for row in _tables.get(table, []):
        if _matches(row, filters):
            return dict(row)
    return None


async def find_many(table, filters=None, exclude_fields=None, limit=10000):
    filters = filters or {}
    return [dict(r) for r in _tables.get(table, []) if _matches(r, filters)][:limit]


async def insert_one(table, data):
    row = dict(data)
    row.setdefault("id", str(uuid.uuid4()))
    _tables.setdefault(table, []).append(row)
    return dict(row)


async def insert_many(table, rows):
    return [await insert_one(table, r) for r in rows]


async def update_one(table, filters, updates):
    for row in _tables.get(table, []):
        if _matches(row, filters):
            row.update(updates)
            return True
    return False


async def update_many(table, filters, updates):
    n = 0
    for row in _tables.get(table, []):
        if _matches(row, filters):
            row.update(updates)
            n += 1
    return n


fake_sdb = types.SimpleNamespace(
    find_one=find_one, find_many=find_many, insert_one=insert_one,
    insert_many=insert_many, update_one=update_one, update_many=update_many,
)
sys.modules["supabase_db"] = fake_sdb

import pilot_config as pc   # noqa: E402

FAILURES = []


def check(label, condition):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}")
    if not condition:
        FAILURES.append(label)


def make_bill_photo(biller_name, account_name, reference, amount, due_date) -> bytes:
    img = Image.new("RGB", (900, 500), color="white")
    draw = ImageDraw.Draw(img)
    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except Exception:
        font_big = ImageFont.load_default()
        font_small = font_big
    draw.text((30, 30), biller_name, fill="black", font=font_big)
    draw.text((30, 100), f"Account Name: {account_name}", fill="black", font=font_small)
    draw.text((30, 150), f"Reference Number: {reference}", fill="black", font=font_small)
    draw.text((30, 200), f"Amount Due: ${amount}", fill="black", font=font_small)
    draw.text((30, 250), f"Due Date: {due_date}", fill="black", font=font_small)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def main():
    await pc.propose_config_version(pc.PilotConfig(), proposed_by="ops_lead", approved_by="compliance_lead", activate=True)

    import pilot_api  # noqa: E402  -- imported AFTER supabase_db is faked and config is active
    from fastapi.testclient import TestClient
    client = TestClient(pilot_api.app)

    # ---------------------------------------------------------------
    # Health check
    # ---------------------------------------------------------------
    resp = client.get("/health")
    check("GET /health returns 200 with the database reachable", resp.status_code == 200)
    check("health response body correctly reports overall_healthy=True", resp.json()["overall_healthy"] is True)

    # Prove the HTTP status code itself changes on an unhealthy check,
    # not just the JSON body -- a monitoring system polling this
    # endpoint needs the status code to be authoritative, not just the
    # body content.
    original_find_many = fake_sdb.find_many
    async def broken_find_many(*a, **kw):
        raise RuntimeError("simulated database outage")
    fake_sdb.find_many = broken_find_many
    resp = client.get("/health")
    check("GET /health returns a real 503 status code (not just a 200 with an unhealthy body) when the DB is unreachable",
          resp.status_code == 503)
    check("the 503 response body also reports overall_healthy=False", resp.json()["overall_healthy"] is False)
    fake_sdb.find_many = original_find_many

    # ---------------------------------------------------------------
    # Launch gate status -- real HTTP call, honest current state
    # ---------------------------------------------------------------
    resp = client.get("/pilot/launch-gates/status")
    check("GET /pilot/launch-gates/status returns 200", resp.status_code == 200)
    check("production_authorized is False with zero gates recorded (fail closed, over real HTTP)", resp.json()["production_authorized"] is False)

    # ---------------------------------------------------------------
    # Onboarding: apply
    # ---------------------------------------------------------------
    apply_payload = {
        "user_id": "user-http-jane-001",
        "identity_verification_status": "verified",
        "age_confirmed": True,
        "residential_state": "VIC",
        "bank_account_verified": True,
        "income_amount": "5200", "income_frequency": "monthly",
        "employment_status": "full_time", "recurring_living_expenses": "2800",
        "existing_debts_and_bnpl": "0", "requested_credit_purpose": "electricity",
        "requirements_and_objectives": "Smooth out electricity bills",
        "utility_bill_ownership_verified": True,
        "consent_types_accepted": ["privacy", "identity_check", "affordability_check", "fraud_check"],
    }
    resp = client.post("/pilot/onboarding/apply", json=apply_payload)
    check("POST /pilot/onboarding/apply returns 200 for a clean application", resp.status_code == 200)
    application = resp.json()
    check("the application over HTTP is 'eligible'", application["eligibility_outcome"] == "eligible")

    # Malformed request: missing a required field entirely.
    bad_payload = dict(apply_payload)
    del bad_payload["requested_credit_purpose"]
    resp = client.post("/pilot/onboarding/apply", json=bad_payload)
    check("a request missing a required field is rejected with 422 (Pydantic validation, not a 500)", resp.status_code == 422)

    # ---------------------------------------------------------------
    # Credit activation over HTTP
    # ---------------------------------------------------------------
    resp = client.post(f"/pilot/onboarding/{application['id']}/activate-credit", json={
        "prepared_by": "credit_assessor_1", "approved_by": "compliance_lead",
        "contractual_limit": "2500.00", "active_customer_count": 0, "current_aggregate_contractual_exposure": "0",
    })
    check("POST .../activate-credit returns 200", resp.status_code == 200)
    activation = resp.json()
    check("credit account is active over HTTP", activation["credit_account"]["status"] == "active")

    # Maker-checker violation over HTTP -> mapped to 422, not a crash.
    resp = client.post(f"/pilot/onboarding/{application['id']}/activate-credit", json={
        "prepared_by": "someone", "approved_by": "someone",
        "contractual_limit": "2500.00", "active_customer_count": 1, "current_aggregate_contractual_exposure": "2500",
    })
    check("a maker-checker violation over HTTP returns 422 with a clear detail message, not a 500",
          resp.status_code == 422 and "distinct" in resp.json()["detail"])

    resp = client.get(f"/pilot/credit/accounts/user-http-jane-001/balance")
    check("GET .../balance returns the correct starting balance over HTTP", resp.json()["outstanding_principal"] == "0.00")

    resp = client.get("/pilot/credit/accounts/nonexistent-customer/balance")
    check("GET .../balance for an unknown customer returns 404", resp.status_code == 404)

    # ---------------------------------------------------------------
    # Bill upload -> real multipart file upload -> real OCR -> verify
    # ---------------------------------------------------------------
    bill_bytes = make_bill_photo("Origin Energy", "Jane Dummy", "REF-HTTP-001", "120.00", "25/09/2026")
    resp = client.post(
        "/pilot/bills/upload",
        data={"customer_id": "user-http-jane-001", "customer_name_on_account": "Jane Dummy", "category": "electricity"},
        files={"file": ("bill.png", bill_bytes, "image/png")},
    )
    check("POST /pilot/bills/upload (real multipart upload) returns 200", resp.status_code == 200)
    upload_result = resp.json()
    check("the bill uploaded over real HTTP was verified via real OCR", upload_result["bill"]["verification_status"] in ("verified", "manual_review"))
    check("OCR ran the real tesseract_ocr method over the HTTP-uploaded file", upload_result["ocr"]["method"] == "tesseract_ocr")

    bill_id = upload_result["bill"]["id"]
    if upload_result["bill"]["verification_status"] == "manual_review":
        resp = client.post(f"/pilot/bills/{bill_id}/manual-review", json={"reviewer": "case_worker_1", "decision": "verified", "notes": "confirmed"})
        check("manual review over HTTP moves the bill to verified", resp.json()["verification_status"] == "verified")

    # Reject a bad file upload over HTTP (wrong extension).
    resp = client.post(
        "/pilot/bills/upload",
        data={"customer_id": "user-http-jane-001", "customer_name_on_account": "Jane Dummy", "category": "electricity"},
        files={"file": ("bill.exe", bill_bytes, "application/octet-stream")},
    )
    check("uploading a disallowed file extension over HTTP returns 400", resp.status_code == 400)

    # ---------------------------------------------------------------
    # Pay the bill: MUST be blocked, since zero launch gates are approved
    # ---------------------------------------------------------------
    resp = client.post(f"/pilot/bills/{bill_id}/pay", json={"customer_id": "user-http-jane-001", "requested_by": "payments_admin_1"})
    check("POST .../pay is BLOCKED with 403 over real HTTP when production is not authorized (fail closed end to end)",
          resp.status_code == 403 and "launch gate" in resp.json()["detail"])

    balance_after_blocked_attempt = client.get("/pilot/credit/accounts/user-http-jane-001/balance").json()
    check("a blocked payment attempt over HTTP moves zero money", balance_after_blocked_attempt["outstanding_principal"] == "0.00")

    # ---------------------------------------------------------------
    # Hardship remains reachable regardless of production authorization
    # ---------------------------------------------------------------
    resp = client.post("/pilot/hardship/requests", json={
        "customer_id": "user-http-jane-001", "reason": "reduced hours at work",
        "vulnerability_indicators": [], "requested_by": "user-http-jane-001",
    })
    check("hardship requests remain reachable over HTTP even though production is not authorized", resp.status_code == 200)
    check("hardship case opens in 'open' status over HTTP", resp.json()["status"] == "open")

    # ---------------------------------------------------------------
    # Complaints reachable over HTTP too
    # ---------------------------------------------------------------
    resp = client.post("/pilot/complaints", json={
        "customer_id": "user-http-jane-001", "channel": "web_form", "description": "Test complaint over HTTP",
        "category": "standard", "severity": "low", "received_by": "agent1",
    })
    check("complaint intake works over HTTP", resp.status_code == 200 and resp.json()["status"] == "open")

    # ---------------------------------------------------------------
    # Reports reachable over HTTP
    # ---------------------------------------------------------------
    resp = client.get("/pilot/reports/credit-exposure")
    check("credit exposure report is reachable over HTTP", resp.status_code == 200)
    check("credit exposure report shows the 1 activated customer over HTTP", resp.json()["active_customer_count"] == 1)

    print()
    if FAILURES:
        print(f"{len(FAILURES)} CHECK(S) FAILED:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED -- pilot API verified over real HTTP request/response cycles")


if __name__ == "__main__":
    asyncio.run(main())
