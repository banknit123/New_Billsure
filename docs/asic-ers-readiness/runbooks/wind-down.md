# Runbook: Wind-Down

**When to use:** the pilot ends (planned, at the 6-month ERS window), a
mandatory launch gate expires or fails and isn't remediated
(`launch_gates.is_production_authorized()` returns False), or a
decision is made to cease the credit facility for any other reason.

## 1. Confirm the trigger

`launch_gates.existing_customers_route()` returns `'wind_down'`
whenever `is_production_authorized()` is False — this is automatic,
not a manual switch. Confirm which specific gate(s) triggered it via
`launch_gates.get_all_gate_statuses()`.

## 2. What must remain available (this is the whole point of wind-down)

Per the launch-gate module's own design intent: existing customers must
**never** lose access to statements, complaints, or hardship support
just because new lending has stopped. Concretely:

- `complaints.intake_complaint()` and the rest of the complaints
  workflow must keep working.
- `hardship_collections.request_hardship()` must keep working — it has
  no dependency on `launch_gates` or production-authorization status at
  all, so this should already be true structurally; confirm it during
  wind-down testing rather than assuming.
- `document_versioning.get_active_document()` must keep serving
  existing customers their documents (credit contract, hardship
  information, etc.) — this also has no dependency on launch-gate
  status.
- Existing outstanding balances continue to be trackable
  (`credit_ledger.get_outstanding_principal()`) and repayable
  (`hardship_collections.record_repayment()` /
  `credit_ledger.repay_credit()`) — repayment must keep working during
  wind-down; only NEW lending stops.

## 3. What must stop

- `credit_ledger.activate_customer_credit_account()` — new customers.
- `credit_ledger.draw_credit()` / `pilot_payment_flow.pay_verified_bill()`
  — new disbursements. Note: neither function currently checks
  `launch_gates.is_production_authorized()` directly (see the "explicitly
  NOT done" notes across earlier sessions — nothing in this codebase is
  wired into `launch_gates` yet). Wiring that check in is a prerequisite
  for wind-down actually working as designed, not yet complete.

## 4. Customer communication

1. Serve the `exit_and_wind_down_disclosure` document type
   (`document_versioning.py`) — draft real content via qualified legal
   counsel before wind-down is ever real; the current version is a
   structural template only.
2. Explain timeframes, what happens to their existing balance, and how
   to continue accessing support.

## 5. Final reporting

Generate `regulatory_reports.ers_end_of_test_report()` covering the
full pilot period, using every sub-report (`customer_numbers_and_
demographics_report()`, `credit_exposure_report()`, etc.) with real
data — this is the artefact task section 12 exists to produce for this
exact moment.

## 6. Data retention

Do not delete any customer or transaction data on wind-down.
`security_controls.request_account_deletion()` /
`compute_retention_until()` still apply — the 7-year AML/CTF and ASIC
AFSL retention requirement does not end when the pilot does.
