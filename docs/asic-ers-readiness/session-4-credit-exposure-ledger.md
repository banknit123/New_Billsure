# ASIC ERS Readiness — Session 4 Notes (pilot config integrated into a credit exposure ledger)

Cut from `main`, with `pilot_config.py` and migration 012 cherry-picked
in from PR #3 (`b97d259`) because this session's work is a **direct,
intentional dependency** on `pilot_config` — unlike the onboarding/
responsible-lending/bill-verification sessions, which deliberately took
config values as plain parameters to stay decoupled, this is the actual
integration point the roadmap called for, so it has to import the real
module. When PR #3 merges, this branch's cherry-picked commit will
become a duplicate of an already-merged commit — Git/GitHub will handle
that as an empty merge for that specific commit; no manual dedup should
be needed, but re-check at merge time.

## What this session built

- `backend/credit_ledger.py` — a **new, separate** double-entry credit
  sub-ledger (distinct from `ledger.py`'s existing customer-trust
  ledger, on purpose — see the module docstring for why mixing the two
  would work against the "customer funds cannot finance credit
  advances" invariant rather than for it). This is where pilot_config's
  numbers actually become enforcement:
  - `activate_customer_credit_account()` calls
    `pilot_config.check_customer_cap()` and
    `pilot_config.check_aggregate_exposure()` before creating any
    account, and reads the per-customer contractual-limit ceiling from
    `pilot_config.get_active_config()` rather than a hard-coded number.
  - `draw_credit()` reads `max_single_bill_payment` and
    `max_outstanding_balance` from the active config on every call.
  - `get_exposure_snapshot()` / `check_exposure_thresholds()` implement
    the real-time monitoring and 70/80/90% warning thresholds (task
    section 8), using `pilot_config.warning_level()` so the same
    thresholds apply consistently everywhere.
- `backend/migrations/015_credit_sub_ledger.sql` — new tables
  (`credit_ledger_accounts`, `credit_journal_entries`,
  `credit_ledger_postings`), a `credit_account_balances` view, and —
  notably — **database-level enforcement of the customer cap and
  aggregate exposure cap via deferred constraint triggers**, closing the
  check-then-insert race window that exists in the pure application-
  layer check under concurrent requests. Balanced-journal enforcement
  mirrors migration 002's approach exactly. **Not applied to any live
  database.**
- `backend/test_credit_ledger.py` — 28 automated checks, all passing.
  Critically, these tests exercise `pilot_config` and `credit_ledger`
  *together* (activate a real config version, then try to breach its
  limits through the ledger functions) rather than testing either module
  in isolation, so they actually prove the integration works, not just
  that each piece works alone.

## Test results

```
python3 backend/test_credit_ledger.py
... 28/28 PASS
ALL CHECKS PASSED
```

Pre-existing `test_ledger_flow.py` and `test_stripe_collections.py`
confirmed still passing, unmodified, on this branch.
(`test_pilot_config_and_launch_gates.py` wasn't cherry-picked since it
also covers `launch_gates.py`, out of scope here — `pilot_config.py` is
directly exercised by the new test file instead.)

## Deliberate scope limits this session

- `draw_credit()` is not yet called from `payment_permitted_use.
  create_disbursement()` (PR #5) — the two currently exist independently.
  Wiring them together (a disbursement should draw credit, not just
  create a `queued` row with no funding source) is the natural next
  integration step.
- No scheduled job calls `get_exposure_snapshot()` /
  `check_exposure_thresholds()` periodically yet, and no admin
  dashboard/notification path exists for `has_critical_breach()` — the
  functions exist and are correct, but nothing calls them outside tests.
- Repayment collection (task section 9 — schedules, hardship, failed
  repayments) is out of scope here; `repay_credit()` only records that a
  repayment amount cleared, assuming the caller already confirmed the
  real-world payment the same way `ledger.record_bill_payment_cleared()`
  does for the trust ledger.
- The external bank account actually funding `CREDIT_FUNDING` (a real
  ADI account holding BillSure's own capital, distinct from the
  customer-funds account) remains an external dependency — see PR #3's
  `external-dependencies.md`.
