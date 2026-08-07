# ASIC ERS Readiness — Session 16 Notes (API key authentication + authorization)

Cut from `main` after session 15 merged. Adds the auth layer flagged as
missing at the end of the last session — "no auth/authz middleware on
the API itself yet."

## What this session built

- `backend/pilot_auth.py` — a simple, operator-issued API key scheme
  (deliberately not full customer self-service login — see the module
  docstring for why that's the right scope for a private testing
  deployment right now). Raw keys are shown once at issuance and never
  stored; only a SHA-256 hash persists. Revocation is permanent — a
  revoked key never verifies again even though its hash still matches.
- Extended `security_controls.ROLE_PERMISSIONS` **additively** — new
  permission strings for the endpoints this session wires up, without
  removing or altering any existing permission grant. Verified directly
  against `test_security_controls.py`'s specific negative assertions
  (e.g. admin still lacks `acknowledge_complaint`) before and after.
- `backend/pilot_api.py` — every non-public endpoint now requires
  `Authorization: Bearer <key>`, checked via a `require(permission)`
  dependency factory that enforces both the specific permission AND
  (for MFA-required roles) that the key carries `mfa_verified=True` —
  reusing `security_controls.py`'s existing, independently-tested
  functions rather than reimplementing the logic.
  - `GET /health`, `GET /pilot/launch-gates/status`, and
    `GET /pilot/documents/{type}` remain public — status/disclosure
    endpoints, appropriately unauthenticated.
  - `POST /pilot/identity/webhook` keeps its own real authentication
    (HMAC signature verification) rather than requiring an API key too
    — it's called by Didit's servers, not a human/system actor.
  - The balance endpoint has bespoke logic: a customer can view their
    OWN balance, staff roles can view any customer's — this couldn't be
    expressed as a single static permission since it depends on the
    path parameter matching the caller's identity.
- `backend/migrations/024_pilot_api_keys.sql` — new table. Only
  `key_hash` is ever stored — a leaked database dump exposes no usable
  keys. **Not applied to any live database.**
- `backend/issue_pilot_api_key.py` — a CLI tool for issuing the first
  (and subsequent) keys, deliberately NOT an HTTP endpoint, to avoid
  the chicken-and-egg problem of "what credential authorizes creating
  the first credential."
- `backend/test_pilot_auth.py` — 14 checks on the auth module itself.
- `backend/test_pilot_api.py` — rewritten with 27 checks, now covering
  the full auth/authz matrix over real HTTP: missing auth (401),
  invalid key (401), wrong role for an endpoint (403), missing MFA
  confirmation on a privileged action (403), a customer correctly
  blocked from viewing another customer's balance (403), and —
  importantly — proof that **passing authentication does not bypass
  the regulatory launch-gate check**: an MFA-verified admin key with
  the correct `process_payment` permission still gets a 403 from the
  payment endpoint, because zero launch gates are approved. Auth and
  the regulatory gate are two independent layers, neither able to
  substitute for the other.

## Test results

```
python3 backend/test_pilot_auth.py    # 14/14 PASS
python3 backend/test_pilot_api.py     # 27/27 PASS (rewritten for auth)
```

Full regression sweep of all 11 other test suites (including
`test_security_controls.py`, to confirm the additive RBAC extension
didn't break any existing assertion) — all passing unmodified.

## Deliberate scope limits this session

- Still not full customer self-service authentication (signup,
  password reset, etc.) — appropriate scope for now per `pilot_auth.
  py`'s own docstring, but a real gap before any public consumer
  product launch.
- No HTTP endpoint for issuing or revoking keys — entirely a CLI/
  operator process for now. Building an authenticated "admin issues a
  key for a new case worker" endpoint is a reasonable next step once
  there's a first admin key to authenticate that request with.
- `mfa_verified` on a key is operator-asserted, not independently
  verified — no real TOTP/SMS provider is integrated (same documented
  gap as `security_controls.py` itself).
- Rate limiting on the auth endpoints (e.g. against key-guessing) is
  not implemented — `pilot_auth.verify_api_key()` does a single hash
  lookup per request with no throttling.
