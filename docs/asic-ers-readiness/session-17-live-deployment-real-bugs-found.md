# ASIC ERS Readiness — Session 17 Notes (real deployment, real bugs found and fixed)

Cut from `main`. Directly produced by actually deploying `pilot_api.py`
to Render against a real Supabase sandbox project and walking a real
person through testing it live — the first session in this whole
workstream where the code met a genuine production environment, not
just an in-memory fake database.

## What actually happened this session

We deployed `pilot_api.py` to `https://billsure-pilot-api.onrender.com`,
connected to a brand-new Supabase sandbox project
(`billsure-pilot-sandbox`), and walked through the deployment guide
live. In the process, we found and fixed **three real, previously
undiscovered issues** — none of which any of the 30 test suites across
16 prior sessions had caught, because none of them ever touched a real
Postgres database:

### 1. Missing audit-trigger prerequisite (deployment issue, not code)

Every pilot migration (012–024) attaches an audit trigger via
`audit_trigger_func()`, which is defined in the *original* app's
`schema.sql` — not in any pilot migration itself. A brand-new sandbox
project doesn't have that function or its backing `audit_log` table.
Applied a prerequisite migration (the corrected, jsonb-based version
from the original app's migration 005) before the 13 pilot migrations
would work. This is a real gap in the deployment guide, now fixed
there too.

### 2. Wrong Supabase key type (deployment issue, not code)

`SUPABASE_SERVICE_KEY` on Render was accidentally set to the `anon`
key instead of `service_role`. This was hard to diagnose because
`/health`'s reachability check succeeded either way — `anon` can still
query tables without erroring, Row Level Security just silently
returns zero rows for everything. Confirmed by decoding the JWT payload
directly (`"role":"anon"` vs `"role":"service_role"`) rather than
guessing. Worth noting for the deployment guide: `/health` returning
`healthy: true` does NOT prove the service role key is correct, only
that *some* valid key is configured.

### 3. Non-UUID customer/user identifiers reach the database uncaught (real code bug, now fixed)

Every `customer_id`/`user_id` column across the entire pilot schema
(migrations 013–021) is typed `UUID`. `pilot_api.py`'s Pydantic request
models typed these fields as plain `str` with no validation, so a
non-UUID value (e.g. `"user-live-test-001"`, used throughout every
prior session's in-memory-DB tests) reached Postgres, got rejected with
an opaque database error, and surfaced through this API's generic
exception handler as an unhelpful `"internal error"` (500) — giving no
indication of what was actually wrong. **Fixed properly**: added
`_validate_uuid_field()`, applied via Pydantic `field_validator`s on
every request model carrying a `customer_id`/`user_id`
(`ApplyRequest`, `PayBillRequest`, `HardshipRequest`, `ComplaintRequest`,
`AcceptDocumentRequest`) and manual checks on the two non-Pydantic
parameters (`credit_balance`'s path parameter, `upload_bill`'s form
field). A malformed id is now a clear `422` naming the exact field,
never a mystery `500`.

## Why no automated test caught this before a real deployment

Every test suite in this workstream (17 sessions, 30+ files) uses the
same in-memory fake `supabase_db` — which is fast, free, and correctly
tests business logic, but never enforces real Postgres column types,
constraints beyond what's manually re-implemented in the fake, or RLS
behavior. This is a genuine, structural limitation of that testing
strategy, not a one-off oversight — worth flagging honestly rather than
treating this bug as a fluke. A real deployment against a real database
is the only thing that actually exercises the schema's own constraints.

## Test results

```
python3 backend/test_pilot_api.py   # 30/30 PASS (was 27, +3 new UUID validation checks)
```

Full regression sweep: `test_pilot_auth.py`,
`test_end_to_end_dummy_customer_journey.py`, `test_security_controls.py`,
`test_credit_ledger.py`, `test_ledger_flow.py`, `test_stripe_collections.py`
all passing unmodified.

## Live deployment status as of this session

- Real Supabase sandbox project created (`billsure-pilot-sandbox`,
  `bhqgjdogpvqbxvdwvqte`), all 13 pilot migrations + 1 audit
  prerequisite applied and verified (35 tables/views confirmed via
  direct schema query).
- Real Render web service deployed (`billsure-pilot-api`, free tier),
  connected to that Supabase project with correct `service_role`
  credentials.
- A real pilot config version activated in the live database (25
  customers, $2,500 limit, VIC-only, matching the ERS-notified limits
  exactly).
- Successfully submitted a real onboarding application over real HTTPS,
  from a real PowerShell client, and got back a real
  `eligibility_outcome: "eligible"` — the deterministic eligibility
  engine, running live, for the first time outside a test file.
- First admin API key issued directly in the live database.

## Deliberate scope limits this session

- Deployment guide (`docs/asic-ers-readiness/deployment-guide.md`) has
  NOT yet been updated with the audit-prerequisite step or the
  `anon`-vs-`service_role` warning discovered this session — should be
  done as a follow-up so the next person deploying doesn't hit the same
  two issues blind.
- Only the onboarding → credit activation step of the full journey was
  exercised live; bill upload/OCR/payment (blocked by launch gates, as
  designed) were not yet walked through against this live deployment.
- No custom domain/subdomain configured yet — testing so far is against
  the raw `onrender.com` URL.
