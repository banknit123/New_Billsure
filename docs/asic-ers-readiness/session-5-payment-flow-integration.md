# ASIC ERS Readiness — Session 5 Notes (end-to-end payment flow: verify → permit → draw → disburse)

Cut from `feature/asic-ers-credit-exposure-ledger` (session 4), with
`bill_verification.py` and `payment_permitted_use.py` (+ their test)
cherry-picked in from PR #5 (`a032645`, `ad0a945`, `468a9d7`). This
branch is the first one that actually needs all four modules
(`pilot_config`, `credit_ledger`, `bill_verification`,
`payment_permitted_use`) together, so it carries all of them rather than
staying decoupled — that decoupling was the right call for the earlier
sessions, but this session's entire point is the integration itself.

## What this session built

- `backend/pilot_payment_flow.py` — `pay_verified_bill()`, the one
  function that actually joins the previously-independent pieces flagged
  as a gap in sessions 3 and 4:
  1. Loads the bill fresh and confirms `verified` + not already
     disbursed.
  2. Loads the customer's credit account and confirms it's active.
  3. Runs `payment_permitted_use.validate_disbursement()` — can reject
     without touching the ledger at all (prohibited type, amount over
     the bill or single-bill limit, recipient mismatch).
  4. Only if that passes: calls `credit_ledger.draw_credit()` — the
     actual money-moving step, enforcing available credit and the
     outstanding-balance cap. If this raises, nothing further happens —
     the bill stays `verified`/undisbursed, retryable later.
  5. Only if the draw succeeds: calls `payment_permitted_use.
     create_disbursement()`, now passing the real credit journal id, so
     every disbursement is traceably backed by an actual ledger entry.
- `payment_permitted_use.create_disbursement()` gained an optional
  `credit_journal_id` parameter (default `None`, fully backward
  compatible — confirmed by re-running the original 31-check test file
  unmodified after the change).
- `backend/migrations/016_link_disbursement_to_credit_journal.sql` —
  one additive nullable column + index. **Not applied to any live
  database.**
- `backend/test_pilot_payment_flow.py` — 18 integration checks that
  specifically exercise all four modules together: full happy path
  (verify → activate credit → pay → outstanding principal actually
  increases in the ledger, not just a queued row), double-payment
  blocked, unverified-bill payment blocked before touching the ledger,
  and — the case that matters most — an available-credit breach is
  blocked with **zero side effects** (bill stays verified/undisbursed,
  ledger balance unchanged), and the same bill becomes payable again
  after a repayment frees up room.

## Test results

```
python3 backend/test_pilot_payment_flow.py
... 18/18 PASS
ALL CHECKS PASSED
```

Full regression sweep on this branch, all passing unmodified:
`test_credit_ledger.py`, `test_bill_verification_and_permitted_use.py`,
`test_ledger_flow.py`, `test_stripe_collections.py`.

## Deliberate scope limits this session

- `pay_verified_bill()` is not yet called from any real API endpoint.
- No handling yet for what happens to a bill that's blocked at step 4
  (insufficient credit) beyond "stays verified, can be retried" — no
  customer-facing notification, no automatic hardship-flow trigger, no
  admin queue for "verified bills that couldn't be paid." That's really
  task section 9 (hardship/collections) territory and remains open.
- No reversal/refund path if a disbursement needs to be undone after
  `create_disbursement()` succeeds (e.g. the actual BPAY/bank payment
  later fails) — `credit_ledger.py` has `repay_credit()` for a completed
  repayment but nothing yet for "this specific disbursement failed,
  reverse its journal." That's a real gap for section 6/9 to close.
- Still no scheduled/admin surface calling
  `credit_ledger.get_exposure_snapshot()` in response to actual payment
  activity from this flow — the monitoring functions exist and are
  correct (session 4) but this session didn't add anywhere new that
  calls them.
