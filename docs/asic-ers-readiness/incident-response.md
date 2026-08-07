# Incident Response

Task section 13/14 both reference incident response — this is the
single source, cross-referenced from both.

**Runbook:** `runbooks/security-incident.md` — the step-by-step
procedure (contain, assess, notify if applicable, remediate,
post-incident).

**Supporting code:**
- `security_controls.record_data_breach_assessment()` — formal
  assessment record, `notifiable` defaults to `None` (undetermined),
  never `False`, so a real breach can't be silently under-classified.
- `audit_events.get_events_for_object()` / the other per-module audit
  tables (see `audit_events.py`'s documented consolidation gap) — for
  reconstructing what happened during an incident.

## Status

**Not tested as a live drill.** The code paths above are unit-tested
(see `test_security_controls.py`), but "we ran a simulated incident
end-to-end with real people following the runbook" has not happened —
that's an organisational exercise, not something this workstream can
simulate. Classify this item as **Implemented but awaiting external
configuration** (the runbook and supporting code exist; the drill that
proves the runbook actually works operationally hasn't been run) per
the evidence pack's status taxonomy — this maps directly to the
`incident_response_test_passed` launch gate in `launch_gates.py`, which
correctly remains unapproved until that drill happens.

## What triggers this runbook

- A suspected credential leak (this workstream has direct, real
  experience of this: both a GitHub PAT and a Didit API key were pasted
  into chat during earlier sessions and flagged for rotation each time
  — not a hypothetical scenario for this codebase).
- Suspected unauthorised access.
- A vulnerability report from any source.
- A reconciliation exception that turns out to indicate fraud rather
  than a timing/duplicate issue (see `runbooks/reconciliation.md`'s
  escalation path).
