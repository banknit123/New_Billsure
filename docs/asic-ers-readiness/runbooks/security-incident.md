# Runbook: Security Incident

**When to use:** suspected unauthorised access, a leaked credential, a
vulnerability report, or anything that could constitute a data breach.

## 1. Contain

1. If a credential is suspected compromised (API key, database
   password, JWT signing secret): rotate it immediately. This session's
   own workstream has direct experience of this — a GitHub PAT and a
   Didit API key were both pasted into a chat conversation during
   earlier ASIC ERS readiness sessions and flagged for rotation each
   time; treat any credential that has ever appeared outside its
   intended secret store as compromised, regardless of whether misuse
   is confirmed.
2. If unauthorised access is suspected against a specific account,
   revoke active sessions for that account (`utils/auth.py`'s JWT
   validation — a full session-revocation mechanism is not yet built;
   currently, only waiting for the 4-hour JWT expiry or rotating
   `JWT_SECRET` — which invalidates every session, not just the
   compromised one — are the only actual containment options).
3. Do not delete logs, database rows, or any other evidence while
   containing — capture first, remediate after.

## 2. Assess

1. Call `security_controls.record_data_breach_assessment()` with a
   description, the affected data categories, and a severity — this
   creates the formal assessment record. `notifiable` should be left
   `None` until a deliberate determination is made (never default it to
   False).
2. Determine what data was actually exposed. Cross-reference
   `audit_events.get_events_for_object()` and the other audit tables
   (`onboarding_audit_log`, `launch_gate_audit_log`, `complaint_audit_
   log`, the ledger's `audit_log`) for the affected object(s) — see
   `audit_events.py`'s own documented gap that these aren't unified
   yet, so checking all of them individually is currently necessary.
3. Determine whether this meets the threshold for the Notifiable Data
   Breaches (NDB) scheme under the Privacy Act 1988 (Cth) — likely
   serious harm to any individual whose personal information was
   involved. This determination needs a person with actual authority
   to make it, informed by legal advice if there's any ambiguity — this
   runbook does not make that call for you.

## 3. Notify (if determined notifiable)

1. OAIC notification (if NDB scheme applies) — statutory timeframe
   applies from the point the entity becomes aware, or ought reasonably
   to have become aware, of the breach; confirm the exact obligation
   with legal counsel rather than relying on a cached figure here.
2. Affected individuals, per the NDB scheme's requirements.
3. If the breach involves the credit facility specifically, consider
   whether it also needs to be reflected in an AFCA complaint if a
   customer raises one as a result — see `complaints.py` and the
   `complaints-afca.md` note that AFCA has no API; any AFCA-side action
   here is still portal-only.

## 4. Remediate

1. Fix the root cause.
2. Update `security_controls.record_data_breach_assessment()`'s status
   once remediation is complete.
3. Add a regression test proving the specific vulnerability is closed,
   following this workstream's established pattern (every session in
   this evidence pack that found a real bug — the bill-OCR reference-
   number regex, the hardship cumulative-payment bug, the BSB-account
   redaction regex — fixed it AND added the test that would have caught
   it, not just a manual verification).

## 5. Post-incident

1. Feed the incident into `regulatory_reports.security_incidents_
   report()` for trend visibility.
2. Consider whether this affects `launch_gates.py`'s
   `production_security_assessment_passed` gate status.
