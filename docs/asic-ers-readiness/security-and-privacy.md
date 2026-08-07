# Security and Privacy

Covers task section 13. Honest status per item — see the classification
legend in `README.md`.

| Control | Status | Notes |
|---|---|---|
| Role-based access control | Implemented and tested | `security_controls.ROLE_PERMISSIONS` — 5 roles, explicit least-privilege matrix, no blanket admin superuser shortcut (tested directly). **Now wired into `pilot_api.py` as real HTTP middleware (session 16)** — every non-public endpoint enforces a specific permission, proven over real HTTP (e.g. a customer key is refused 403 from activating credit). |
| Least privilege | Implemented and tested | Same as above — admin does not automatically inherit every permission; each is granted explicitly per role. |
| Multifactor authentication for administrators | Partially implemented | `security_controls.requires_mfa()`/`require_mfa_verified()` correctly gate admin/compliance-reviewer actions and are tested, **and are now enforced over real HTTP in `pilot_api.py`** — an admin key issued without `mfa_verified=True` is refused 403 from privileged actions, proven directly. No real MFA provider (TOTP/SMS) is integrated — `mfa_verified` on an API key is operator-asserted trust (set via `issue_pilot_api_key.py --mfa-verified` only after genuinely confirming identity out-of-band), not independently verified by the software. |
| Secure session management | Not implemented in this workstream | `utils/auth.py`'s existing JWT with 4-hour expiry (prior session's work) is what's live; no session-revocation mechanism beyond expiry/full secret rotation. |
| Encryption in transit | External dependency | Depends on the actual deployment's TLS termination — not something this codebase configures. |
| Encryption at rest | Implemented (prior session) | `utils/auth.py`'s Fernet `encrypt_field()`/`decrypt_field()`, fails closed if `ENCRYPTION_KEY` unset. |
| Secrets management | Partially implemented | Every new module in this workstream reads credentials from environment variables (`DIDIT_API_KEY`, `OBP_API_KEY`, etc.), never hard-coded — consistent with the existing app's pattern. No managed secret store (e.g. AWS Secrets Manager, GCP Secret Manager) is integrated. |
| Input validation | Partially implemented | Validated at the boundary of every new module this workstream built (e.g. `onboarding.evaluate_eligibility()`, `bill_verification.verify_bill()`) — not a separate generic layer. |
| Rate limiting | Not implemented in this workstream | `slowapi` is a prior-session dependency in `requirements.txt`; not extended to any new pilot endpoint since none exist yet. |
| CSRF, XSS, injection, access-control protections | External to this workstream | Properties of `server.py`'s actual FastAPI configuration, which this workstream did not modify. |
| Secure file-upload validation | Implemented and tested | `security_controls.validate_file_upload()` — size limit, extension allowlist, magic-byte content verification (catches extension spoofing), tested against real spoofed/oversized/empty files. |
| Malware-scanning integration point | Implemented but awaiting external configuration | `validate_file_upload()` always returns `malware_scan_status='pending'` — the documented integration point, not a working scanner. No AV/malware-scanning provider is integrated. |
| Dependency and secret scanning | Not implemented in this workstream | A CI/CD pipeline concern, not application code. |
| Security headers | Not implemented in this workstream | Prior-session PRD notes claim these exist on the live app; not verified or extended by this workstream. |
| Structured security logging | Implemented and tested | `security_controls.redact_sensitive()` / `PiiRedactingLogFilter` — tested against real TFN-shaped, BSB/account-shaped, and credential-shaped strings in free-text messages, not just structured fields. |
| Data-retention controls | Implemented and tested | `security_controls.MINIMUM_RETENTION_YEARS` = 7, sourced from AML/CTF Act 2006 (Cth) and ASIC AFSL record-keeping expectations — cited, not invented. `compute_retention_until()`/`can_delete_now()` tested directly, including that deletion is refused years before the retention period elapses. |
| Account deletion + lawful-record-retention workflow | Implemented and tested | `request_account_deletion()` — never immediately deletes; always computes and enforces the retention boundary first. |
| Backup and restore procedures | Partially implemented | `operational_readiness.record_backup_verification()` distinguishes "backup recorded" from "restore actually tested" — bookkeeping only, no storage backend integrated. |
| Incident-response runbook | Implemented | `runbooks/security-incident.md`. |
| Data-breach assessment workflow | Implemented and tested | `security_controls.record_data_breach_assessment()` — `notifiable` defaults to `None` (undetermined), never `False`, forcing a deliberate human call. |

## What this workstream never logs

`security_controls.redact_sensitive()` is designed to catch, in free
text: AU Tax File Numbers, AU Medicare numbers, BSB/account number
combinations, and credential-shaped strings (`password=`, `api_key=`,
`secret=`, `token=`). This is a defence-in-depth layer, not a
substitute for simply not putting sensitive data into log messages —
every module built across this workstream logs identifiers (customer_id,
bill_id, session_id) rather than names, income figures, or bank
details in its own log statements.
