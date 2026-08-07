# Document Templates — Index

Fourteen structural templates, one per document type
`document_versioning.DOCUMENT_TYPES` manages. Every file here contains
section headings and bracketed placeholders only — **no legal
wording**, per the top-level task's explicit instruction not to draft
final legal text.

These map 1:1 to task section 11's required disclosure/agreement list:

| Document type key | Template file |
|---|---|
| `ers_disclosure` | `ers_disclosure.md` |
| `credit_guide` | `credit_guide.md` |
| `credit_contract` | `credit_contract.md` |
| `repayment_schedule_disclosure` | `repayment_schedule_disclosure.md` |
| `non_cash_payment_facility_terms` | `non_cash_payment_facility_terms.md` |
| `product_disclosure_material` | `product_disclosure_material.md` |
| `target_market_determination` | `target_market_determination.md` |
| `privacy_policy` | `privacy_policy.md` |
| `privacy_collection_notice` | `privacy_collection_notice.md` |
| `customer_funds_disclosure` | `customer_funds_disclosure.md` |
| `fees_and_remuneration_disclosure` | `fees_and_remuneration_disclosure.md` |
| `complaints_and_afca_information` | `complaints_and_afca_information.md` |
| `hardship_information` | `hardship_information.md` |
| `exit_and_wind_down_disclosure` | `exit_and_wind_down_disclosure.md` |

## How these relate to `backend/document_versioning.py`

These templates are NOT loaded into the versioning system automatically
— they exist as a starting structural reference for whoever drafts the
real content (qualified Australian legal counsel). Once real content
exists for a document type:

1. Call `create_document_version(document_type, real_content_bytes,
   effective_date, created_by, is_material_change, is_template=False)`
   — setting `is_template=False` once it's genuinely legally-approved
   content, not a placeholder.
2. Have a distinct person call `approve_document_version()` (maker-
   checker).
3. The approved version becomes what `get_active_document()` serves and
   what `record_customer_acceptance()` will accept against.

Every version created via `create_document_version()` defaults to
`is_template=True` unless explicitly told otherwise — the system fails
toward "this is still a template" rather than silently trusting content
is final.
