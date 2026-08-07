# ASIC ERS Readiness — Session 12 Notes (audit trail + regulatory reporting)

Cut from `main`, with `complaints.py` cherry-picked from PR #12
(`7fce73a`) since `regulatory_reports.py`'s complaints/AFCA report reuses
`complaints.root_cause_report()` directly rather than reimplementing it.

## What this session built

- `backend/audit_events.py` — a unified append-only audit schema for
  the event categories the task spec requires that had nowhere to go
  yet: login, security, administrative access, and data exports
  specifically (several other categories — onboarding, credit
  assessment, launch-gate changes, configuration changes — already have
  dedicated audit tables from earlier sessions; see the honest gap note
  below). Every event requires actor, role, action, object_type,
  object_id, and source — there is no way to record an event missing
  the fields that make an audit trail actually useful for
  investigation. `redact_for_export()` strips a denylist of
  PII-carrying field names (name, DOB, email, phone, address, bank
  details, government IDs) from `previous_state`/`new_state`,
  recursively, without mutating the original record — the raw audit
  trail keeps real values for internal investigation; only the exported
  copy is redacted.
- `backend/regulatory_reports.py` — all 10 report types from task
  section 12, each a **pure aggregation function** over already-fetched
  data (no DB access of its own), same pattern as
  `complaints.root_cause_report()`. Every report's inputs are shaped so
  they never carry a customer's name or other directly-identifying
  field in the first place — this is a property of what
  onboarding.py/bill_verification.py/etc. actually store (state, not
  address; employment_status, not employer name), not a redaction step
  bolted on afterward. `ers_end_of_test_report()` assembles the other
  nine into the single comprehensive submission ASIC's ERS process
  expects.
- `backend/migrations/022_audit_events.sql` — one new table. **Not
  applied to any live database.**
- `backend/test_audit_events_and_regulatory_reports.py` — 32 automated
  checks.

## An honest gap, stated plainly rather than glossed over

Several modules built across sessions 1–11 already have their own
append-only audit tables (`onboarding_audit_log`, `launch_gate_audit_
log`, `complaint_audit_log`, plus the pre-existing generic `audit_log`
table driven by `audit_trigger_func()` since migration 002).
`audit_events.py` does NOT consolidate or migrate those into itself —
doing so would be a genuine, non-trivial refactor across roughly 8
files built across 11 sessions, out of scope for this one.
`get_events_for_object()` only searches the new `audit_events` table; a
caller wanting a truly complete cross-system history of one object
today still has to separately check the other four audit tables too.
Recorded here as a real, load-bearing limitation — not hidden in a
"still to do" footnote.

## Test results

```
python3 backend/test_audit_events_and_regulatory_reports.py   # 32/32 PASS
```

Regression sweep against `test_credit_ledger.py`, `test_ledger_flow.py`,
`test_stripe_collections.py` all passing unmodified. (`test_complaints.py`
itself wasn't cherry-picked — only the `complaints.py` module dependency
was — so it's expectedly absent on this branch.)

## Deliberate scope limits this session

- Not wired into any real API endpoint or admin UI — nothing calls
  `audit_events.record_event()` from an actual login/admin-access/
  export code path yet, since none of those exist as real endpoints in
  this codebase.
- No scheduled job generates any of these reports periodically or on a
  regulatory-reporting cadence.
- The audit-table consolidation gap above remains open.
