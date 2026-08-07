# Runbook: Payment / Disbursement Failure

**When to use:** `pilot_payment_flow.pay_verified_bill()` raises a
`PaymentFlowError`, or a disbursement's status
(`pilot_bill_disbursements.status`) shows `failed`.

## 1. Identify where in the flow it failed

`pilot_payment_flow.py`'s ordering guarantee means the failure point
tells you exactly what has and hasn't happened:

- **Failed at the permitted-use check** (`payment_permitted_use.
  PermittedUseError`): no money moved, nothing to reverse. Fix the
  underlying issue (wrong biller match, amount over a limit, prohibited
  payment type) and retry, or reject the bill via `bill_verification.
  record_manual_review_decision()` if it shouldn't be retried.
- **Failed at the credit draw** (`credit_ledger.CreditLedgerError`):
  no money moved (the ledger call itself raised, so no journal was
  posted), bill remains `verified`/undisbursed. Common causes:
  insufficient available credit, outstanding-balance cap reached,
  single-bill limit. If the customer needs more room, that requires a
  `responsible_lending.py` reassessment before any limit change — see
  `can_increase_limit()` — never a manual ledger edit.
- **Failed after the draw succeeded but before `create_disbursement()`
  completed:** this should not be possible given the current code
  (both calls are sequential, non-transactional across two different
  storage backends in this codebase's design — flag this as a real gap
  if it's ever observed, since it would mean a ledger journal exists
  with no corresponding disbursement record). Treat as a P1 if seen.

## 2. If a real-world payment execution later fails

(Applies once real bank/BPAY execution is wired in — not yet built for
the pilot credit ledger; the trust ledger's `payment_runs.py` has an
equivalent flow already.)

1. Do NOT edit the existing `credit_journal_entries`/`credit_ledger_
   postings` rows. Post a reversing journal
   (`credit_ledger.repay_credit()` with the same amount, referencing
   the original disbursement) to undo the credit draw.
2. Update the disbursement's status to `failed` or `reversed`.
3. Notify the customer (no notification channel is wired up yet for
   the pilot — this is currently a manual step).
4. If the customer was relying on this payment reaching a biller
   before a due date, check whether they need hardship support
   (`hardship_collections.request_hardship()` — remember, no payment-
   status gating applies, so this is always available to them
   regardless of the failure).

## 3. Post-incident

1. Record a `complaints.py` case if the customer was materially
   affected and raises a complaint.
2. If the failure indicates a systemic issue, record it against
   `regulatory_reports.payment_activity_report()`'s `by_status`
   breakdown for trend visibility.
