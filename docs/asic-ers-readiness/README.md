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
| `control-matrix.md` | Partially implemented — 2 of ~60+ expected control rows populated so far |
| `readiness-scorecard.md` | Implemented and tested (scoring logic), low score by design |
| `external-dependencies.md` | Implemented and tested |
| `regulatory-assumptions.md` | Implemented and tested |
| `change-log.md` | Implemented and tested |
| `current-state-assessment.md` | Not implemented yet |
| `target-operating-model.md` | Not implemented yet |
| `funds-flow.md` | Not implemented yet |
| `system-architecture.md` | Not implemented yet |
| `responsible-lending-workflow.md` | Not implemented yet (workflow itself is also not implemented in code yet) |
| `customer-funds-safeguarding.md` | Not implemented yet |
| `reconciliation-process.md` | Not implemented yet (reconciliation.py exists from a prior session; this doc hasn't been written yet) |
| `security-and-privacy.md` | Not implemented yet |
| `incident-response.md` | Not implemented yet |
| `business-continuity.md` | Not implemented yet |
| `wind-down-plan.md` | Not implemented yet |
| `test-evidence.md` | Not implemented yet |

## What exists in code right now (this session)

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
- `backend/migrations/012_pilot_config_and_launch_gates.sql` — schema for
  the above, with matching hard `CHECK` constraints at the database
  layer (not just app code), RLS default-deny, and audit-trigger
  coverage. **Not applied to any live database** — see the migration
  file header for why and where it should be applied instead.
- `backend/test_pilot_config_and_launch_gates.py` — 30 automated checks,
  all passing, covering every hard cap, every prohibited capability,
  maker-checker on config changes and on individual gates, gate expiry,
  and two-person production activation.

## What this does NOT yet cover

Everything else in the task scope: onboarding/eligibility, responsible-
lending assessment, bill verification and permitted-use blocking, the
full segregated-ledger integration with the pilot config, credit-limit/
exposure monitoring wired to real customer data, hardship/collections,
complaints/AFCA, document versioning and acceptance, the full audit and
regulatory-reporting exports, and most of the security/operational
readiness items. See `external-dependencies.md` and `readiness-
scorecard.md` for the honest current state, and the PR description for
the recommended next five actions.
