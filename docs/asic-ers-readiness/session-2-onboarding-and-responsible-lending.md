# ASIC ERS Readiness — Session 2 Notes (onboarding + responsible lending)

This branch (`feature/asic-ers-onboarding-responsible-lending`) was cut
from `main`, which does not yet include the evidence pack or
`pilot_config.py`/`launch_gates.py` from the still-open PR #3
(`feature/asic-ers-readiness`). This file exists so this branch's
contribution isn't lost; once both PRs are merged, fold this into the
main `README.md`/`control-matrix.md` from PR #3 rather than keeping two
separate evidence packs.

## What this session built

- `backend/onboarding.py` — structured onboarding/eligibility workflow.
  Deterministic rule checks (age, identity, AU/VIC residency, bank
  verification, utility-bill ownership, bankruptcy status, approved
  purpose, required consents) — **no opaque scoring**. Vulnerability
  indicators and incomplete evidence always route to `referred`, never
  auto-declined or auto-approved. Every non-approved outcome requires at
  least one documented reason code from a fixed, known set. Maker-checker
  enforced twice: once for manual review outcomes, again (with a
  distinct third check) before `approve_credit_activation()`.
- `backend/responsible_lending.py` — deterministic affordability
  assessment (net income, essential expenditure, existing/BNPL
  repayments, proposed repayment → monthly surplus). No ML. Missing,
  negative, or stale (>90 day) evidence blocks a decision outright
  (`refer`, never an assumed-favourable `approve`). Hardship/vulnerability
  indicators force `refer` regardless of the arithmetic. Overrides
  require a non-empty documented reason and an approver distinct from
  the person requesting the override. Limit increases
  (`can_increase_limit()`) always require a fresh, non-superseded,
  passing assessment — there is no code path that increases a limit
  automatically or off a stale/failing assessment.
- `backend/migrations/013_onboarding_and_responsible_lending.sql` —
  matching schema, hard `CHECK` constraints (maker-checker distinctness,
  reason-code-required, override-reason-non-empty), RLS default-deny,
  audit triggers. **Not applied to any live database.**
- `backend/test_onboarding_and_responsible_lending.py` — 34 automated
  checks, all passing.

## Test results

```
python3 backend/test_onboarding_and_responsible_lending.py
... 34/34 PASS
ALL CHECKS PASSED
```

Pre-existing `test_ledger_flow.py` and `test_stripe_collections.py`
confirmed still passing, unmodified, on this branch.

## Deliberate scope limits this session

- Not yet wired into any real API endpoint or admin UI.
- Sensitive financial fields (income, expenses, debts) are stored only
  as caller-encrypted strings — `onboarding.py` itself never touches
  plaintext or calls `utils.auth.encrypt_field` directly, so it stays
  testable without a live `ENCRYPTION_KEY`. Wiring the real encrypt/
  decrypt calls into whatever endpoint eventually calls
  `submit_application()` is still open.
- Bill verification / permitted-use payment blocking (task section 4)
  is not built yet — `requested_credit_purpose` is validated against an
  approved-category set, but nothing here checks an actual uploaded
  bill.
- Identity verification, bank-account verification, and bankruptcy
  checks are all modelled as already-resolved booleans/enums on the
  application — no real verification provider is integrated. That
  remains an external dependency (see PR #3's
  `external-dependencies.md`) until a sandbox KYC/bank-verification
  provider is chosen and wired in.
- `responsible_lending.py`'s reassessment/limit-increase guard is not
  yet called from anywhere that actually changes a customer's limit —
  there is no limit-increase endpoint yet for it to protect.
