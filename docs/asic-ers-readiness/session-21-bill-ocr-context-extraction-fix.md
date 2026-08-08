# ASIC ERS Readiness — Session 21 Notes (fixing the real amount/date extraction bug, not just containing it)

Cut from `main`. Direct follow-up to session 18, using the actual bill
PDF attached to this conversation to diagnose the root cause precisely,
rather than continuing to patch around it.

## The two exact bugs, confirmed from the real bill's text

1. **Amount**: the bill's own fine print reads *"Call 1300 559 873 to
   pay by MasterCard, Visa or American Express for payment amounts up
   to $10,000"* — a card-payment limit disclaimer, unrelated to what's
   owed. The original `_parse_fields_from_text()` took the *largest*
   dollar figure anywhere in the document as its guess for the amount
   due. $10,000 > $303.38 (the real total), so the disclaimer won.
2. **Due date**: the real due date is printed as `"25 Feb 2025"` (day +
   month name + year). The original date regex only recognised numeric
   formats (`DD/MM/YYYY`, `YYYY-MM-DD`), so it never matched the real
   date at all — it fell back to the first numeric-looking date
   anywhere in the document, which turned out to be `27/11/2024`, the
   *billing period start date* from an unrelated tariff table on page 2
   of the bill.

Both are genuine logic bugs in the extraction heuristic, not OCR noise
— session 18's fix (the `max_plausible_amount` sanity check) was a
downstream safety net that correctly prevented any money risk, but
never addressed why the extraction itself was wrong. This session fixes
the actual cause.

## The fix

`bill_ocr.py`'s `_parse_fields_from_text()` now tries **context-
anchored** extraction first — searching for the amount near labels like
"Amount due" / "Total amount due" / "Total current charges", and the
due date near "Bill due date" / "Due date" — before falling back to the
old "biggest number" / "first date-shaped string" heuristics, which are
kept only as a last resort for bills that don't use a recognisable
label at all.

Also added: a month-name date pattern (`"25 Feb 2025"` style), which
the original code had no way to match under any circumstance.

## Test results

`test_bill_ocr.py` gained a new synthetic PDF generator,
`make_synthetic_pdf_bill_with_decoys()`, which reconstructs the exact
document structure that caused the real bug: a genuine amount and due
date, PLUS the same two decoys (an unrelated larger dollar figure, an
unrelated earlier numeric date) — a genuine regression test for a
genuine production bug, not a hypothetical one.

```
python3 backend/test_bill_ocr.py   # 17/17 PASS (was 15, +2 new checks)
```

Full regression sweep: `test_bill_verification_and_permitted_use.py`,
`test_pilot_api.py`, `test_end_to_end_dummy_customer_journey.py` all
passing unmodified.

## Honest remaining limitation

`extraction_confidence` still doesn't distinguish a context-anchored
match from a fallback-heuristic match — both currently contribute to
the same confidence score in the same way. A bill with no recognisable
"Amount due" label at all will still fall back to the less reliable
heuristic, with no confidence penalty for that fact. Session 18's
`max_plausible_amount` sanity check in `bill_verification.py` remains
the backstop for that case — this session fixes the specific failure
mode found live, not every theoretical one.
