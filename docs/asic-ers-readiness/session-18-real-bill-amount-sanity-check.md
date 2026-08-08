# ASIC ERS Readiness — Session 18 Notes (real bill upload finds a real OCR extraction bug)

Cut from `main`. Directly produced by uploading a genuine bill (a real
household electricity bill from EnergyAustralia, PDF) to the live
deployment and finding a real extraction error.

## What happened

Uploaded a real bill through `/pilot/bills/upload`. Two results:

1. **Duplicate detection worked correctly** — re-uploading the same
   file was cleanly rejected as `DUPLICATE_BILL`, confirmed live.
2. **Amount extraction was wrong** — the bill's amount was extracted as
   `$10,000.00`, with `extraction_confidence: 1.0`. The `raw_text_
   preview` showed a long garbled digit sequence
   (`"1320022201021130102120000101220222011001001121000233302133130111313"`)
   — almost certainly a barcode or reference number that the amount-
   extraction heuristic in `bill_ocr.py` picked up as if it were a
   dollar figure, likely because the PDF uses a custom/embedded font
   that `pdfplumber` can extract byte-accurately but whose text doesn't
   map to fully readable characters. `extraction_confidence` reflects
   how many expected *fields* were found, not whether the *values* are
   plausible — a bill can score maximum confidence while containing a
   nonsense amount.

Critically: **this could never have cost anyone money**, even before
today's fix. The pilot's `max_single_bill_payment` is $500 — any
attempt to actually pay a $10,000 bill would have been blocked at
`payment_permitted_use.validate_disbursement()` regardless of what bill
verification decided. This is the layered design (verify → permitted-
use check → credit draw, each independently enforcing limits) working
as intended even when one layer's extraction logic got something wrong
— real evidence for the defense-in-depth approach used throughout this
workstream, not just a claim in a docstring.

## What was fixed anyway

Even though the failure mode was already contained downstream, an
auto-"verified" $10,000 bill sitting in the system is still wrong and
worth catching earlier, closer to the source. Added
`max_plausible_amount` to `bill_verification.verify_bill()` /
`submit_and_verify_bill()`:

- If a submitted amount exceeds this bound, it now routes to
  `manual_review` (never a hard reject — a bill really could
  legitimately be large in some future non-pilot context, and the
  amount could also be a genuine, if unusual, real bill) with a new
  reason code, `AMOUNT_EXCEEDS_PLAUSIBLE_RANGE`.
- `pilot_api.py`'s `upload_bill()` now passes the active pilot config's
  `max_single_bill_payment` as this bound — not hard-coded, sourced
  from the same versioned config every other limit in this system
  reads from.
- Fully backward compatible: the parameter defaults to `None`
  (disabled), so every prior test and caller that doesn't pass it
  behaves exactly as before — confirmed by running the full existing
  test suite unmodified before adding new tests.

## Test results

```
python3 backend/test_bill_verification_and_permitted_use.py   # 34/34 PASS (was 31, +3 new checks)
```

New checks: an amount far exceeding the plausible bound goes to manual
review (not auto-verified), an amount within bound is unaffected, and
with no bound passed at all the check is silently skipped (proving
backward compatibility, not just asserting it).

Full regression sweep: `test_pilot_api.py`,
`test_end_to_end_dummy_customer_journey.py`, `test_pilot_payment_flow.py`,
`test_credit_ledger.py`, `test_ledger_flow.py` all passing unmodified.

## Honest scope note

This fix catches the *symptom* (an implausible amount) at the
verification boundary — it does not fix the *underlying* OCR
limitation (garbled text extraction from custom-font PDFs). A more
thorough fix would improve `bill_ocr.py`'s amount-extraction heuristic
itself, e.g. by validating that a candidate amount appears near
currency-context keywords ("Amount Due", "Total") rather than taking
the largest dollar-shaped match anywhere in the text, or falling back
to full OCR (Tesseract) even when a text layer exists if the extracted
text looks garbled. Not attempted here — the sanity-check approach was
judged sufficient given the layered protection already in place
downstream, and is a smaller, more clearly-correct change than
rewriting the extraction heuristic under time pressure mid-live-test.
