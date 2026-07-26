# Test Credentials

> **Do not put real secrets, passwords, project URLs, or API keys in this
> file.** It is tracked in git and was previously committed with live-looking
> values (admin/test passwords, a Supabase project URL, encryption key
> location). Those values have been rotated — store actual secrets only in a
> local `.env` file that is excluded via `.gitignore`, or in your deployment
> platform's secret manager.

## Seeding demo accounts locally

Demo accounts are no longer seeded automatically or with a default password
(see `backend/server.py` `startup_event`). To seed them locally, set in your
local `.env` (never commit this file):

```
SEED_DEMO_DATA=true
SEED_ADMIN_EMAIL=<pick your own>
SEED_ADMIN_PASSWORD=<pick a strong password, don't reuse it anywhere>
SEED_TEST_EMAIL=<pick your own>
SEED_TEST_PASSWORD=<pick a strong password, don't reuse it anywhere>
```

## Required environment variables

- `JWT_SECRET` — long random string; generate with `python -c "import secrets; print(secrets.token_hex(32))"`
- `ENCRYPTION_KEY` — Fernet key; generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — from your Supabase project's API settings (Project Settings → API). Rotate the service_role key there if it was ever exposed, then update this value.
- `STRIPE_API_KEY` — from your Stripe dashboard (use a test-mode key for local dev). Roll it from the Stripe dashboard if it was ever exposed.

## Notes

- Brand name: BillSure (www.billsure.com.au)
- Tagline: "Never be surprised by a bill again"
- Database: Supabase Postgres
- Auth: Supabase Auth (email/password) with custom JWT fallback
- Admin login redirects to /admin, customer to /dashboard
- Forgot password: /forgot-password page
- Encryption: Fernet (AES-128-CBC) — see `ENCRYPTION_KEY` above
