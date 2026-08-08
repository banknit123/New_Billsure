# Regulatory Assumptions

**This document is not legal advice and does not represent that
BillSure's product structure has been legally confirmed.** It records
the assumptions the pilot configuration and launch-gate system were
built against, so an actual Australian legal/compliance review has a
concrete artefact to confirm, correct, or reject.

## Assumptions encoded in `pilot_config.py` / migration 012

- The credit facility is structured as a single continuing credit
  contract per customer, 12-month term, used exclusively to pay
  verified household utility bills (electricity, gas, water,
  telecommunications) to a verified Australian biller.
- Contractual credit limit AUD 2,500 per customer; initial available
  credit AUD 300–500; maximum single bill payment **AUD 1,500** (raised
  from the original AUD 500 — see `change-log.md` and `session-19-
  single-bill-limit-increase.md` for the record of this change and its
  caveats); maximum
  outstanding balance AUD 2,500 per customer; aggregate contractual
  exposure across all pilot customers AUD 62,500 (= 25 customers ×
  $2,500).
- 0% interest, no late fees, no early-repayment fees during the pilot.
- No cash withdrawals, no customer-to-customer transfers.
- Initial geographic area: Victoria only.
- Pilot duration: 6 months, within the ERS testing period.

## Assumptions encoded in `launch_gates.py`

- Both an ASIC ERS financial-services exemption and an ASIC ERS credit
  exemption are required and distinct from each other (two separate
  gates), matching `CLAUDE.md`'s note that "Two ASIC Enhanced
  Regulatory Sandbox notifications (Financial Services + Credit
  Activities) have been drafted separately."
- An ERS notification has its own commencement date, separate from the
  exemption existing — a gate exists for "commencement date reached"
  specifically because a notification can exist but not yet be in
  effect.
- Customer funds, credit-funding capital, and operating funds require
  three legally and operationally distinct bank accounts, not just
  three ledger account codes.

## What this repository will never do

- Draft final legal wording for customer agreements, disclosures,
  Target Market Determinations, or privacy documents — only clearly
  marked templates requiring Australian legal approval.
- State in code, comments, or documentation that this structure is
  legally approved, or that ASIC has approved BillSure.
- Mark any AFCA, insurance, ASIC-status, banking, or legal-opinion item
  as complete without evidence supplied from outside this repository.

## Open questions for actual legal review

- **Whether the AUD 1,500 max single-bill payment (raised from AUD 500
  in session 19) is consistent with whatever was actually lodged in
  BillSure's ASIC ERS notification, if one has already been
  submitted.** This figure was originally set in the very first task
  brief this workstream was built from, without this repository having
  visibility into the actual notification document's content. Raised
  based on a business observation (winter utility bills routinely
  exceed $500 for larger households), directed by whoever requested the
  change — but the consistency check against the real ASIC filing is
  explicitly outside what this codebase or this session can verify.
  Confirm with whoever manages the ASIC relationship before treating
  this as final.
- Whether AUD 2,500 with a 12-month term and 0% interest/fees falls
  within the intended ERS credit-activities exemption's numerical and
  product-type limits as currently understood, or whether the exemption
  imposes different or additional constraints not reflected here.
- Whether "verified Australian utility biller only" as the sole payment
  recipient type is sufficient to keep the facility outside
  scope of other licensing regimes (e.g. payment systems regulation)
  beyond what's assumed here.
- Confirmation of which entity (if not BillSure directly) needs to hold
  the customer-funds account, and under what regulatory capacity.
