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

The pilot migrations (012–024) have never been applied to the live
`EasyBillsPay` project, and must not be. Create a fresh, free Supabase
project dedicated to this pilot:

1. supabase.com → New Project → free tier is enough for pilot volume.
2. **Before the pilot migrations**, run this prerequisite — every pilot
   migration attaches an audit trigger via `audit_trigger_func()`,
   which lives in the *original* app's `schema.sql`, not in any pilot
   migration. A brand-new project doesn't have it yet:
   ```sql
   CREATE TABLE IF NOT EXISTS audit_log (
       id BIGSERIAL PRIMARY KEY,
       table_name TEXT NOT NULL,
       operation TEXT NOT NULL,
       record_id TEXT,
       user_id TEXT,
       old_data JSONB,
       new_data JSONB,
       created_at TIMESTAMPTZ DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
   CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

   CREATE OR REPLACE FUNCTION audit_trigger_func()
   RETURNS TRIGGER AS $$
   DECLARE
       uid TEXT;
   BEGIN
       IF TG_TABLE_NAME = 'users' THEN
           uid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
       ELSIF TG_OP = 'DELETE' THEN
           uid := (to_jsonb(OLD) ->> 'user_id');
       ELSE
           uid := (to_jsonb(NEW) ->> 'user_id');
       END IF;
       IF TG_OP = 'INSERT' THEN
           INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
           VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, uid, to_jsonb(NEW));
           RETURN NEW;
       ELSIF TG_OP = 'UPDATE' THEN
           INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data, new_data)
           VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, uid, to_jsonb(OLD), to_jsonb(NEW));
           RETURN NEW;
       ELSIF TG_OP = 'DELETE' THEN
           INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data)
           VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, uid, to_jsonb(OLD));
           RETURN OLD;
       END IF;
       RETURN NULL;
   END;
   $$ LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp';
   ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
   ```
3. Open the SQL editor, run `backend/migrations/012_*.sql` through
   `024_*.sql` **in numeric order**.
4. Note the Project URL and the `service_role` key (Project Settings →
   API → **"Legacy anon, service_role API keys"** tab specifically —
   the newer "Publishable and secret API keys" tab uses a different,
   incompatible key format for this codebase). **Double-check you copy
   the `service_role` key, not `anon`** — both authenticate
   successfully and both let `/health` report the database as
   reachable, so a mixed-up key is easy to miss: `anon` just silently
   returns zero rows for everything due to Row Level Security, which
   looks like "working" until you try to actually read or write real
   data. If in doubt, decode the JWT payload (paste it into
   jwt.io or any base64 decoder) and confirm it says `"role":
   "service_role"`, not `"role":"anon"`.
5. Also activate a pilot config version before testing onboarding —
   none of the pilot endpoints can evaluate an application without one:
   ```sql
   INSERT INTO pilot_config_versions (
       version, max_pilot_customers, contractual_credit_limit,
       initial_available_credit_min, initial_available_credit_max,
       max_single_bill_payment, max_outstanding_balance, aggregate_contractual_exposure_cap,
       contract_term_months, interest_rate_percent, late_fee_amount, early_repayment_fee_amount,
       cash_withdrawals_enabled, customer_transfers_enabled,
       approved_bill_categories, geographic_areas, pilot_duration_months,
       real_money_enabled, label, proposed_by, approved_by, is_active
   ) VALUES (
       1, 25, 2500.00, 300.00, 500.00, 500.00, 2500.00, 62500.00,
       12, 0.00, 0.00, 0.00, false, false,
       ARRAY['electricity','gas','water','telecommunications'], ARRAY['VIC'], 6,
       false, 'subject to final Australian legal confirmation', 'ops_lead', 'compliance_lead', true
   );
   ```
6. These become `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` in Step 5 below.

## Step 0.5 — issue your first API keys (do this once you have Step 0's Supabase project)

`pilot_api.py` now requires an API key on every endpoint except the
public status checks (`/health`, `/pilot/launch-gates/status`) and
document viewing. Run the migrations (Step 0) first, then, with
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` set in your shell to the sandbox
project:

```bash
cd backend
python3 issue_pilot_api_key.py --actor-id your_name --role admin \
    --issued-by yourself --mfa-verified --notes "first admin key, confirmed identity directly"
```

This prints a raw key exactly once — save it (a password manager, not
a note or a chat message). Issue additional keys for other roles
(`customer`, `case_worker`, `compliance_reviewer`, `system`) the same
way as you need them for testing. Every privileged action (activating
credit, approving a payment, viewing reports) requires the key's role
to hold the specific permission — see `security_controls.
ROLE_PERMISSIONS` for the exact matrix, and `pilot_auth.py`'s module
docstring for why this is a simple operator-issued scheme rather than
full customer self-service login.

**Never set `--mfa-verified` unless you've genuinely confirmed the
operator's identity out-of-band** — this codebase has no real MFA
provider integrated; the flag is trust you're asserting yourself, not
something the software verifies independently.

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
KEY="<the raw key issue_pilot_api_key.py printed for you>"

# 1. Confirm production is correctly NOT authorized yet (expected). Public, no auth needed.
curl $BASE/pilot/launch-gates/status

# 2. Apply. Requires a key with the 'submit_application' permission
#    (customer, case_worker, or admin role). user_id MUST be a real UUID
#    -- every customer_id/user_id column in the pilot schema is
#    UUID-typed; a plain string like "user-real-test-001" is rejected
#    with a 422 (found live during initial deployment testing -- see
#    session-17-live-deployment-real-bugs-found.md). Generate one with
#    `python3 -c "import uuid; print(uuid.uuid4())"` or any UUID generator.
curl -X POST $BASE/pilot/onboarding/apply \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d '{
  "user_id": "REPLACE-WITH-A-REAL-UUID", "identity_verification_status": "verified",
  "age_confirmed": true, "residential_state": "VIC", "bank_account_verified": true,
  "income_amount": "5200", "income_frequency": "monthly", "employment_status": "full_time",
  "recurring_living_expenses": "2800", "existing_debts_and_bnpl": "0",
  "requested_credit_purpose": "electricity", "requirements_and_objectives": "test",
  "utility_bill_ownership_verified": true,
  "consent_types_accepted": ["privacy", "identity_check", "affordability_check", "fraud_check"]
}'

# 3. Activate credit (use the application id from step 2's response).
#    Requires a compliance_reviewer or admin key with mfa_verified=True.
curl -X POST $BASE/pilot/onboarding/<application_id>/activate-credit \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d '{
  "prepared_by": "assessor1", "approved_by": "compliance1",
  "contractual_limit": "2500.00", "active_customer_count": 0, "current_aggregate_contractual_exposure": "0"
}'

# 4. Upload a real bill photo (a genuine photo from your phone works here).
curl -X POST $BASE/pilot/bills/upload -H "Authorization: Bearer $KEY" \
  -F "customer_id=user-real-test-001" -F "customer_name_on_account=Your Name" \
  -F "category=electricity" -F "file=@/path/to/a/real/bill/photo.jpg"

# 5. Attempt payment -- expect 403, this is correct (a launch gate is
#    unapproved, independent of whether your key has the right role).
curl -X POST $BASE/pilot/bills/<bill_id>/pay -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"customer_id": "user-real-test-001", "requested_by": "admin1"}'
```

Step 5 returning `403` with a message about launch gates is the system
working correctly, not a bug — real money is not supposed to move
until the actual regulatory gates are satisfied, which is a legal/
organisational process (see `docs/asic-ers-readiness/external-
dependencies.md`), not something this deployment can shortcut.
