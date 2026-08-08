# ASIC ERS Readiness — Session 19 Notes (max single-bill payment raised $500 → $1,500)

Cut from `main`. A deliberate business/product decision, not a bug fix
or a routine build session — recorded with the same rigor as any other
change, per this workstream's established pattern.

## What changed and why

`max_single_bill_payment` — one of the pilot's hard ceilings, enforced
in three layers (a Python constant in `pilot_config.py` explicitly
documented as requiring its own review to change, a dataclass
validator, and a live Postgres `CHECK` constraint) — was raised from
**AUD 500 to AUD 1,500**, directed explicitly: winter utility bills
routinely exceed $500 for larger households, and the pilot's original
$500 ceiling would have forced those customers into partial-bill
workarounds or simply been unable to serve them.

## The caveat, stated plainly (not glossed over)

This $500 figure originated in the very first task brief this entire
17-session workstream was built from — it was never derived from an
actual ASIC ERS notification document this codebase has ever seen.
Whether BillSure's real, lodged (or drafted) ASIC notification specifies
$500, some other figure, or nothing this specific at all is genuinely
outside what this repository or this session can verify. Raising a
pilot limit in software while an ASIC sandbox notification still
specifies the old figure would mean operating outside the pilot's
notified scope — a real compliance issue, not a hypothetical one. This
was flagged directly to whoever requested the change, with an explicit
ask to confirm consistency with whoever manages the actual ASIC
relationship before treating this as final. Recorded as an open
question in `regulatory-assumptions.md`, not silently assumed resolved.

## What was changed

- `pilot_config.HARD_MAX_SINGLE_BILL_PAYMENT`: `500.00` → `1500.00`,
  plus the corresponding error message text.
- `backend/migrations/025_raise_single_bill_limit_to_1500.sql` — drops
  and recreates the `CHECK` constraint on `pilot_config_versions` to
  match. **Not applied to any live database by this commit** — applying
  it to the actual sandbox project (and activating a new pilot config
  version reflecting the new limit) is a separate, explicit step (see
  below), not bundled silently into a code merge.
- No other module needed a code change — `credit_ledger.py`,
  `payment_permitted_use.py`, and `pilot_payment_flow.py` all already
  read `max_single_bill_payment` dynamically from the active pilot
  config rather than hard-coding it, confirmed by grep before making
  any change.
- Internal consistency check: $1,500 remains comfortably under both the
  $2,500 per-customer contractual limit and the $2,500 outstanding-
  balance cap — no other ceiling needed adjustment for this change to
  make sense.

## Test results

Only one test needed updating — `test_credit_ledger.py`'s single-bill-
limit rejection test used a $600 draw (correctly rejected under the old
$500 cap, incorrectly *accepted* once the cap became $1,500). Updated
to a $1,600 draw, which correctly still exceeds the new $1,500 ceiling.

```
python3 backend/test_credit_ledger.py   # 28/28 PASS (1 test updated)
```

Full regression sweep of all 17 test suites in this workstream, run
individually: all passing, only the one intentional update above.

## Applying this to the live sandbox deployment

Not done automatically by this merge — deliberately a separate,
explicit step:

1. Apply `migrations/025_raise_single_bill_limit_to_1500.sql` to the
   live `billsure-pilot-sandbox` Supabase project.
2. Propose and activate a new pilot config version (version 2) with
   `max_single_bill_payment=1500.00`, keeping every other field
   identical to version 1 — through the same maker-checker discipline
   `pilot_config.propose_config_version()`/`approve_document_version()`-
   style functions already enforce (distinct proposer/approver), even
   though no HTTP endpoint exists yet to do this over the API — still a
   real gap flagged in earlier sessions.
