"""
backend/bill_ocr.py
=====================
Free, self-hosted bill data extraction — no API key, no per-call cost,
no external network dependency. This is the concrete implementation
behind `bill_verification.BillSubmission`'s `extraction_confidence` and
extracted-field inputs, using:

- `pdfplumber` for text-layer PDFs (already a repo dependency, used by
  the existing bill-smoothing product's extraction path too) — high
  confidence, exact text, no OCR needed.
- Tesseract OCR (via `pytesseract`) for scanned/photographed bills with
  no text layer — lower confidence, and `bill_ocr.py` reports Tesseract's
  own per-word confidence honestly rather than assuming a fixed number.

This intentionally does NOT call GPT-4o Vision or any other paid API —
see the ASIC ERS readiness evidence pack's guidance on free/sandbox
providers. If a future session wants a commercial OCR provider for
higher accuracy on messy bills, this module's `ExtractionResult` shape
is the contract to match; swapping the extraction backend shouldn't
require changing `bill_verification.py` at all.

This module NEVER decides whether a bill is verified — it only produces
the `extraction_confidence`, guessed `biller_name`, `amount`, `due_date`,
and `biller_reference` that `bill_verification.verify_bill()` then
checks against the allowlist, category list, and duplicate/fraud rules.
Low-confidence or unparseable output here should route to
`manual_review` there, exactly like any other low-confidence extraction
— this module doesn't lower that bar, it's just a different source for
the same input.
"""

import io
import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Optional

logger = logging.getLogger(__name__)

# Below this, treat the extraction as too unreliable to guess fields from
# at all — return confidence 0 and let the caller route to manual review
# rather than present a low-quality guess as if it were reliable.
MIN_USABLE_CONFIDENCE = 0.30

_AMOUNT_PATTERN = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)")
_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b"),
    re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
]
_REFERENCE_PATTERN = re.compile(
    r"(?:reference\s*(?:number|no\.?)?|account\s*(?:number|no\.?))\s*[:#]?\s*([A-Za-z0-9\-]*\d[A-Za-z0-9\-]{2,19})",
    re.IGNORECASE,
)


class BillOcrError(Exception):
    """Raised only for operational failures (corrupt file, unsupported
    format) — never raised just because extraction found nothing useful.
    A poor/empty extraction is a valid, low-confidence RESULT, not an
    error, so the caller can route it to manual review like any other
    ambiguous bill."""


@dataclass
class ExtractionResult:
    raw_text: str
    extraction_confidence: float          # 0.0-1.0
    extraction_method: str                # 'pdf_text_layer' | 'tesseract_ocr' | 'none'
    guessed_amount: Optional[Decimal] = None
    guessed_due_date: Optional[str] = None
    guessed_biller_reference: Optional[str] = None
    biller_name_candidates: list = field(default_factory=list)   # ranked guesses, caller/reviewer picks


def _parse_fields_from_text(text: str, known_billers: Optional[set] = None) -> dict:
    amount = None
    amount_matches = _AMOUNT_PATTERN.findall(text)
    if amount_matches:
        # Bills often show multiple dollar figures (previous balance,
        # this bill, GST) — take the largest as a conservative guess for
        # "total amount due"; this is a heuristic, not authoritative, and
        # low extraction_confidence should route ambiguous cases to
        # manual review regardless of which figure was picked here.
        try:
            amounts = [Decimal(m.replace(",", "")) for m in amount_matches]
            amount = max(amounts)
        except InvalidOperation:
            amount = None

    due_date = None
    for pattern in _DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            due_date = m.group(1)
            break

    reference = None
    m = _REFERENCE_PATTERN.search(text)
    if m:
        reference = m.group(1)

    biller_candidates = []
    if known_billers:
        text_lower = text.lower()
        for biller in known_billers:
            if biller.lower() in text_lower:
                biller_candidates.append(biller)

    return {
        "amount": amount,
        "due_date": due_date,
        "reference": reference,
        "biller_candidates": biller_candidates,
    }


def extract_from_pdf_text_layer(file_bytes: bytes, known_billers: Optional[set] = None) -> ExtractionResult:
    """Tries pdfplumber's text layer first — free, exact, no OCR. Returns
    extraction_confidence=0.0 (not an error) if the PDF has no usable
    text layer, so the caller can fall back to OCR."""
    import pdfplumber

    text_parts = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
    except Exception as e:
        raise BillOcrError(f"could not open file as a PDF: {e}") from e

    text = "\n".join(text_parts).strip()
    if not text:
        return ExtractionResult(raw_text="", extraction_confidence=0.0, extraction_method="none")

    fields = _parse_fields_from_text(text, known_billers)
    # Text-layer extraction is exact (no OCR uncertainty) but the
    # heuristic field-parsing itself can still be wrong — confidence
    # reflects how much of what we looked for was actually found, not a
    # blind 1.0 just because the layer existed.
    found = sum(1 for v in (fields["amount"], fields["due_date"], fields["reference"], fields["biller_candidates"]) if v)
    confidence = 0.7 + 0.075 * found   # base 0.7 for a real text layer, up to 1.0 with all 4 fields found

    return ExtractionResult(
        raw_text=text,
        extraction_confidence=min(confidence, 1.0),
        extraction_method="pdf_text_layer",
        guessed_amount=fields["amount"],
        guessed_due_date=fields["due_date"],
        guessed_biller_reference=fields["reference"],
        biller_name_candidates=fields["biller_candidates"],
    )


def extract_from_image_ocr(file_bytes: bytes, known_billers: Optional[set] = None) -> ExtractionResult:
    """Tesseract OCR fallback for scanned/photographed bills with no PDF
    text layer. Reports Tesseract's own per-word confidence honestly —
    never substitutes a guessed or fixed confidence value."""
    import pytesseract
    from PIL import Image

    try:
        image = Image.open(io.BytesIO(file_bytes))
    except Exception as e:
        raise BillOcrError(f"could not open file as an image for OCR: {e}") from e

    try:
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    except Exception as e:
        raise BillOcrError(f"OCR engine failed: {e}") from e

    words = [w for w in data.get("text", []) if w.strip()]
    confidences = [int(c) for c, w in zip(data.get("conf", []), data.get("text", [])) if w.strip() and int(c) >= 0]
    text = " ".join(words)

    if not confidences:
        return ExtractionResult(raw_text=text, extraction_confidence=0.0, extraction_method="tesseract_ocr")

    avg_confidence = (sum(confidences) / len(confidences)) / 100.0  # Tesseract reports 0-100
    fields = _parse_fields_from_text(text, known_billers)

    return ExtractionResult(
        raw_text=text,
        extraction_confidence=avg_confidence,
        extraction_method="tesseract_ocr",
        guessed_amount=fields["amount"],
        guessed_due_date=fields["due_date"],
        guessed_biller_reference=fields["reference"],
        biller_name_candidates=fields["biller_candidates"],
    )


def extract_bill_data(file_bytes: bytes, known_billers: Optional[set] = None, is_pdf: bool = True) -> ExtractionResult:
    """Top-level entry point: try the free text-layer path first (if
    `is_pdf`), fall back to free local OCR if that finds nothing usable.
    Never calls a paid API. Returns a low-confidence result rather than
    raising when extraction genuinely finds nothing — that's a valid
    signal for the caller to route to manual review, not a failure of
    this function."""
    if is_pdf:
        try:
            result = extract_from_pdf_text_layer(file_bytes, known_billers)
        except BillOcrError:
            result = None
        if result and result.extraction_confidence >= MIN_USABLE_CONFIDENCE:
            return result

    try:
        return extract_from_image_ocr(file_bytes, known_billers)
    except BillOcrError as e:
        logger.warning("OCR extraction failed entirely: %s", e)
        return ExtractionResult(raw_text="", extraction_confidence=0.0, extraction_method="none")
