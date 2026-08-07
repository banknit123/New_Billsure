# Deploying the Pilot API to a Real HTTP Endpoint

Covers `backend/pilot_api.py` specifically — the new HTTP layer that
lets you exercise the pilot journey (onboarding, bill upload/OCR,
payment, hardship, complaints) from a browser or `curl`, over real
HTTPS, on a real domain. This is **not** the existing bill-smoothing
product (`server.py`) — see `DEPLOYMENT.md` for that.

**Nothing in this guide activates real money or real customers.**
`launch_gates.is_production_authorized()` returns `False` with zero
gates recorded — confirmed directly in `test_pilot_api.py`, where
`POST /pilot/bills/{id}/pay` correctly returns `403` over real HTTP.
Deploying this is safe; it does not change that.

## Step 0 — a NEW Supabase project (do this first, once)

The pilot migrations (012–023) have never been applied to the live
`EasyBillsPay` project, and must not be. Create a fresh, free Supabase
project dedicated to this pilot:

1. supabase.com → New Project → free tier is enough for pilot volume.
2. Open the SQL editor, run `backend/migrations/012_*.sql` through
   `023_*.sql` **in numeric order**.
3. Note the Project URL and the `service_role` key (Project Settings →
   API) — these become `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` below.

## Step 1 — push this branch to GitHub

If you're reading this from the PR, merge it (or push `main` directly)
so the hosting platform has something to pull from.

## Step 2 — deploy the backend (Render, free tier)

1. render.com → New → Web Service → connect your GitHub account →
   select the `New_Billsure` repo.
2. Render will detect `render.yaml` in the repo root automatically
   (it's included in this PR) and pre-fill the service config —
   confirm it's using `Dockerfile.pilot-api`.
3. Under Environment, set the values `render.yaml` left blank
   (`sync: false`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — from Step 0.
   - `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET` — once
     you've created a Didit account/workflow/webhook destination (see
     `docs/asic-ers-readiness/session-8-didit-webhook-rebuild.md` for
     exact steps). Leave unset for now if you just want to test the
     mock-mode identity path locally-equivalent behaviour — but note
     `ALLOW_MOCK_IDENTITY_VERIFICATION` is set to `"false"` in
     `render.yaml` deliberately; **never set it `"true"` on a public
     deployment**, since anyone who can reach the URL could then
     "verify" an identity without a real check.
   - `OBP_API_KEY` — same idea for bank verification, once you have an
     Open Bank Project sandbox account.
4. Click Deploy. Render builds `Dockerfile.pilot-api` and gives you a
   URL like `https://billsure-pilot-api.onrender.com`.
5. Confirm it's alive: `curl https://billsure-pilot-api.onrender.com/health`
   should return `{"overall_healthy": true, ...}`.

**Free-tier note:** Render's free web services sleep after 15 minutes
of no traffic and take ~30-60 seconds to wake on the next request.
Fine for you testing manually; not something to point real users at.

## Step 3 — point a subdomain at it (recommended over the bare domain)

Don't point `www.billsure.com.au` itself at pilot-in-progress code —
use a subdomain so the live bill-smoothing site (if/when deployed) and
this pilot API can't collide:

1. At your domain registrar's DNS settings for `billsure.com.au`, add:
   ```
   Type: CNAME
   Name: pilot-api
   Value: billsure-pilot-api.onrender.com
   ```
2. In Render's dashboard, under the service's Settings → Custom
   Domains, add `pilot-api.billsure.com.au` and follow its verification
   step. Render provisions a TLS certificate automatically (Let's
   Encrypt) once DNS propagates — usually minutes, sometimes longer
   depending on your registrar's TTL.
3. Once live: `curl https://pilot-api.billsure.com.au/health`.

## Step 4 — (optional) a minimal frontend, on Vercel

`pilot_api.py` is a JSON API with no UI of its own. If you want a
clickable frontend rather than `curl`/Postman:

1. The interactive API docs FastAPI generates automatically
   (`https://pilot-api.billsure.com.au/docs`) are a genuinely usable
   starting point — you can execute every endpoint from that page
   directly, including the file upload for bill photos, without
   building anything else first.
2. For a real frontend later: a small React/Next.js app calling this
   API, deployed to Vercel (vercel.com → Import Project → same GitHub
   repo, set the framework/root directory once that frontend exists),
   with its own subdomain (`pilot.billsure.com.au`) via the same CNAME
   pattern as Step 3.

## Testing the real-life scenario once deployed

Walk Jane Dummy's journey for real, against your new URL:

```bash
BASE=https://pilot-api.billsure.com.au

# 1. Confirm production is correctly NOT authorized yet (expected).
curl $BASE/pilot/launch-gates/status

# 2. Apply.
curl -X POST $BASE/pilot/onboarding/apply -H "Content-Type: application/json" -d '{
  "user_id": "user-real-test-001", "identity_verification_status": "verified",
  "age_confirmed": true, "residential_state": "VIC", "bank_account_verified": true,
  "income_amount": "5200", "income_frequency": "monthly", "employment_status": "full_time",
  "recurring_living_expenses": "2800", "existing_debts_and_bnpl": "0",
  "requested_credit_purpose": "electricity", "requirements_and_objectives": "test",
  "utility_bill_ownership_verified": true,
  "consent_types_accepted": ["privacy", "identity_check", "affordability_check", "fraud_check"]
}'

# 3. Activate credit (use the application id from step 2's response).
curl -X POST $BASE/pilot/onboarding/<application_id>/activate-credit -H "Content-Type: application/json" -d '{
  "prepared_by": "assessor1", "approved_by": "compliance1",
  "contractual_limit": "2500.00", "active_customer_count": 0, "current_aggregate_contractual_exposure": "0"
}'

# 4. Upload a real bill photo (a genuine photo from your phone works here).
curl -X POST $BASE/pilot/bills/upload \
  -F "customer_id=user-real-test-001" -F "customer_name_on_account=Your Name" \
  -F "category=electricity" -F "file=@/path/to/a/real/bill/photo.jpg"

# 5. Attempt payment -- expect 403, this is correct.
curl -X POST $BASE/pilot/bills/<bill_id>/pay -H "Content-Type: application/json" \
  -d '{"customer_id": "user-real-test-001", "requested_by": "admin1"}'
```

Step 5 returning `403` with a message about launch gates is the system
working correctly, not a bug — real money is not supposed to move
until the actual regulatory gates are satisfied, which is a legal/
organisational process (see `docs/asic-ers-readiness/external-
dependencies.md`), not something this deployment can shortcut.
