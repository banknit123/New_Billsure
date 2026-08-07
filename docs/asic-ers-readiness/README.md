# ASIC ERS Readiness — Evidence Pack Index

This directory tracks BillSure's technical, operational, and compliance
readiness for a controlled ASIC Enhanced Regulatory Sandbox (ERS) test
covering (1) a non-cash payment facility and (2) a continuing
consumer-credit facility used exclusively to pay verified household
utility bills.

**This is not authority to launch publicly.** Nothing in this pack, this
repository, or its commit history represents that ASIC has approved
BillSure, that BillSure is legally entitled to operate a credit or
payment facility, or that any control below is complete until it is
actually implemented, tested, and — where the item requires external
evidence (ASIC status, AFCA membership, insurance, banking, legal
advice) — that evidence has been supplied from outside this repository.

## Status legend

Every control/document below is classified as one of:
- **Implemented and tested** — code exists, has automated tests, and they pass.
- **Implemented but awaiting external configuration** — code/interface exists and is tested with sandbox/mock data, but needs a real external credential, account, or provider connection to go live.
- **Partially implemented**
- **Not implemented**
- **External dependency** — cannot be completed by writing code; requires a third party (ASIC, AFCA, an insurer, an ADI, external counsel).
- **Requires legal confirmation** — the product/contract structure itself needs Australian legal sign-off, independent of whether the software is built.

## Document index

| Document | Status |
|---|---|
| `README.md` (this file) | Implemented and tested |
| `control-matrix.md` | Partially implemented — reflects session 1 only; see Consolidation note below |
| `readiness-scorecard.md` | Implemented and tested (scoring logic), reflects session 1 only — due for a refresh |
| `external-dependencies.md` | Implemented and tested |
| `regulatory-assumptions.md` | Implemented and tested |
| `change-log.md` | Implemented and tested, session 1 only |
| `session-2-onboarding-and-responsible-lending.md` | Onboarding/eligibility + responsible-lending assessment (task sections 2–3) |
| `session-3-bill-verification-and-permitted-use.md` | Bill verification + permitted-use payment blocking (task section 4) |
| `session-4-credit-exposure-ledger.md` | pilot_config integrated into a new credit exposure sub-ledger (task section 8) |
| `session-5-payment-flow-integration.md` | End-to-end payment flow joining verification, permitted-use, and the credit ledger |
| `session-6-free-sandbox-verification-providers.md` | Free/sandbox OCR, KYC, and bank-verification provider adapters |
| `current-state-assessment.md` | Not implemented yet |
| `target-operating-model.md` | Not implemented yet |
| `funds-flow.md` | Not implemented yet |
| `system-architecture.md` | Not implemented yet |
| `responsible-lending-workflow.md` | Superseded in practice by `session-2-...md` and `backend/responsible_lending.py`'s own docstrings — a dedicated policy-facing write-up under this exact filename is still not implemented |
| `customer-funds-safeguarding.md` | Not implemented yet |
| `reconciliation-process.md` | Not implemented yet (reconciliation.py exists from a prior session; this doc hasn't been written yet) |
| `security-and-privacy.md` | Not implemented yet |
| `incident-response.md` | Not implemented yet |
| `business-continuity.md` | Not implemented yet |
| `wind-down-plan.md` | Not implemented yet |
| `test-evidence.md` | Not implemented yet — the closest equivalent today is the "Test results" section in each session-N note, not yet consolidated |

## Consolidation note (post-merge, all 6 sessions)

PRs #3–#8 have all merged into `main`. `control-matrix.md`,
`readiness-scorecard.md`, and `change-log.md` above still only reflect
session 1 (launch gates + pilot config) — they have NOT yet been
rewritten to incorporate sessions 2–6's controls, tests, and honest
status. Until that rewrite happens, treat each `session-N-*.md` file as
the authoritative record for that session's work, and the summary below
as the best current single-page overview. A future session should fold
all six sessions' control rows into one `control-matrix.md` and
recompute `readiness-scorecard.md` against the full, current set of
implemented modules rather than just session 1's two.

## What exists in code right now (all merged sessions)

**Session 1 — regulatory launch gates + pilot config**
- `backend/pilot_config.py` — versioned, validated pilot product
  configuration with hard ceilings matching the ERS notification
  (25 customers, $2,500 contractual limit, $62,500 aggregate cap, no
  cash withdrawals, no customer transfers, 0% interest/fees, VIC-only,
  electricity/gas/water/telco only).
- `backend/launch_gates.py` — fail-closed regulatory launch-gate service.
  All 22 mandatory gates default closed; production/new-lending is
  blocked unless every gate is currently approved and unexpired; gate
  approval requires a distinct reviewer from the evidence submitter;
  full production activation requires two distinct approvers, neither
  of whom requested the activation.
- Migration 012.

**Session 2 — onboarding/eligibility + responsible lending**
- `backend/onboarding.py`, `backend/responsible_lending.py`,
  migration 013. Deterministic eligibility rules — no opaque scoring.
  Vulnerability/incomplete evidence always routes to manual review, not
  auto-decline or auto-approve. Maker-checker on manual review AND on
  final credit activation. Deterministic affordability assessment with
  hardship-forced referral, override requiring a documented reason and
  independent approver, and a guard preventing any automatic limit
  increase without a fresh, passing reassessment.

**Session 3 — bill verification + permitted-use blocking**
- `backend/bill_verification.py`, `backend/payment_permitted_use.py`,
  migration 014. Immutable SHA-256 bill hashing, objective-reject vs.
  manual-review routing (never auto-resolving an ambiguous case either
  way), and a fixed, non-overridable prohibited-payment-type list
  checked before any amount logic runs.

**Session 4 — credit exposure ledger**
- `backend/credit_ledger.py`, migration 015. A new, separate
  double-entry credit sub-ledger (distinct from `ledger.py`'s existing
  customer-trust ledger) where `pilot_config`'s numbers become real
  enforcement: customer cap, aggregate exposure cap, single-bill and
  outstanding-balance limits, and 70/80/90% warning thresholds — all
  backed by database-level deferred-trigger enforcement too, not just
  application code.

**Session 5 — end-to-end payment flow**
- `backend/pilot_payment_flow.py`, migration 016. Joins bill
  verification, permitted-use checking, and the credit ledger into one
  real payment path (`pay_verified_bill()`) with a strict ordering
  guarantee: nothing downstream of a failed step ever happens, so a
  blocked payment leaves zero side effects.

**Session 6 — free/sandbox verification providers**
- `backend/bill_ocr.py` — fully working, free, tested end to end
  (pdfplumber + Tesseract OCR, no API key, no network call).
- `backend/identity_verification.py` — Didit KYC sandbox adapter,
  implemented against Didit's documented API but **unverified against a
  live endpoint** (no credentials available when built) — fails closed,
  with an explicitly gated mock path for local development.
- `backend/bank_verification.py` — Open Bank Project sandbox adapter,
  same caveat. Documents that real Australian bank verification needs
  ACCC CDR accreditation regardless of vendor.
- `backend/biller_allowlist.py` — 17 curated, BPAY-sourced Victorian
  utility billers across all four approved categories.

## What this does NOT yet cover

Full segregated-ledger integration beyond the credit sub-ledger (the
original trust ledger and the credit ledger are not yet reconciled
against each other), the remaining credit-limit/exposure monitoring
wiring into a real scheduled job or admin dashboard, hardship/
collections workflow (task section 9), complaints/AFCA (section 10),
document versioning and acceptance (section 11), the full audit and
regulatory-reporting exports (section 12), and most of the security/
operational readiness items (sections 13–14). None of the modules built
across sessions 1–6 are wired into a real API endpoint yet — every one
is a tested, standalone module waiting on that integration step. See
`external-dependencies.md` and each `session-N-*.md` file's own
"Explicitly NOT done" section for specifics.

## Test suite summary (all passing on `main` as of this merge)

```
test_pilot_config_and_launch_gates.py            30 checks
test_onboarding_and_responsible_lending.py        34 checks
test_bill_verification_and_permitted_use.py       31 checks
test_credit_ledger.py                             28 checks
test_pilot_payment_flow.py                        18 checks
test_bill_ocr.py                                  15 checks (real OCR/PDF extraction)
test_identity_verification.py                      8 checks (fail-closed + gated mock)
test_bank_verification.py                           6 checks (fail-closed + gated mock)
test_biller_allowlist.py                          10 checks
test_ledger_flow.py                          (pre-existing, unmodified)
test_stripe_collections.py                   (pre-existing, unmodified)
```
