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
| `control-matrix.md` | Partially implemented — reflects session 1 only; still due for a full rewrite across all 13 sessions (see Consolidation note) |
| `readiness-scorecard.md` | Implemented and tested (scoring logic), reflects session 1 only — still due for a refresh |
| `external-dependencies.md` | Implemented and tested |
| `regulatory-assumptions.md` | Implemented and tested |
| `change-log.md` | Implemented and tested, session 1 only |
| `session-2` through `session-13` (`*.md`) | One per session — see "What exists in code" below for the current summary of all of them |
| `document-templates/` | 14 structural templates (session 11), no legal wording |
| `runbooks/` | 6 operational runbooks (session 13) |
| `security-and-privacy.md` | Filled in session 13 — per-item honest status table |
| `incident-response.md` | Filled in session 13 — code + runbook exist, live drill not run |
| `business-continuity.md` | Filled in session 13 — code + runbook exist, live test not run |
| `current-state-assessment.md` | Not implemented yet |
| `target-operating-model.md` | Not implemented yet |
| `funds-flow.md` | Not implemented yet |
| `system-architecture.md` | Not implemented yet |
| `responsible-lending-workflow.md` | Superseded in practice by `session-2-...md` and `backend/responsible_lending.py`'s own docstrings |
| `customer-funds-safeguarding.md` | Not implemented yet |
| `reconciliation-process.md` | Partially covered by `runbooks/reconciliation.md` (session 13); a dedicated process doc still not written |
| `wind-down-plan.md` | Partially covered by `runbooks/wind-down.md` (session 13); a dedicated plan doc still not written |
| `test-evidence.md` | Not consolidated — see the "Test suite summary" below for the current aggregate |

## Consolidation note (post-merge, all 13 sessions)

PRs #3–#8 and #10–#15 have all merged into `main` (PR #9 was closed,
superseded by #10). `control-matrix.md`, `readiness-scorecard.md`, and
`change-log.md` still only reflect session 1 — they have NOT yet been
rewritten to incorporate sessions 2–13's controls, tests, and honest
status. Until that rewrite happens, treat each `session-N-*.md` file as
the authoritative record for that session's work, and the summary below
as the best current single-page overview. A future session should fold
all thirteen sessions' control rows into one `control-matrix.md` and
recompute `readiness-scorecard.md` against the full, current set of
implemented modules.

## What exists in code right now (all merged sessions)

**Session 1 — regulatory launch gates + pilot config** (migration 012)
`pilot_config.py`, `launch_gates.py`. Versioned pilot configuration with
hard ceilings; fail-closed launch-gate service, 22 mandatory gates,
two-person production activation.

**Session 2 — onboarding + responsible lending** (migration 013)
`onboarding.py`, `responsible_lending.py`. Deterministic eligibility, no
opaque scoring; deterministic affordability assessment; maker-checker
throughout.

**Session 3 — bill verification + permitted-use blocking** (migration 014)
`bill_verification.py`, `payment_permitted_use.py`. Immutable bill
hashing; a fixed, non-overridable prohibited-payment-type list.

**Session 4 — credit exposure ledger** (migration 015)
`credit_ledger.py`. A separate double-entry credit sub-ledger where
`pilot_config`'s numbers become real, DB-backed enforcement.

**Session 5 — end-to-end payment flow** (migration 016)
`pilot_payment_flow.py`. Joins verification, permitted-use, and the
credit ledger with a strict no-partial-state ordering guarantee.

**Session 6 — free/sandbox verification providers**
`bill_ocr.py` (fully working, free, real Tesseract/pdfplumber),
`identity_verification.py`, `bank_verification.py`, `biller_allowlist.py`.

**Session 7 — Didit contract fix + onboarding wiring** (migration 017)
Corrected the Didit API contract against real documentation (auth
header, `workflow_id`); wired `onboarding.py`'s real call site.

**Session 8 — Didit webhook rebuild** (migration 018)
Full rebuild against a confirmed integration reference: `url` field fix,
all 10 real status literals, and — the structural addition — real,
independently-verified HMAC webhook signature checking
(`verify_webhook_signature()`), now the authoritative decision path.

**Session 9 — repayments, hardship, collections** (migration 019)
`hardship_collections.py`. No aggressive collections, no default fees
(structurally absent from the schema), no automated adverse action.
Hardship intake has zero payment-status gating, verified directly.

**Session 10 — complaints / IDR / AFCA** (migration 020)
`complaints.py`. Timeframes sourced from ASIC RG 271, not invented.
AFCA has no public API (confirmed against their docs) — escalation is
record-only. Maker-checker on any compensation remedy.

**Session 11 — document versioning + acceptance** (migration 021)
`document_versioning.py` + 14 structural templates (no legal wording).
Reproducible customer acceptance with integrity verification; only
material-change versions force re-acceptance.

**Session 12 — audit trail + regulatory reporting** (migration 022)
`audit_events.py`, `regulatory_reports.py`. Unified schema for
login/security/admin-access/data-export events (other categories
already had tables — documented gap, not consolidated). All 10 required
report types as pure, PII-avoidant aggregation functions.

**Session 13 — security + operational readiness** (migration 023)
`security_controls.py`, `operational_readiness.py`. RBAC/least
privilege, MFA gating, PII-safe logging (real redaction, tested against
realistic phrasing), secure file-upload validation with magic-byte
checking, sourced 7-year data-retention enforcement, health aggregation,
feature flags, job-stall detection. Plus 6 runbooks and the filled-in
`security-and-privacy.md`/`incident-response.md`/`business-continuity.md`.

## What this does NOT yet cover

Nothing across all 13 sessions is wired into a real API endpoint —
every module is tested and standalone, waiting on that integration
step. No real malware scanner, MFA provider, or managed secret store is
integrated (all are documented integration points). No live drills have
been run for incident response or business continuity. The audit-table
consolidation gap from session 12 remains open. See
`external-dependencies.md` and each `session-N-*.md` file's own
"Explicitly NOT done" section for specifics.

## Test suite summary (all 19 suites passing on `main` as of this merge)

```
test_pilot_config_and_launch_gates.py                 30 checks
test_onboarding_and_responsible_lending.py             34 checks
test_bill_verification_and_permitted_use.py            31 checks
test_credit_ledger.py                                  28 checks
test_pilot_payment_flow.py                             18 checks
test_bill_ocr.py                                       15 checks (real OCR/PDF extraction)
test_identity_verification.py                           9 checks
test_identity_verification_webhooks.py                 12 checks (real HMAC round trip)
test_onboarding_identity_verification_wiring.py         13 checks
test_bank_verification.py                                6 checks
test_biller_allowlist.py                               10 checks
test_hardship_collections.py                            30 checks
test_complaints.py                                      32 checks
test_document_versioning.py                             26 checks
test_audit_events_and_regulatory_reports.py             32 checks
test_security_controls.py                               33 checks
test_operational_readiness.py                           16 checks
test_ledger_flow.py                                (pre-existing, unmodified)
test_stripe_collections.py                          (pre-existing, unmodified)
```

Six real bugs were found and fixed by these tests during this
workstream (not merely run to confirm expected behaviour): a bill-OCR
reference-number regex, a cumulative-payment tracking bug in
`hardship_collections.py`, a PII-redaction regex requiring adjacent
BSB/account text, and three Didit API contract corrections (auth
header, response field name, status literal coverage) across sessions
7–8.
