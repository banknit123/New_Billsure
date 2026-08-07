# Change Log — ASIC ERS Readiness Workstream

## Session 1 — 2026-08-07

Branch: `feature/asic-ers-readiness`

**Repository inspection:** Read `CLAUDE.md`, `README.md`,
`memory/PRD.md`, `memory/test_credentials.md`, existing migrations
002–011, `ledger.py`, `payment_runs.py`, `reconciliation.py`, and both
existing standalone test files before making any change. Confirmed the
app is a bill-smoothing platform (not yet a credit product) connected to
a live Supabase project with real rows, including at least two accounts
that appear to belong to real people — explicitly avoided touching that
project or its data.

**Built this session:**
- `backend/pilot_config.py` — versioned pilot configuration with hard
  ceilings and change validation (customer cap, credit limits,
  aggregate exposure, prohibited capabilities, maker-checker on
  changes).
- `backend/launch_gates.py` — fail-closed launch-gate service, 22
  mandatory gates, per-gate maker-checker, expiry auto-close, two-person
  production activation.
- `backend/migrations/012_pilot_config_and_launch_gates.sql` — schema
  with matching DB-level `CHECK` constraints, RLS default-deny, audit
  triggers. Not applied to any live database.
- `backend/test_pilot_config_and_launch_gates.py` — 30 automated checks,
  all passing.
- This evidence pack: `README.md`, `control-matrix.md`,
  `readiness-scorecard.md`, `external-dependencies.md`,
  `regulatory-assumptions.md`, `change-log.md` (this file).

**Verified:** pre-existing `test_ledger_flow.py` and
`test_stripe_collections.py` still pass unmodified (confirmed the
`httpx` import failure on first run was a missing package in this
session's sandbox, not a regression — installed it and re-ran clean).

**Deliberately not done this session:** onboarding/eligibility,
responsible-lending assessment, bill verification/permitted-use
blocking, credit-limit/exposure monitoring wired to real data, hardship/
collections, complaints/AFCA, document versioning, most of the audit/
reporting exports, most of security/operational readiness, and 12 of the
18 evidence-pack documents. See `README.md` for the full breakdown and
the PR description for recommended next steps.
