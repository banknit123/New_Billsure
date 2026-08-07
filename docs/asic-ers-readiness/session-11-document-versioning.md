# ASIC ERS Readiness — Session 11 Notes (document versioning + acceptance)

Cut from `main`, independent of other open PRs. Builds task section 11.

## What this session built

- `backend/document_versioning.py`:
  - `DOCUMENT_TYPES` — all 14 required document types from the task
    spec, exactly matched by the 14 template files (see below).
  - `create_document_version()` — immutable versions (a "change" is
    always a new version, never an edit), SHA-256 content hash,
    defaults to `is_template=True` with an explicit warning stamped on
    unless a caller deliberately marks real, legally-approved content.
  - `approve_document_version()` — maker-checker (approver ≠ creator),
    and automatically archives whatever was previously active for that
    document_type — there is only ever one approved/active version per
    type, enforced at the DB layer too via a partial unique index.
  - `record_customer_acceptance()` — refuses to accept anything other
    than the currently-approved version; a customer can never be
    recorded as having "accepted" a draft or a superseded version.
  - `reproduce_accepted_document()` — returns the exact content a
    customer accepted, by content hash, regardless of what's since been
    published. Re-verifies the stored content still hashes to what was
    recorded at acceptance time and refuses to serve it if not — a real
    integrity check, not just a lookup.
  - `requires_reacceptance()` — only a version explicitly flagged
    `is_material_change=True` forces re-acceptance; a typo/formatting
    fix creates its own version (so its own history exists) but does
    not, by itself, force every existing customer to re-accept
    anything.
- `backend/migrations/021_document_versioning.sql` — new tables, with a
  DB-level partial unique index enforcing "at most one approved version
  per document_type" independent of the application-layer check. **Not
  applied to any live database.**
- `backend/test_document_versioning.py` — 26 automated checks, including
  a genuine tampering-detection test (corrupt stored content after
  acceptance, confirm `reproduce_accepted_document()` refuses to serve
  it) and a real material-vs-non-material re-acceptance distinction
  (both directions tested, not just one).
- `docs/asic-ers-readiness/document-templates/` — 14 structural
  templates, one per document type, each headed with an explicit
  "REQUIRES AUSTRALIAN LEGAL APPROVAL" warning and containing only
  section headings and bracketed placeholders — no legal wording
  anywhere, per the task's explicit instruction not to draft final
  legal text.

## Test results

```
python3 backend/test_document_versioning.py   # 26/26 PASS
```

Regression sweep against `test_credit_ledger.py`, `test_ledger_flow.py`,
`test_stripe_collections.py` all passing unmodified.

## Deliberate scope limits this session

- Not wired into any real API endpoint, admin UI, or customer portal —
  `get_active_document()` is what a "view/download my documents"
  endpoint would call, but no such endpoint exists yet.
- The 14 templates are structural only. Real content requires the
  external dependency this whole workstream keeps flagging: qualified
  Australian legal counsel, tracked in PR #3's `regulatory-
  assumptions.md`/`external-dependencies.md`.
- No mandatory-acceptance GATE — `requires_reacceptance()` is a correct,
  tested check function, but nothing in this codebase yet blocks a
  customer from continuing to use the product while a required
  re-acceptance is outstanding. Wiring that enforcement point is a
  natural next step once real API endpoints exist.
