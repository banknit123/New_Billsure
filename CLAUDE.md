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
- Stripe is **not yet connected** — `STRIPE_API_KEY` unset. All Stripe-facing
  code has been logic-tested against a mock SDK (see Testing section) but
  never against a real Stripe response.

## What's been built and applied (this is real, not a proposal)

Two migrations are **already applied** to the live `EasyBillsPay` database —
don't re-run them, extend them if changes are needed:

- `backend/migrations/002_ledger_and_reconciliation.sql` — a double-entry
  ledger (customer sub-accounts + a `TRUST_BANK` system account, balance
  enforced by a Postgres deferred constraint trigger, not just app code), a
  bank-account registry separating trust/operating funds, prioritised
  maker-checker payment runs, and reconciliation tracking.
- `backend/migrations/003_scheduled_collection_tracking.sql` — idempotent
  Stripe charge tracking (`collection_attempts`) and failure-count tracking
  on `payment_plans`.

New backend modules (not yet copied into the actual running server —
that's a manual step, see Deployment below):

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
- **PCI scope gap:** the old `POST /payment-methods` stores whatever raw
  card/account number the customer types into your own form — never
  touches Stripe. Fixed via the new SetupIntent flow, but **the frontend
  half (Stripe Elements collecting card details directly in the browser)
  has not been built** — that's real, separate work still open.
- **Two Postgres `SECURITY DEFINER` views** (`ledger_account_balances`,
  `customer_balances`) — introduced by migration 002 itself, would have
  silently bypassed RLS. Fixed same session via
  `004_fix_view_security_and_search_path` (not a separate file — applied
  directly via migration tool, add it to the migrations folder if it isn't
  there).
- **Pre-existing, NOT fixed, needs a decision:** most of the *original*
  tables (`bills`, `payment_plans`, `payment_methods`,
  `direct_debit_requests`, `users`, others) have RLS "enabled" but policies
  using `USING (true)` — effectively no restriction. Low practical risk
  today since the backend connects with the service-role key (which
  bypasses RLS regardless), but matters the moment anything uses the
  anon/publishable key directly. Needs real policies keyed to however
  `utils/auth.py`'s custom JWT actually identifies a user — not native
  Supabase `auth.uid()`. Proposal not yet written.
- **Schema gap, not yet fixed:** `models/schemas.py`'s `DirectDebitRequest`
  expects `signature`, `authorization_date`, `terms_accepted`,
  `max_payment_amount`, `provider`, `provider_type`,
  `provider_account_number`, `start_date` — the live `direct_debit_requests`
  table doesn't have these columns. Confirm and add via migration.
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
call**, and **none of the patched files have been copied into the actual
running backend yet** (they exist as files in a delivered zip / this repo,
not deployed).

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

## Deployment — not yet done

1. Copy/patch the new files into the real running backend (see file list
   above).
2. Add `insert_many()` to `backend/supabase_db.py` — the function body is
   in `backend/supabase_db_ADDITION.py`, needs pasting in manually (uses a
   single multi-row INSERT so the deferred balance trigger sees both
   postings of a journal atomically).
3. Set new env vars: `STRIPE_PAYMENT_INTENT_WEBHOOK_SECRET` (new, separate
   from whatever the existing Checkout webhook uses — see the code comment
   on `stripe_payment_intent_webhook` for why it's a second endpoint),
   `ALLOW_MOCK_PAYMENTS` (leave unset/false outside local dev).
4. Push to a branch, open a PR, review before merging to whatever branch
   triggers deploy — don't push straight to main, this is money-moving code.

## Priority order for what's next (as of last handoff)

1. Deploy the above (needs your actual hosting access — not something an
   agent without deploy credentials can do alone).
2. Fix the `direct_debit_requests` schema gap.
3. Get Stripe test-mode keys, run one real end-to-end scheduled collection.
4. Build the frontend half of payment-method tokenization (Stripe Elements
   calling `/payment-methods/setup-intent` and `/payment-methods/confirm-setup`).
5. Replace the `while True: asyncio.sleep()` background loops
   (`process_scheduled_collections`, `payment_run_scheduler_loop`,
   `reconciliation_loop`) with something that survives a restart (real
   scheduler with persistent job store, or cron-triggered endpoints) and
   make `reconciliation_exceptions` actually alert someone instead of just
   sitting in a table.
6. Draft real RLS policies for the pre-existing tables.
7. Admin UI for payment runs (endpoints already exist, no frontend yet).
8. Lower priority: evaluate a virtual-account payments provider (Zepto,
   Monoova, or Zai were discussed) to replace the still-manual BPAY
   disbursement step with a real API and a live external-balance feed for
   `reconciliation.py`'s external check.
