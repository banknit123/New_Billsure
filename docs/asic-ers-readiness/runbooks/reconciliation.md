# Runbook: Reconciliation Exception

**When to use:** `reconciliation.py`'s daily run (or the pilot credit
ledger's future equivalent — not yet built as a scheduled job) produces
one or more unmatched/partially-matched exceptions, or
`regulatory_reports.reconciliation_exceptions_report()` shows a
growing `currently_open` count.

## 1. Triage

1. Pull the exception list. For the existing trust ledger, this is
   `reconciliation.py`'s exception records; for the pilot credit
   ledger, compare `credit_ledger.get_exposure_snapshot()`'s aggregate
   drawn exposure against the sum of `credit_ledger_postings` (they
   should be identical by construction — a mismatch here indicates a
   bug, not just a timing difference, and should be escalated
   immediately as a P1, not worked as a routine exception).
2. For each exception, classify: **timing** (a transaction that will
   clear on the next feed), **duplicate**, **missing**, or **genuine
   discrepancy**.
3. Do not disburse new credit (`credit_ledger.draw_credit()` /
   `pilot_payment_flow.pay_verified_bill()`) while a **genuine
   discrepancy** exception is open and unresolved on the account(s)
   involved — this mirrors the existing `reconciliation.
   approve_payment_run()`'s refusal to approve while an exception is
   open.

## 2. Investigate

1. Confirm the bank-side figure via whatever bank-feed/adapter is
   actually connected (still a stub for the pilot credit ledger —
   `_fetch_external_trust_balance()`-equivalent has not been built for
   `credit_ledger.py` yet; this step is currently manual).
2. Confirm the ledger-side figure by summing `credit_ledger_postings`
   for the account(s) in question.
3. Identify which side is wrong, or whether both are correct but
   describing different points in time (a timing exception).

## 3. Resolve

1. **Timing exception:** re-run reconciliation after the next feed;
   close if it clears on its own.
2. **Duplicate:** identify the duplicate posting/transaction, record a
   reversing journal (never edit or delete the original posting — see
   `credit_ledger.py`'s immutability discipline).
3. **Genuine discrepancy:** escalate to a second reviewer (maker-
   checker applies here too — the person investigating should not be
   the sole person who signs off the resolution). Document root cause.
4. Record the resolution and get independent approval before marking
   the exception resolved, per task section 7's requirement.

## 4. Post-resolution

1. Confirm the exception no longer appears in
   `regulatory_reports.reconciliation_exceptions_report()`'s open count.
2. If the root cause indicates a systemic issue (not a one-off), open
   a linked item in `complaints.py`'s root-cause tracking if it
   affected a customer, or a data-breach assessment
   (`security_controls.record_data_breach_assessment()`) if it
   involved unauthorised access.
