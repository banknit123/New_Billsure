# ASIC ERS Readiness — Session 8 Notes (Didit webhook rebuild against a confirmed integration reference)

Built on top of PR #9 (`feature/asic-ers-didit-live-wiring`), which this
session's work supersedes and extends — a full Didit integration
reference document was provided this session, confirming the real
contract precisely (not inferred from search results this time). This
branch rebuilds `identity_verification.py` against that confirmed
contract rather than patching session 7's version incrementally.

## What was still wrong after session 7, now fixed

Session 7 corrected the auth header and added `workflow_id`, but still
had two real mistakes, now caught against the authoritative reference:

1. **Wrong response field name.** Session creation returns `url`, not
   `session_url` as session 7 guessed — the fallback parsing logic that
   tried to extract a session id from `session_url` was reading a field
   that doesn't exist in the real response.
2. **Incomplete status handling.** Only 5 of the 10 real literal session
   statuses were mapped (`Approved`, `Declined`, `In Review`,
   `In Progress`, `Not Started`). The real set also includes
   `Awaiting User`, `Resubmitted`, `Abandoned`, `Expired`, and
   `Kyc Expired` — all now mapped, with `Kyc Expired` deliberately
   mapped to `failed` (not `verified`) since a previously-approved
   user's expired KYC should not be trusted going forward.

## What's new this session

- **Webhooks are now the authoritative path**, per the reference
  document's explicit guidance — the polling-only approach from
  sessions 6–7 is now clearly documented as secondary/fallback.
- `identity_verification.py` gained:
  - `verify_webhook_signature()` — the exact X-Signature-V2 scheme
    (shorten whole-number floats → sort keys recursively → JSON-encode
    with unescaped Unicode → HMAC-SHA256 → constant-time compare),
    with 300-second timestamp freshness (replay protection).
  - `parse_webhook_event()` — structured parsing of a verified webhook
    body, deliberately separate from verification (verify, then parse,
    matching the reference's explicit ordering).
  - `start_verification_session()` now returns a full
    `VerificationSession` (session_id, url, session_token, status)
    instead of a bare session id string, since a caller building the
    actual onboarding UI needs the `url` to redirect/embed.
- `onboarding.py` gained `apply_identity_verification_webhook()` — the
  authoritative path: verifies the signature, checks idempotency against
  a new `didit_webhook_events` table (Didit retries deliveries up to
  twice), and only then updates `identity_verification_status`. Returns
  `None` for an already-processed duplicate rather than reapplying it.
  `apply_identity_verification_result()` (polling) is kept as an
  explicitly-documented secondary path.
- `backend/migrations/018_didit_webhook_events.sql` — one new table for
  webhook idempotency tracking. **Not applied to any live database.**
- `backend/test_identity_verification_webhooks.py` — 12 checks. Notably,
  the HMAC signing in this test is an **independent reimplementation**
  of the canonicalisation scheme, written separately from the module's
  own `_canonicalize()`/`_shorten_floats()`/`_sort_keys()`, specifically
  so the test isn't just checking the module against itself — a real,
  from-scratch HMAC round trip either matches or it doesn't.
- Two existing test files (`test_identity_verification.py`,
  `test_onboarding_identity_verification_wiring.py`) updated for the new
  `VerificationSession` return type, plus new webhook-path coverage
  added to the latter (correctly-signed webhook applies the update,
  duplicate delivery is a no-op, invalid signature is rejected).

## Test results

```
python3 backend/test_identity_verification_webhooks.py             # 12/12 PASS
python3 backend/test_identity_verification.py                       # 9/9 PASS (updated for new return type)
python3 backend/test_onboarding_identity_verification_wiring.py     # 13/13 PASS (updated + webhook coverage added)
```

Full regression sweep, all passing unmodified:
`test_onboarding_and_responsible_lending.py`, `test_bill_ocr.py`,
`test_biller_allowlist.py`, `test_ledger_flow.py`,
`test_stripe_collections.py`.

## What's genuinely proven vs. still unverified

**Genuinely proven, real cryptography, zero network dependency:** the
webhook signature verification. `test_identity_verification_webhooks.py`
signs real payloads with a real, independently-implemented HMAC and
confirms the module's verification logic accepts valid signatures,
rejects tampered bodies, rejects wrong secrets, and rejects stale
timestamps. This is genuinely tested, not "implemented but unverified."

**Still unverified — needs real network access:** `POST /v3/session/`,
`GET /v3/session/{id}/decision/`, and receiving an actual webhook
delivery from Didit's servers all remain untested from this sandbox.
The request/response contract is now sourced from an authoritative
integration reference rather than search-inferred, which is real
progress, but "the code matches the documented contract" and "the code
has been run against the live service" are still two different claims.

## To actually finish this (needs a human, real network access, and a public HTTPS endpoint)

1. Create a Didit account (`POST /auth/v2/programmatic/register/` +
   `verify-email/`, or via the console) if not already done, and get
   `DIDIT_API_KEY`.
2. Create a KYC workflow (`POST /v3/workflows/` or console → Workflows)
   and get `DIDIT_WORKFLOW_ID`.
3. Register a webhook destination (`POST /v3/webhook/destinations/`,
   requires a public HTTPS URL — this sandbox has none) and get
   `DIDIT_WEBHOOK_SECRET`.
4. Run `start_identity_verification()` against a real application from
   an environment with real network access, complete a test session,
   and confirm the webhook actually arrives and
   `apply_identity_verification_webhook()` applies it correctly.
5. Only after that succeeds should this move from "implemented against
   a verified contract" to "implemented and tested."
