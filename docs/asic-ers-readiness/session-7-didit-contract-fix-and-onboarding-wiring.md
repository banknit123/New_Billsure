# ASIC ERS Readiness — Session 7 Notes (Didit real API contract + onboarding wiring)

Cut from `main` (post-merge of PRs #3–#8). A real Didit API key was
provided this session and used to drive a genuine documentation check —
not a live call, since this sandbox's network egress is restricted to
package-registry domains and doesn't include Didit's API host — but the
key made it worth verifying the request contract properly rather than
leaving it as an untested guess.

## What this session found and fixed

`identity_verification.py`'s original implementation (session 6) was
built without live access to Didit's docs and got two things wrong,
confirmed against Didit's actual published API reference this session:

1. **Wrong auth header.** Used `Authorization: Bearer <key>`; Didit
   actually uses `x-api-key: <key>`.
2. **Missing required field.** `POST /v3/session/` requires a
   `workflow_id` for a workflow that must already exist (built in the
   Didit console or via `POST /v3/workflows/`) — the original code sent
   a `features` list that isn't part of the real request contract at
   all.

Both are now fixed, gated behind a new `DIDIT_WORKFLOW_ID` environment
variable (fails closed — clear error — if unset, same posture as
`DIDIT_API_KEY`). The session-creation response parsing was also made
more defensive: Didit's own docs show the response shape varying
between `session_id` and `session_url` across different example
snippets, so the code now handles both instead of assuming one.

**This is still not a live-tested integration** — the request/response
contract is now verified against real documentation instead of guessed,
which is a meaningfully different (and better) state, but nobody has
actually called `verification.didit.me` from working code yet. That
requires running this from an environment with real network access.

## What this session wired

- `onboarding.start_identity_verification(application_id)` — starts a
  real (or explicitly-gated mock) verification session and records the
  session reference on the application row. Does not touch
  `identity_verification_status` yet.
- `onboarding.apply_identity_verification_result(application_id)` —
  fetches the current result for that session and updates
  `identity_verification_status` to match. This is now the only code
  path in `onboarding.py` that moves that field from `pending` once a
  session has been started — the provider result is the source of
  truth from that point on.
- `backend/migrations/017_onboarding_identity_verification_session.sql`
  — one additive nullable column. **Not applied to any live database.**
- `backend/test_onboarding_identity_verification_wiring.py` — 8 checks,
  including the one that matters most: a failed verification-start call
  leaves `identity_verification_status` completely untouched rather than
  defaulting to something that could be mistaken for success.

## Test results

```
python3 backend/test_onboarding_identity_verification_wiring.py   # 8/8 PASS
python3 backend/test_identity_verification.py                     # 8/8 PASS (still mock-only, contract fixed)
python3 backend/test_onboarding_and_responsible_lending.py        # 34/34 PASS (unaffected)
```

Pre-existing `test_ledger_flow.py`/`test_stripe_collections.py` confirmed
still passing.

## To actually finish this (needs a human, and real network access)

1. In the Didit console (business.didit.me), create a KYC workflow and
   note its `workflow_id`.
2. Set `DIDIT_API_KEY` and `DIDIT_WORKFLOW_ID` in an environment that can
   reach `verification.didit.me` — this sandbox cannot.
3. Run `start_identity_verification()` against a real application and
   confirm a real `session_url` comes back that a browser can actually
   open and complete.
4. Only after that succeeds should `identity_verification.py`'s status
   move from "implemented but awaiting external configuration" to
   "implemented and tested" in the evidence pack.

## Security note

The Didit API key provided in this session was pasted directly into the
conversation. It was used only to justify checking the real API contract
via documentation (not embedded anywhere, not committed to any file, not
used in a live call from this sandbox since none was possible). As with
the GitHub PAT used earlier in this workstream: **rotate/regenerate this
key** if it's meant to stay private, since anything typed into a chat
should be treated as potentially exposed.
