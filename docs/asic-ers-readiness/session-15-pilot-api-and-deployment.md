# ASIC ERS Readiness — Session 15 Notes (real HTTP API + deployment path)

Cut from `main` after session 14 merged. Closes the gap every prior
session flagged: "not wired into any real API endpoint yet."

## What this session built

- `backend/pilot_api.py` — a standalone FastAPI app (deliberately
  separate from `server.py`, the existing 150KB+ bill-smoothing
  product, to avoid any risk to that live app or its database) exposing
  15 real endpoints covering the full journey proven in session 14's
  in-process test: identity verification sessions + webhook, onboarding
  apply + manual review + credit activation, credit balance lookup,
  bill upload (real multipart file upload) + OCR + verification +
  manual review + payment, hardship requests, complaints, document
  access/acceptance, and a credit-exposure report. Every underlying
  module's exception type is mapped to a specific HTTP status code
  (never a generic 500 for a legitimate business-rule refusal).
- **`POST /pilot/bills/{id}/pay` checks `launch_gates.
  is_production_authorized()` before calling into the payment flow** —
  with zero gates recorded (the honest current state), this correctly
  returns 403 over real HTTP, proven directly in the test below.
- `backend/test_pilot_api.py` — 24 checks using FastAPI's `TestClient`,
  a genuine HTTP request/response cycle through Starlette's ASGI
  transport (not a direct Python function call, unlike every other test
  in this workstream) — the first test that actually proves the routing,
  Pydantic validation, and error-to-status-code mapping layer is
  correct, not just the underlying modules.
- `Dockerfile.pilot-api` + `backend/requirements-pilot-api.txt` — a
  deliberately minimal, separate dependency set (9 packages, not the
  full app's 150+, and specifically avoiding a dependency pinned to a
  private asset host that this service has no need of). **Verified by
  actually installing it into a fresh venv and confirming `pilot_api`
  imports and registers all 15 routes correctly** — not just written
  and assumed to work.
- `render.yaml` + `docs/asic-ers-readiness/deployment-guide.md` — a
  concrete, step-by-step path from this repo to a live HTTPS URL on a
  real subdomain, including exact `curl` commands to replicate Jane
  Dummy's journey against a real deployment.

## A real bug found and fixed while testing

`GET /health`'s first version returned a Python tuple
`(status_code, body_dict)` from the route handler. FastAPI does **not**
interpret that as "set this HTTP status code" — it just serialises the
tuple as a JSON array, so the actual HTTP status stayed 200 regardless
of whether the database check failed. A monitoring system polling this
endpoint would never have seen a real 503. Fixed with an explicit
`JSONResponse(status_code=..., content=...)`, and a new test simulates
a database outage and confirms the endpoint now genuinely returns 503,
not just a 200 with an unhealthy-looking body.

## Test results

```
python3 backend/test_pilot_api.py                             # 24/24 PASS (real HTTP request/response cycle)
python3 backend/test_end_to_end_dummy_customer_journey.py      # 27/27 PASS (unaffected, in-process)
```

Full regression sweep of all 13 other test suites, all passing
unmodified.

## What deployment actually requires from here (a human, not this session)

1. A NEW Supabase project (migrations 012–023 applied) — never the live
   `EasyBillsPay` project.
2. A Render account (free tier is enough) connected to this GitHub
   repo — `render.yaml` is pre-configured; only the environment
   variable values need to be filled in via Render's dashboard (never
   committed to the repo).
3. DNS access to `billsure.com.au` to add a CNAME for a subdomain
   (`pilot-api.billsure.com.au` recommended, not the bare domain).
4. None of this activates real money — confirmed both by `launch_gates`
   itself and by the deployed `/pilot/bills/{id}/pay` endpoint's own
   403 response, which stays correct regardless of hosting.

## Deliberate scope limits this session

- Not every module built across 13 prior sessions has an HTTP endpoint
  yet (e.g. no `reconciliation.py`, `audit_events.py`, or
  `security_controls.py` endpoints) — this covers the core customer
  journey specifically, matching what session 14's test already proved
  works end to end.
- No authentication/authorization middleware on `pilot_api.py` itself
  yet — every endpoint is currently open to anyone who can reach the
  URL. This is acceptable for a private testing deployment behind a
  not-yet-publicised subdomain, but is a real gap before any broader
  exposure — `security_controls.py`'s RBAC/MFA functions exist and are
  tested, but aren't wired into this API layer as middleware yet.
- No frontend — this is a JSON API only. FastAPI's auto-generated
  `/docs` page is usable as an interim UI (can execute every endpoint,
  including file upload, directly from the browser).
