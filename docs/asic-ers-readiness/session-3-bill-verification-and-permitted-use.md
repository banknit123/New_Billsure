# ASIC ERS Readiness — Session 3 Notes (bill verification + permitted-use blocking)

Cut from `main`, independent of PR #3 and PR #4 (both still open at time
of writing). No shared imports with `pilot_config.py`/`launch_gates.py`/
`onboarding.py`/`responsible_lending.py` — `max_single_bill_payment` is
passed into `payment_permitted_use.DisbursementRequest` as a parameter,
not imported from `pilot_config`, so this branch doesn't depend on merge
order either. Once all three branches are merged, fold this into the
main `README.md`/`control-matrix.md`.

## What this session built

- `backend/bill_verification.py` — bill ingestion and verification.
  Every submitted bill gets an immutable SHA-256 hash of the uploaded
  file before anything else can reference it. Unambiguous, objective
  failures (unsupported biller, unsupported category, duplicate,
  already-paid, non-positive amount) are **rejected outright**.
  Ambiguous cases — low extraction confidence, a customer-name mismatch,
  any fraud/alteration indicator — always route to `manual_review`,
  **never** auto-verified or auto-rejected. Duplicate/already-paid
  detection checks both the exact file hash and the (biller, reference,
  amount, due date) tuple, so a re-scanned copy of the same bill still
  gets caught.
- `backend/payment_permitted_use.py` — the last check before money
  moves. A fixed, non-overridable list of prohibited payment types
  (cash advance, payment to customer, payment to personal account,
  credit-card/loan/BNPL repayment, gambling, rent, fines, tax
  liabilities, unsupported merchants) is checked first, before any
  amount logic runs. A disbursement can only be created against a
  `verified` bill, for the bill's own biller, for an amount that is both
  ≤ the bill's amount and ≤ the pilot's max single-bill limit. Creating
  a disbursement immediately links it back to the bill in the same
  operation — no window where a disbursement exists but the bill isn't
  yet marked paid.
- `backend/migrations/014_bill_verification_and_permitted_use.sql` — new,
  separate tables (`pilot_bill_submissions`, `pilot_bill_disbursements`)
  — deliberately **not** reusing the existing `bills` table, which
  belongs to the current bill-smoothing product and has a different data
  model with no hash/fraud/verification concept. Includes a DB-level
  unique partial index enforcing at most one active disbursement per
  bill, so a race between two concurrent disbursement requests can't
  both succeed. **Not applied to any live database.**
- `backend/test_bill_verification_and_permitted_use.py` — 31 automated
  checks, all passing.

## Test results

```
python3 backend/test_bill_verification_and_permitted_use.py
... 31/31 PASS
ALL CHECKS PASSED
```

Pre-existing `test_ledger_flow.py` and `test_stripe_collections.py`
confirmed still passing, unmodified, on this branch.

## Deliberate scope limits this session

- Not wired into any real API endpoint, upload handler, or admin UI yet.
- `extraction_confidence` and `fraud_indicators` are modelled as
  already-computed inputs — no real OCR/document-analysis or
  fraud-detection provider is integrated here. The existing app has
  `pdfplumber` + GPT-4o Vision bill extraction (see `billing_engine.py`
  / PRD) for the *other* product; wiring that (or a pilot-appropriate
  equivalent) to actually populate `extraction_confidence` is still
  open, and its fraud/alteration detection doesn't exist at all yet —
  `fraud_indicators` currently has no real source.
- The biller allowlist itself (`BILLER_ALLOWLIST` in the test file) is a
  hardcoded example set for testing — there's no real, maintained
  allowlist of verified Australian utility billers yet, and no admin UI
  to manage one.
- `payment_permitted_use.create_disbursement()` only creates a `queued`
  disbursement row — it does not yet call into `payment_runs.py` /
  `ledger.py` from PR #3's predecessor work to actually move money or
  post ledger entries. That integration (bill-payment controls +
  segregated ledger, task section 5) is still open.
