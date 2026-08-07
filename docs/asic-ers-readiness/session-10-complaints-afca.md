# ASIC ERS Readiness — Session 10 Notes (complaints, IDR, AFCA escalation)

Cut from `main`, independent of other open PRs. Builds task section 10.

## A finding worth stating plainly before the technical summary

**AFCA has no public API.** Checked this directly against AFCA's own
member portal documentation before writing any code: complaint
management for AFCA members is entirely through a web UI (the member
portal, which relaunched 17 June 2024 alongside a new consumer portal
and case management system). There is no REST API, no webhook, no SDK
— nothing documented anywhere for a firm's backend to integrate with
programmatically. The person's AFCA login gives a human access to that
portal to view, respond to, and track cases already lodged there — it
is not something this codebase can call.

Given that, `complaints.py` builds the internal IDR system properly
(the part that genuinely can be built) and treats AFCA escalation as a
**recorded event, not an API call** — `escalate_to_afca()` logs that a
human has escalated a case, with an optional case reference number
entered manually once AFCA issues one via the portal.

## What this session built

- `backend/complaints.py`:
  - `DEFAULT_IDR_TIMEFRAME_POLICY` — sourced from ASIC RG 271 (effective
    5 October 2021), not invented: 30 calendar days standard, 21 days
    for credit default-notice complaints, 45 days for superannuation
    trustee complaints, acknowledgement within 1 business day. Every
    timeframe cites its source; a future policy change is a new
    `IDRTimeframePolicy` object, never an in-place edit.
  - `intake_complaint()` — computes and records both the acknowledgement
    deadline and the response deadline at intake time, using the
    category-appropriate timeframe, with the policy version stamped on
    the complaint so a later timeliness check always uses what was
    actually in force.
  - Status follows AFCA's own model exactly (confirmed from their
    documentation): `status` is only ever `open`/`closed`; `stage`
    separately tracks where in the process a complaint sits.
  - `propose_remedy()` / `approve_remedy()` — maker-checker on any
    remedy involving real compensation, same discipline as every other
    financial decision point in this codebase.
  - `resolve_complaint()` — requires a `root_cause_category` from a
    fixed set, flags whether resolution happened within the response
    window.
  - `needs_delay_notification()` — detects when RG 271's "IDR delay
    notification" requirement is triggered (response deadline passed on
    an open complaint). Detection only — nothing in this codebase sends
    the actual notification yet.
  - `escalate_to_afca()` — records the escalation; calls nothing.
  - `root_cause_report()` — pure aggregation function for management/
    regulatory reporting.
- `backend/migrations/020_complaints_afca.sql` — new tables. **Not
  applied to any live database.**
- `backend/test_complaints.py` — 32 automated checks.

## Test results

```
python3 backend/test_complaints.py   # 32/32 PASS
```

Regression sweep against `test_credit_ledger.py`, `test_ledger_flow.py`,
`test_stripe_collections.py` all passing unmodified. (This branch was
cut before PR #11 merged, so `hardship_collections.py` isn't present
here — independent, no conflict expected at merge time.)

## Deliberate scope limits this session

- Not wired into any real API endpoint or admin UI.
- No actual delay-notification, acknowledgement, or resolution
  communication is sent to a customer — this module tracks the state a
  notification system would react to (the existing app has Resend
  integrated for a different purpose, not wired here).
- No configurable public-holiday calendar for acknowledgement business-
  day calculation — `_add_business_days()` only excludes weekends,
  documented as a conservative simplification (it can only make a
  computed deadline earlier than the true regulatory one, never later).
- No linkage from `hardship_collections.py`'s escalation path (session
  9) into this module's complaint case system — a hardship case
  escalation and a complaint are currently two separate concepts with
  no cross-reference.
