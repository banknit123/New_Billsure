# BillSure / EasyBillsPay — project context for Claude Code

This file is read automatically by Claude Code at the start of every session
in this repo. It exists so work already done in a prior claude.ai chat
doesn't need to be re-explained or re-derived. Keep it updated as things
change — it's meant to be the persistent memory this project didn't have
before.

## What this project is

A household bill-smoothing platform: customers make regular contributions,
BillSure pays their bills for them, and — where a customer's balance is
temporarily short — a small short-term credit facility bridges the gap.
Currently mid-build, pre-launch, no Stripe account connected yet.

Two ASIC Enhanced Regulatory Sandbox notifications (Financial Services +
Credit Activities) have been drafted separately and are being reviewed in a
different conversation — not part of this codebase's scope, ignore unless
asked.

## Real infrastructure — use these, don't guess

- **Supabase project (the real one):** `EasyBillsPay`, ref `nojrxsbgcmoonnobagcv`,
  region ap-southeast-2. This is what the FastAPI backend actually connects
  to — table names in `backend/schema.sql` match it exactly.
- **A different, unrelated Supabase project** also exists in the same org:
  `Billseasypay`, ref `epvozejhiawittzpfboe`. Different schema entirely
  (`user_bills`, `spending_analytics`, etc.), empty, and **all 6 tables have
  RLS disabled** — a live security hole if anything actually points at it.
  Confirm with the project owner whether it's in use before touching it.
  Two other projects in the org (`Bollywood trading`, `Bollywood2`) are
  unrelated to BillSure entirely.
- **Stripe test-mode (sandbox) IS now connected** — a real `sk_test_...`
  key was provided 2026-07-26, validated directly against Stripe
  (`stripe.Account.retrieve()`: account `acct_1TwSqZGyL4AzZVlU`, country
  AU) and end-to-end through the actual backend
  (`POST /payment-methods/setup-intent` → real `client_secret`, using the
  seeded local test user). This was blocked until the same session found
  and fixed a real bug: `server.py` called `load_dotenv()` *after*
  importing `stripe_collections`/`utils.auth`, both of which read env
  vars at module import time — so `.env` values for `STRIPE_API_KEY`,
  `JWT_SECRET`, `ENCRYPTION_KEY`, and `RESEND_API_KEY` were silently
  never applied locally. Fixed by moving `load_dotenv()` to the top of
  `server.py`, before any local module import. Still only logic-tested
  (mock SDK) for the scheduled off-session collection path specifically —
  the one real end-to-end test so far is SetupIntent creation, not yet a
  full save-a-card → scheduled-charge cycle. Local `STRIPE_API_KEY` lives
  in `backend/.env` (gitignored) — set it in whatever's actually hosting
  this before deploying.

## What's been built and applied (this is real, not a proposal)

Seven migrations are **already applied** to the live `EasyBillsPay` database
(confirmed via `list_migrations`/`execute_sql` against the real project,
not just read from these files) — don't re-run them, extend them if changes
are needed:

- `backend/migrations/002_ledger_and_reconciliation.sql` — a double-entry
  ledger (customer sub-accounts + a `TRUST_BANK` system account, balance
  enforced by a Postgres deferred constraint trigger, not just app code), a
  bank-account registry separating trust/operating funds, prioritised
  maker-checker payment runs, and reconciliation tracking.
- `backend/migrations/003_scheduled_collection_tracking.sql` — idempotent
  Stripe charge tracking (`collection_attempts`) and failure-count tracking
  on `payment_plans`.
- `backend/migrations/004_fix_view_security_and_search_path.sql` — fixes the
  two `SECURITY DEFINER` views and unpinned `search_path` from migration 002
  (see Security section below). Applied directly via the migration tool in
  an earlier session; only captured as a file in this repo in this session
  (it existed live but not in git before).
- `backend/migrations/005_p0_p1_p2_remediation.sql` — from a **separate**
  ASIC ERS Annexure B gap-remediation workstream (not part of this repo's
  delivery history until now): atomic double-entry posting RPCs
  (`post_journal_entry`, `get_or_create_customer_ledger_account`), a
  `refunds` table, a `disclosure_acknowledgements` table (ERS
  no-personal-advice acknowledgement), payment-time manual-review columns
  on `payment_run_items`/`bills`, a contribution-schedule-approval step on
  `payment_plans`, and audit-trigger coverage for everything 002–005 added.
  Also fixes `audit_trigger_func()` to use a jsonb lookup instead of
  `NEW.user_id` directly, since several of these tables don't have a
  `user_id` column. Same as 004: applied live earlier, only captured as a
  file here now.
- `backend/migrations/006_direct_debit_request_columns.sql` — adds the
  columns `models/schemas.py`'s `DirectDebitRequest` actually writes
  (`provider`, `provider_type`, `provider_account_number`,
  `payment_frequency`, `max_payment_amount`, `start_date`,
  `authorization_date`, `signature`, `terms_accepted`) to the live
  `direct_debit_requests` table, which previously only had
  `debit_amount`/`debit_frequency` from an earlier design — closing the
  schema gap flagged below. Additive; the old columns are left in place.
- `backend/migrations/007_rls_default_deny.sql` — drops the 21 remaining
  `USING (true)` / `WITH CHECK (true)` policies that `schema.sql` had
  already documented as wrong but were never actually applied to the live
  database (confirmed via `pg_policies` before and after). RLS stays
  enabled with zero replacement policies → default-deny for
  anon/authenticated; only the backend's `service_role` key can read/write
  these tables. Verified via `get_advisors` that every previously-flagged
  `rls_policy_always_true` warning is gone post-migration. Confirmed the
  frontend never queries Supabase tables directly (only Auth, via
  `supabaseClient.js`) before applying — see the migration file's own
  comment for the reasoning and what a real future anon-key policy would
  need to key off instead of `auth.uid()` (this app's JWT is custom, not
  Supabase-native).

New backend modules (copied into `backend/` and wired into `server.py` in
this repo — deployment to the actual running server is still a separate,
manual step, see Deployment below):

- `backend/ledger.py` — double-entry posting/reads. No balance is ever
  stored and mutated directly; everything is computed from immutable
  postings.
- `backend/payment_runs.py` — prioritised bill payment: queues a bill only
  against the *owning* customer's own cleared, available balance, requires
  a different admin to approve than who built the run (maker-checker
  enforced in code), only debits the ledger once a payment is confirmed
  cleared (not when merely queued).
- `backend/reconciliation.py` — internal check (ledger vs. sum of customer
  balances — should always match by construction) + external check (ledger
  vs. real bank balance — `_fetch_external_trust_balance()` is a stub,
  needs wiring to whichever bank/provider ends up holding the trust
  account). `approve_payment_run()` refuses to approve while the latest
  reconciliation run has an open exception.
- `backend/stripe_collections.py` — real Stripe SetupIntent tokenization +
  off-session PaymentIntent charging, replacing what used to be a fully
  fabricated "auto-deduction" (it credited the wallet on a timer with zero
  money actually collected).
- `backend/server.py.patch` / `server_PATCHED.py` — the actual integration:
  new `/payment-methods/setup-intent`, `/payment-methods/confirm-setup`,
  `/webhook/stripe-payment-intents`, `/admin/payment-runs/*`,
  `/admin/reconciliation/*` endpoints; `process_auto_deductions` rewritten
  as `process_scheduled_collections` (real Stripe charges, not fabricated
  credit).

## Security issues found and fixed this session

- **Three "free money" endpoints** — `/scheduler/trigger-now`,
  `/transactions/deposit`, `/payment-plan/simulate-deduction` all credited
  real wallet balance to any logged-in user with zero payment collected,
  no gating. `trigger-now` now goes through real Stripe (idempotent, so
  calling it twice is a no-op, not free money). The other two are gated
  behind `ALLOW_MOCK_PAYMENTS=true` (off by default) — still work for local
  testing, structurally can't be hit in production unless deliberately
  enabled.
- **PCI scope gap — FIXED end-to-end:** the old `POST /payment-methods`
  stores whatever raw card/account number the customer types into your own
  form — never touches Stripe. Fixed via the new SetupIntent flow on the
  backend, and the frontend half (`StripeCardSetup.jsx`, Stripe Elements
  collecting card details directly in the browser) was built this session
  — see "Payment-method tokenization frontend" below. The legacy raw-entry
  form is still there for bank-account reference entries (never chargeable
  either way) but is no longer the only way to add a card.
- **Two Postgres `SECURITY DEFINER` views** (`ledger_account_balances`,
  `customer_balances`) — introduced by migration 002 itself, would have
  silently bypassed RLS. Fixed same session via
  `004_fix_view_security_and_search_path` (not a separate file — applied
  directly via migration tool, add it to the migrations folder if it isn't
  there).
- **RLS on pre-existing tables — FIXED (migration 007, applied live):** the
  original tables (`bills`, `payment_plans`, `payment_methods`,
  `direct_debit_requests`, `users`, `bank_details`, `notifications`,
  `payment_structures`, `payment_transactions`, `provider_connections`,
  `subscriptions`, `audit_log`) had RLS "enabled" but policies using
  `USING (true)` — effectively no restriction for the anon/authenticated
  Postgres roles. Confirmed low practical risk (backend always uses
  service_role, which bypasses RLS; frontend's Supabase client only touches
  Auth, never queries tables directly) before dropping all 21 permissive
  policies with no replacements → real default-deny. See migration 007's
  comment for what a real future anon-key-scoped policy would need to key
  off (this app's JWT is custom — `utils/auth.py`'s `user_id` claim — not
  native Supabase `auth.uid()`).
  **`backend/migrations/008_rls_policies_draft_not_applied.sql`** is the
  next step beyond default-deny -- draft, granular, read-your-own-row
  SELECT policies for the same tables, keyed to this app's custom JWT via
  a `current_setting('app.current_user_id', true)` session variable.
  **Not applied anywhere, and not safe to apply as-is** — it depends on
  session-variable wiring (a raw Postgres connection setting
  `app.current_user_id` per request) that doesn't exist in this codebase
  yet; until that's built, applying it is a no-op (fails safe as
  default-deny, same as 007, per NULL-never-equals-anything). Needs
  security review before it's anything more than a documented starting
  point — see the file's own header for the full reasoning, including why
  write policies are deliberately left out entirely.
- **`backend/migrations/009_payment_transactions_paid_at.sql` — FIXED, applied live:**
  found while hotfixing a broken `main` (see git history) —
  `check_payment_status()`/`stripe_webhook()` both write `paid_at` on the
  "paid" transition, but the live `payment_transactions` table didn't
  have that column. Purely additive; confirmed live via
  `information_schema.columns` after applying.
- **`backend/migrations/010_atomic_balance_helpers.sql` — FIXED, applied
  live, found by the first real end-to-end Stripe test (2026-07-26):**
  `increment_wallet_balance()` and `increment_active_plan_totals()` have
  been defined in `schema.sql` since early in this project (the documented
  fix for a wallet-balance race condition) and are called by
  `supabase_db.py` — but **neither function actually existed on the live
  database** (confirmed via `pg_proc`; likely never applied because
  schema.sql's function section was added after the live tables were
  first created some other way). This had been silently broken the whole
  time Stripe was disconnected, because nothing had ever gotten far
  enough through a real scheduled collection to call it. When it finally
  ran for real: the Stripe charge succeeded, the ledger was correctly
  credited (`collection_attempts.status = 'credited'`,
  `customer_balances.ledger_balance` correct) — only the final
  `payment_plans.total_collected` display-total update failed
  (PGRST202, function not found), a real 500 on `/scheduler/trigger-now`.
  **The money and the ledger were never wrong** — only a secondary,
  denormalized display aggregate. Applied the missing functions live
  (identical to schema.sql's existing definitions) and manually
  backfilled the one affected plan's `total_collected` to match its real
  ledger balance. Audited every other function schema.sql/migrations
  define (`post_journal_entry`, `get_or_create_customer_ledger_account`,
  `check_journal_balanced`, `audit_trigger_func`) against live `pg_proc`
  — all present; the gap was isolated to these two, which predate the
  ledger migrations and apparently were never applied when the live
  tables were first set up some other way.
- **Schema gap — FIXED (migration 006, applied live):** `models/schemas.py`'s
  `DirectDebitRequest` expects `signature`, `authorization_date`,
  `terms_accepted`, `max_payment_amount`, `provider`, `provider_type`,
  `provider_account_number`, `start_date` — the live `direct_debit_requests`
  table only had `debit_amount`/`debit_frequency` from an earlier design.
  `POST /direct-debit/create` would have failed with an unknown-column error
  against the real database before this migration.
- **Unexplained data:** the live `users` table has 14 rows despite this
  being described as a fresh/test project. Most are identifiable test
  fixtures (`admin@billseasypay.com`, various `TEST_...@example.com`), but
  two — "Nitin" (banknit123@gmail.com) and "Shyam i"
  (shyamiyer123@gmail.com) — look like real people, one with a non-zero,
  non-round wallet balance. Not investigated further; don't delete or
  modify without finding out what they are first.

## What's genuinely untested

Everything above is either logic-tested (see below) or verified directly
against the real database — but **nothing has touched a real Stripe API
call**, and **none of this is confirmed running on the actual live server
process yet** (it's all merged into this repo's `main`/feature branches,
but that's a separate thing from "the deployed backend is running this
code" — depends entirely on your hosting/deploy setup, which no agent
session has had credentials for so far).

## Testing

Two standalone logic tests exist, no live credentials needed:

```bash
cd backend
python3 test_ledger_flow.py        # ledger/payment-run/reconciliation logic, in-memory fake DB
python3 test_stripe_collections.py # Stripe collection logic, mock Stripe SDK
```

Both should print `ALL CHECKS PASSED`. Run after any change to
`ledger.py`, `payment_runs.py`, `reconciliation.py`, or
`stripe_collections.py` — they're fast and catch real logic bugs (they
already caught a sign-convention bug and a fund-holds default-value bug
during development).

## Running the full backend locally

`server.py` imports `emergentintegrations` (Emergent's own LLM/payments
wrapper) directly — that package has been **removed from PyPI entirely**
and can't be installed on any platform anymore, which used to make it
impossible to even start the server outside Emergent's own infrastructure.
`backend/emergentintegrations/` is a local compatibility shim (not a pip
package — just a same-named directory Python resolves before looking at
site-packages) that makes the import succeed:

- `payments/stripe/checkout.py` is a **real** reimplementation against the
  standard `stripe` SDK — wallet top-up (Checkout Sessions) works exactly
  as before, nothing is faked.
- `llm/chat.py` is a stub — both call sites (AI bill-photo scanning, AI
  spending insights) already check `if EMERGENT_LLM_KEY:` before touching
  it, and that env var is unset by default, so the stub is never actually
  invoked unless someone sets `EMERGENT_LLM_KEY` without also wiring a
  real provider into `LlmChat.send_message()`.

To run the backend locally: create a venv in `backend/`, install
`requirements.txt` (the `emergentintegrations==0.1.1` line has been
removed — it was never installable), and set `SUPABASE_URL` /
`SUPABASE_SERVICE_KEY` for the real EasyBillsPay project (there is no
separate local database — local testing writes real rows to the live
project, same as existing test fixtures already there) plus `JWT_SECRET`
and `ENCRYPTION_KEY` (any random local values are fine). `SEED_DEMO_DATA=true`
with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`/`SEED_TEST_EMAIL`/`SEED_TEST_PASSWORD`
seeds a quick login without registering manually — **use a real-looking
domain for these** (e.g. `@example.com`), not `.local` or another
special-use TLD: `models.schemas`'s `EmailStr` validation (via the
`email-validator` package) rejects reserved/special-use domains outright,
so a `.local` seed email can be inserted directly into the DB by the
seeding code but will then fail login through the actual `POST /auth/login`
endpoint — hit this firsthand, cost a debugging cycle before realising
the account itself was fine and the email format was the problem.
`STRIPE_API_KEY` (a real `sk_test_...` sandbox key) and `OPS_ALERT_EMAIL`
are also set in the working local `.env` as of 2026-07-26 — see the
Stripe connection note above and `ALERTING.md`. **`load_dotenv()` must
run before any local module is imported** in `server.py` — see the
comment at the top of that file; several modules read env vars at import
time, not lazily, so getting this order wrong silently drops every `.env`
value for those modules specifically (this bit us once already).

## Scheduler modes — SCHEDULER_MODE (added this session)

`process_scheduled_collections`, `payment_run_scheduler_loop`, and
`reconciliation_loop` used to only run as `while True: asyncio.sleep()`
in-process background tasks — fine as long as exactly one instance of this
process stays alive forever, not safe to assume on every host. Each loop's
body is now also exposed as a stateless, idempotent HTTP endpoint an
external cron system can call instead:

- `POST /api/internal/cron/scheduled-collections`
- `POST /api/internal/cron/payment-run-queue`
- `POST /api/internal/cron/reconciliation`

All three require header `X-Cron-Secret: <CRON_SECRET>` and fail closed
(503) if `CRON_SECRET` isn't set — there is no unauthenticated path.
`generate_notifications` always runs in-process regardless of scheduler
mode — it wasn't in scope for the durability fix.

A third mode was added on top: `SCHEDULER_MODE=apscheduler` uses
`backend/scheduler.py` — APScheduler with a **persistent Postgres job
store** (survives a restart on schedule instead of restarting the
interval from zero) plus a **Postgres advisory lock** held around each
job's execution (so if two instances of this app are ever running at
once, only one actually runs a given tick — the other loses the lock and
skips that tick, logged not silent). Be precise about this: the
persistent jobstore alone does NOT prevent double-running across
instances — that's what the advisory lock is specifically for. Requires
`DATABASE_URL`, a **direct** Postgres connection string (Supabase
dashboard → Project Settings → Database → Connection string, "Session"
pooler mode or direct — not "Transaction" mode, which can break the
lock/unlock pairing) — distinct from `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`,
which go through PostgREST and can't hold a session-scoped lock. Fails
loudly at startup (doesn't silently fall back to another mode) if
`DATABASE_URL` is unset while this mode is selected. Not live-tested end
to end this session — no `DATABASE_URL` was available — only verified
that `scheduler.py` imports cleanly and `server.py` is unaffected when
this mode isn't selected (the default, `loop`, still is).

Set `SCHEDULER_MODE` to `loop` (default), `cron`, or `apscheduler`.
Whichever isn't selected doesn't also start for these three jobs —
running two triggering mechanisms for the same jobs at once would
double-run them. The `/internal/cron/*` endpoints stay registered in
every mode (still gated by `CRON_SECRET`) for manual/ops-triggered runs.
`reconciliation.py` also emails `OPS_ALERT_EMAIL` (if set) the moment a
`reconciliation_exceptions` row is created, instead of that row just
sitting silently in a table. See `ALERTING.md` for the reconciliation
alert channels specifically (email + webhook, both pluggable).

## Off-session charges requiring extra card authentication

`stripe_collections.collect_scheduled_contribution()` now handles the
case Stripe's own documented behaviour actually produces for
`off_session=True` + `confirm=True`: a card needing 3D Secure / SCA
authentication doesn't come back with a normal `requires_action` status —
Stripe raises a `CardError` with `code == "authentication_required"`
instead, carrying the stuck `PaymentIntent` on the exception. This used
to fall through unhandled in `_collect_for_plan` (server.py) — the
schedule would silently advance past it with no record and no
notification. Now: `collection_attempts` and `payment_plans.last_collection_status`
are both marked `requires_customer_action` (not `failed` — this isn't a
decline, it's an unfinished authentication step), the ledger is not
credited, the schedule does NOT advance (so it keeps flagging as stuck
each cycle rather than silently skipping the contribution), a
customer-facing notification is created (`type: payment_requires_action`),
and `GET /admin/customer-analytics` now returns `needs_attention: true`
for affected customers. What's still missing: an actual on-session flow
for the customer to complete the 3D Secure challenge (would need Stripe.js
calling `confirmCardPayment` with the stuck PaymentIntent's client_secret)
— out of scope for this pass, which only needed to stop the state from
being silently dropped. Logic-tested against a mock Stripe SDK (not a
real Stripe test-mode account) in `test_stripe_collections.py`.

## Admin UI

`frontend/src/components/admin/AdminPaymentRuns.jsx` (nav: Admin →
"Payment Runs") covers the `/admin/payment-runs/*` and
`/admin/reconciliation/*` endpoints: reconciliation status banner with a
manual "Run Reconciliation Now" button, build/list payment runs, expand a
run to see its items, approve a run, and per-item submit/clear/fail with a
provider-reference field. Maker-checker is enforced server-side
(approving your own run 400s) **and** surfaced proactively in the UI —
each pending-approval run shows "Created by you — needs another admin"
(Approve button disabled, with a tooltip explaining why) or "Created by
another admin", using the logged-in admin's own id from `useAuth()`
compared against `run.created_by`, rather than only finding out via an
error toast after clicking. `admin_pay_bill`/`admin_pay_bills_bulk` (the
`AdminPayments.jsx` page) still work and are unaffected — payment runs are
additive, not a replacement, until the frontend fully moves over per the
original integration notes.

## Payment-method tokenization frontend

`frontend/src/components/StripePaymentMethodSetup.jsx` (superseded the
earlier card-only `StripeCardSetup.jsx`, since removed) is the browser
half of real Stripe payment-method tokenization, covering **both** card
and AU BECS Direct Debit — matching what `stripe_collections.create_setup_intent()`
already accepts on the backend (`payment_method_types=["card", "au_becs_debit"]`).
Flow: calls `POST /payment-methods/setup-intent` to get a `client_secret`
*before* rendering `<Elements>` (the Payment Element needs the
client_secret up front, unlike the old card-only `<CardElement>`), renders
Stripe's `<PaymentElement>` (card/BECS details never reach BillSure's
servers), confirms client-side via `stripe.confirmSetup({elements,
redirect: 'if_required', ...})`, then calls `POST /payment-methods/confirm-setup`.

**The old raw-entry form (typed card/BSB/account numbers going straight
into our own database) has been removed entirely** — both call sites
(`PaymentMethodsManager.jsx`'s "Add Payment Method" dialog, and
`BillSetupWizard.jsx`'s onboarding step 4) now use
`StripePaymentMethodSetup` exclusively. `PaymentMethodsManager.jsx` still
shows an "Auto-pay ready" vs "Manual only (legacy)" badge per method, for
any pre-existing rows from before this change that still lack a
`stripe_payment_method_id`. The backend's `POST /payment-methods` raw-entry
endpoint itself was left in place (out of scope for a frontend-only pass —
removing a backend endpoint is a separate decision), but nothing in the
frontend calls it anymore.

Needs `REACT_APP_STRIPE_PUBLISHABLE_KEY` set or the dialog shows a
not-configured message instead of the payment form (fails closed, not
silently broken). `@stripe/stripe-js` and `@stripe/react-stripe-js` were
added to `frontend/package.json`; `yarn install` has been run and
`yarn.lock` is checked in. Verified the dev server compiles and serves
this cleanly via direct `curl` checks; the in-session Browser pane tool
itself had a proxying/caching issue serving `bundle.js` (confirmed to be
the tool, not the app — `curl http://localhost:3000/static/js/bundle.js`
returned a healthy 200 with real content throughout) that made an
in-browser click-through unreliable this session.

## Deployment — not yet done

1. Copy/patch the backend files into the real running server process
   (they're in this repo's `backend/` now, but "in the repo" ≠ "what the
   live server is actually running" unless your deploy pipeline pulls from
   this branch).
2. Set new env vars beyond the ones already documented:
   `SCHEDULER_MODE` (`loop` default / `cron`), `CRON_SECRET` (required if
   using `cron` mode or hitting the `/internal/cron/*` endpoints at all),
   `OPS_ALERT_EMAIL` (reconciliation-exception alerts), and
   `REACT_APP_STRIPE_PUBLISHABLE_KEY` for the frontend build (separate from
   the backend's secret `STRIPE_API_KEY`).
3. Push to a branch, open a PR, review before merging to whatever branch
   triggers deploy — don't push straight to main, this is money-moving code.

## Priority order for what's next (as of last handoff)

1. Deploy the above (needs your actual hosting access — not something an
   agent without deploy credentials can do alone).
2. **Done:** ran a full real save-a-card → scheduled-charge cycle against
   the Stripe sandbox end to end (2026-07-26) — SetupIntent → confirmed
   with Stripe's official `pm_card_visa` test token → saved via
   `POST /payment-methods/confirm-setup` → forced the plan's
   `next_deduction_date` due via SQL → `POST /scheduler/trigger-now` →
   real off-session PaymentIntent charged (`pi_3TxK7l...`, $475.72) →
   `collection_attempts.status = 'credited'` → `customer_balances.ledger_balance`
   confirmed at $475.72. The idempotency guard was also verified for
   real, not just in the mock test suite: a second attempt (from the
   in-process scheduler loop picking up the same due plan) correctly
   found the existing `credited` row and did not re-charge Stripe.
   **Also done:** tested `au_becs_debit` (AU bank Direct Debit) for real,
   using Stripe's official test BSB `000000` / account `000123456`
   (source: Stripe's own docs). Found and fixed a second real bug doing
   this: `stripe_collections.confirm_setup_intent_and_save()` assumed
   `pm.au_becs_debit.bank_name` exists — it doesn't; a real BECS
   PaymentMethod object only carries `bsb_number`/`fingerprint`/`last4`.
   Every real BECS confirm-setup call was hitting `AttributeError:
   bank_name` (a 500). Fixed by dropping the bogus field access; `label`
   now falls back to `"Bank Account"` for BECS instead of a nonexistent
   bank name. After the fix: SetupIntent → confirmed with a real BECS
   PaymentMethod + mandate acceptance → saved via
   `POST /payment-methods/confirm-setup` (200, real
   `stripe_payment_method_id`) → a direct off-session PaymentIntent charge
   against it correctly returned `status=processing` (BECS settles
   asynchronously, exactly as `_collect_for_plan`'s `processing` branch
   expects). **Not verified**: the actual async settlement — that needs
   Stripe's real webhook to reach `/webhook/stripe-payment-intents`,
   which requires a publicly reachable URL (localhost isn't reachable
   from Stripe's servers); untested until there's a real deployment or a
   tunnel (ngrok etc.) to test against.
   Left the `requires_customer_action` path (Phase 3) logic-tested only —
   didn't try to force a real 3DS challenge this session.
3. RLS Option B (sign the custom JWT with Supabase's own JWT secret so
   `request.jwt.claims` works natively, then rewrite migration 008's
   policies against it) — approved in principle, deliberately **on hold
   for a maintenance window**: it invalidates every existing session the
   moment it deploys. Needs the Supabase project's JWT secret (Dashboard
   → Project Settings → API → JWT Settings) when ready to proceed.
4. **Done:** `SCHEDULER_MODE=apscheduler` switched on locally (2026-07-26)
   — `DATABASE_URL` provided (Session pooler connection string, database
   password URL-encoded since it contains `@`). Verified for real: direct
   `psycopg2` connection + `pg_try_advisory_lock`/`pg_advisory_unlock`
   both work against the live project; backend startup log showed all
   three jobs (`_job_scheduled_collections`, `_job_payment_run_queue`,
   `_job_reconciliation`) added successfully with no errors; confirmed
   the `apscheduler_jobs` table exists live with all three jobs
   persisted (real `next_run_time` values, not just in-process state).
   `apscheduler_jobs` got RLS auto-enabled with no policies by Supabase's
   own `rls_auto_enable()` (applies to every new table automatically) —
   already safely default-deny, no action needed. Also found and fixed:
   applying migration 010 (below) surfaced a `function_search_path_mutable`
   warning on both new functions — pinned via migration 011, same
   hardening as `check_journal_balanced()` (migration 004). Not yet
   tested: an actual second instance running concurrently (the scenario
   the advisory lock specifically exists for) — only single-instance
   behavior verified so far.
5. Lower priority: evaluate a virtual-account payments provider (Zepto,
   Monoova, or Zai were discussed) to replace the still-manual BPAY
   disbursement step with a real API and a live external-balance feed for
   `reconciliation.py`'s external check (`_fetch_external_trust_balance()`
   is still a stub).
