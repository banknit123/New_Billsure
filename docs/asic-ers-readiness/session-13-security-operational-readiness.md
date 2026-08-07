# ASIC ERS Readiness — Session 13 Notes (security + operational readiness, sections 13-14)

Cut from `main`. Builds the genuinely code-implementable parts of task
sections 13 and 14; the rest (security headers, CSRF/XSS protections,
CI dependency scanning, actual backup infrastructure) are either
properties of `server.py`'s existing configuration this workstream
didn't touch, or organisational/pipeline concerns — documented
honestly rather than faked.

## What this session built

**`backend/security_controls.py`:**
- RBAC / least-privilege matrix (`ROLE_PERMISSIONS`) — 5 roles, each
  granted only what it needs. Tested directly that `admin` does NOT
  automatically inherit every other role's permissions (no blanket
  superuser shortcut).
- MFA gating (`requires_mfa()`/`require_mfa_verified()`) for admin and
  compliance-reviewer roles — fails closed if MFA wasn't verified this
  session. No real MFA provider integrated; this is the enforcement
  point, not a working TOTP/SMS flow.
- `redact_sensitive()` / `PiiRedactingLogFilter` — catches AU TFN-
  shaped numbers, Medicare-shaped numbers, BSB/account combinations,
  and credential-shaped strings in free-text log messages, tested
  against a real emitted log record (not just the function in
  isolation).
- `validate_file_upload()` — size limit, extension allowlist, and
  **magic-byte content verification** (catches a file whose actual
  content doesn't match its claimed extension — tested against a real
  spoofed file). Always returns `malware_scan_status='pending'` — the
  documented integration point per the task spec, not a working
  scanner.
- `request_account_deletion()` / `can_delete_now()` — retention period
  sourced from AML/CTF Act 2006 (Cth) and ASIC AFSL record-keeping
  expectations (7 years), not invented. Tested that deletion is refused
  years before the retention period elapses and permitted once it
  genuinely has.
- `record_data_breach_assessment()` — `notifiable` defaults to `None`
  (undetermined), never `False`, forcing a deliberate human
  determination.

**`backend/operational_readiness.py`:**
- `check_health()` — pure aggregation, no partial-credit averaging
  (one unhealthy component means the whole report is unhealthy).
- Feature-flag registry with mandatory documented reasons, fails closed
  for any never-configured flag.
- `is_job_stalled()` — fails closed (never-run job = stalled, not
  "unknown, assume fine").
- `record_backup_verification()` — distinguishes "backup recorded" from
  "restore actually tested," honestly.
- Six synthetic ASIC-review demonstration scenarios, each naming the
  specific modules/controls it demonstrates, built entirely from
  synthetic data across sessions 1–12.

## A real bug found and fixed while testing

`security_controls.redact_sensitive()`'s first version required a BSB
and account number to be immediately adjacent (only whitespace/colon
between them) to be redacted as a pair. Real text like "BSB 063-000
account 12345678" has the word "account" in between, which the regex
didn't allow for — so the account number would have passed through
unredacted. Fixed by splitting into two independent patterns: one for
the BSB shape alone, one for "account" followed by 6–10 digits
regardless of what's in between. Caught by a test using realistic
phrasing rather than an artificially adjacent test string.

## Documentation added

- `runbooks/reconciliation.md`, `payment-failure.md`,
  `security-incident.md`, `customer-hardship.md`, `complaints.md`,
  `wind-down.md` — task section 14's explicit runbook requirement,
  each cross-referencing the actual functions across sessions 1–13.
- `security-and-privacy.md` — per-item honest status table for every
  section-13 control.
- `incident-response.md`, `business-continuity.md` — filled in
  (previously listed as "Not implemented yet" in the consolidated
  README), each explicit that the code/runbook exists but a live drill
  has not been run, mapped to the corresponding `launch_gates.py` gate.

## Test results

```
python3 backend/test_security_controls.py        # 33/33 PASS
python3 backend/test_operational_readiness.py    # 16/16 PASS
```

Regression sweep against `test_credit_ledger.py`, `test_ledger_flow.py`,
`test_stripe_collections.py` all passing unmodified.

## Deliberate scope limits this session

- Not wired into any real API endpoint — no `/health` HTTP endpoint,
  no admin UI calling `require_permission()`/`require_mfa_verified()`,
  no actual login flow recording MFA verification.
- No real malware scanner, MFA provider, or managed secret store
  integrated — all documented as integration points, not working
  external services (consistent with this workstream's established
  honesty pattern for Didit/OBP in earlier sessions).
- The runbooks are genuinely useful reference documents but have not
  been exercised as live drills — this maps directly to why
  `incident_response_test_passed` / `business_continuity_test_passed`
  in `launch_gates.py` correctly remain unapproved.
