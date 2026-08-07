# Runbook: Customer Hardship Request

**When to use:** a customer indicates they're struggling to make a
repayment, discloses a vulnerability indicator, or explicitly asks for
hardship assistance.

## 1. Accept the request immediately — no gate

Call `hardship_collections.request_hardship()`. This function has
**zero payment-status gating** by design — it does not matter whether
the customer is up to date, has a failed installment, or has never made
a payment at all. Do not delay accepting a hardship request to first
check their account status; the check simply isn't part of the
function, and it shouldn't be added later without a very good reason.

## 2. Consider an immediate collection pause

If the customer needs breathing room while their situation is assessed,
use `hardship_collections.pause_collections()` — this requires a
second, distinct approver (maker-checker), so have a second staff
member confirm before it takes effect. A pause does not need to wait
for a full arrangement to be worked out.

## 3. Assess and propose an arrangement

1. Gather what's changed (income, expenses) — this can reuse
   `responsible_lending.AffordabilityInputs`/`run_assessment()` if a
   fresh affordability picture is useful, though a hardship arrangement
   doesn't require a full formal reassessment the way a limit increase
   does.
2. Propose a revised schedule via `hardship_collections.
   propose_hardship_arrangement()`. This function independently refuses
   any installment carrying a nonzero fee or interest amount — you
   cannot accidentally propose something that violates the pilot's 0%/
   $0 rules even under hardship-arrangement pressure to "make it work."
3. Get a second person to approve via `approve_hardship_arrangement()`
   (maker-checker again).

## 4. If the customer's installment already failed

Use `hardship_collections.record_failed_repayment()` to record it
honestly. This function does nothing else automatically — no fee, no
auto-escalation. Escalation is always a separate, deliberate,
human-initiated step (`escalate_hardship_case()`), never a side effect
of a failed payment.

## 5. Ongoing

- `hardship_collections.is_collection_paused()` — check this before
  sending any reminder or escalation (no scheduled job calls this
  automatically yet — a human process, or a future scheduled job, needs
  to check it).
- If the hardship case doesn't resolve and needs escalation beyond what
  this team can offer, `escalate_hardship_case()` with a documented
  reason.
- If the underlying issue is actually a complaint (the customer is
  dissatisfied with how something was handled, not just needing
  payment flexibility), also open a `complaints.py` case — hardship and
  complaints are separate systems in this codebase; a hardship case
  does not automatically become a complaint or vice versa.
