# ASIC ERS Readiness — Session 6 Notes (free/sandbox verification providers)

Cut from `main`, independent of PR #3/#4/#5/#6/#7 — these four modules
each produce inputs that `onboarding.py`/`bill_verification.py` already
consume as plain parameters, so no new coupling was introduced.

## What this session built

- `backend/bill_ocr.py` — **fully free, fully tested end to end, zero
  API keys, zero network calls.** `pdfplumber` for PDF text-layer
  extraction (exact, no OCR needed), Tesseract OCR (via `pytesseract`)
  for scanned/photographed bills. Confidence scores are real: the
  text-layer path scores based on how many fields were actually found,
  and the OCR path reports Tesseract's own per-word confidence honestly
  rather than a placeholder number.
  **A real bug was found and fixed while testing this**: the
  reference-number regex was initially loose enough to match "Account
  Name: Jane" and extract "Name" as if it were a reference number,
  because "Account" alone (without "Number"/"No" following it) matched
  the pattern. Fixed by requiring "account" be directly followed by
  "number"/"no", and requiring the captured value contain a digit —
  caught by `test_bill_ocr.py` running against a real generated PDF,
  not a hypothetical.
- `backend/identity_verification.py` — Didit KYC sandbox adapter
  (chosen for a genuinely free-forever 500/month tier, no card required
  for the sandbox). **This session had no real Didit API key**, so per
  the task's instruction #13, the real HTTP integration is implemented
  against Didit's documented contract but is **untested against a live
  endpoint** — only the explicitly-gated mock path
  (`ALLOW_MOCK_IDENTITY_VERIFICATION=true`, off by default, mirroring
  the existing `ALLOW_MOCK_PAYMENTS` pattern in `server.py`) is
  exercised by tests. Fails closed (raises) with no configuration and
  mock mode off — never silently treats an applicant as verified.
- `backend/bank_verification.py` — same structure, against the free
  Open Bank Project sandbox. Also untested against a live sandbox
  account (no credentials available). Explicitly documents that this is
  a **sandbox-stage-only** integration — real Australian bank
  verification needs ACCC CDR accreditation, a regulatory process, not
  a config value, regardless of which vendor is used. This module does
  not and cannot shortcut that.
- `backend/biller_allowlist.py` — curated seed data (17 billers across
  all four approved categories, all covering VIC) sourced from each
  biller's public BPAY biller code. Explicitly labelled as illustrative
  sandbox seed data needing re-verification before production use, not
  a live directory API (none exists for this).
- Four new test files, all passing, all against **real** behaviour
  where possible (`test_bill_ocr.py` runs actual Tesseract OCR against
  a generated image, actual pdfplumber against a generated PDF — not
  mocked) or against the fail-closed/mock-gated behaviour where a real
  provider genuinely isn't available (`test_identity_verification.py`,
  `test_bank_verification.py`).
- `backend/requirements.txt` — added `pytesseract==0.3.13`. The
  `tesseract-ocr` **system package** is also required
  (`apt-get install tesseract-ocr`) — pip alone doesn't install it;
  documented in the requirements.txt comment and here.

## Test results

```
python3 backend/test_bill_ocr.py                    # 15/15 PASS (real OCR/PDF extraction)
python3 backend/test_identity_verification.py        # 8/8 PASS (fail-closed + mock only)
python3 backend/test_bank_verification.py            # 6/6 PASS (fail-closed + mock only)
python3 backend/test_biller_allowlist.py             # 10/10 PASS
```

Pre-existing `test_ledger_flow.py` and `test_stripe_collections.py`
confirmed still passing, unmodified.

## Honest status classification (per the evidence pack's taxonomy)

- `bill_ocr.py` — **Implemented and tested.** Genuinely free, genuinely
  works, no external dependency at all.
- `identity_verification.py` — **Implemented but awaiting external
  configuration.** Code is real and fails closed correctly; the actual
  Didit sandbox integration has never been exercised against Didit's
  servers.
- `bank_verification.py` — **Implemented but awaiting external
  configuration**, AND separately **external dependency** for anything
  beyond sandbox testing (CDR accreditation).
- `biller_allowlist.py` — **Implemented but awaiting external
  configuration** — the data itself needs operational re-verification
  (confirming each BPAY code is still current) before being trusted,
  and there's no admin workflow to maintain it yet.

## Deliberate scope limits this session

- None of these four modules are wired into `onboarding.py` or
  `bill_verification.py`'s actual call sites yet — they exist as
  standalone, independently-tested adapters producing compatible input
  shapes, matching the decoupling pattern established in earlier
  sessions.
- No admin UI for managing the biller allowlist, viewing verification
  session status, or configuring provider credentials.
- `identity_verification.py`/`bank_verification.py`'s real-provider code
  paths need actual sandbox credentials to validate — that's a concrete,
  cheap next step (both providers' sandboxes are free to sign up for)
  but requires an account being created by a human, not something this
  session could do unattended.
