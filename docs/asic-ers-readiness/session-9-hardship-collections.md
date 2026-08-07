# ASIC ERS Readiness — Session 9 Notes (hardship, collections, repayment schedules)

Cut from `main` after all prior sessions merged. Builds task section 9
(repayments, hardship, and collections). Genuine, live dependency on
`credit_ledger.py`/`pilot_config.py` — `record_repayment()` posts real
ledger journals via `credit_ledger.repay_credit()`, so this is tested
against the real ledger, not a stub.

## What this session built

- `backend/hardship_collections.py`:
  - `generate_repayment_schedule()` — splits principal into equal
    monthly installments, final installment absorbing any rounding
    remainder so the sum always equals principal exactly.
  - `record_repayment()` — records a repayment AND posts it to the
    credit ledger in the same call. A ledger rejection (e.g. attempted
    overpayment) leaves the installment completely untouched.
  - `record_failed_repayment()` — marks a failed attempt. Does nothing
    else: no fee (the installment table has no fee column at all —
    structurally, not just by convention), no automatic escalation.
  - `reschedule_installment()` — policy-bounded (max 3 reschedules),
    no charge.
  - `request_hardship()` — **has zero payment-status gating.** No
    function anywhere in this module checks outstanding balance,
    payment history, or account standing before accepting a hardship
    request — verified directly by testing it against a customer with
    zero payment history and separately against a customer with an
    active failed installment.
  - `pause_collections()` / `is_collection_paused()` — maker-checker
    pause with an expiry.
  - `propose_hardship_arrangement()` / `approve_hardship_arrangement()`
    — maker-checker, and independently rejects any arrangement carrying
    a nonzero fee or interest amount (a second, independent check on
    top of pilot_config's pilot-wide 0%/$0 enforcement).
  - `escalate_hardship_case()` — the only function that moves a case
    toward "escalated," always requires a human caller and a documented
    reason; nothing in this module calls it automatically.
- `backend/migrations/019_hardship_collections.sql` — new tables. The
  `repayment_installments` table has **no fee or interest columns at
  all** — not zeroed, structurally absent, so no future code change
  could accidentally introduce one without a schema change first. Not
  applied to any live database.
- `backend/test_hardship_collections.py` — 30 automated checks.

## A real bug found and fixed while testing

`record_repayment()`'s first version compared each individual payment
against the installment's scheduled amount to decide "paid" vs.
"partial." That's wrong: a customer paying an installment off across
two partial payments (e.g. $150 now, $183.33 later) would have BOTH
payments individually be less than the scheduled amount, so the
installment would stay marked "partial" forever even once fully paid.
Fixed by tracking cumulative `amount_paid` on the installment and
comparing the running total against the scheduled amount. Caught
because the test used a realistic two-partial-payment sequence rather
than a single lump payment — worth noting as a case where the test
design itself (not just the assertion) mattered for finding the bug.

## Test results

```
python3 backend/test_hardship_collections.py   # 30/30 PASS
```

Full regression sweep, all passing unmodified: `test_credit_ledger.py`,
`test_pilot_payment_flow.py`, `test_onboarding_and_responsible_lending.py`,
`test_bill_verification_and_permitted_use.py`, `test_ledger_flow.py`,
`test_stripe_collections.py`.

## Deliberate scope limits this session

- Not wired into any real API endpoint or admin UI.
- No customer-facing notifications are actually sent (task section 9
  asks for "customer notifications" — this module records state changes
  an eventual notification system would react to, but doesn't send
  anything itself; the existing app has Resend integrated for a
  different purpose and could be wired in later).
- No scheduled job calls `is_collection_paused()` — it's a correct,
  tested check function with no current caller, same pattern as
  session 4's exposure-monitoring functions.
- Escalation doesn't yet connect to anything downstream (no AFCA/
  complaints linkage — that's task section 10, not built yet).
