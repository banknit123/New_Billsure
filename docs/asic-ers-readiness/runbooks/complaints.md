# Runbook: Complaint Intake and Handling

**When to use:** any expression of dissatisfaction from a customer
about the product, service, staff, or how a previous complaint was
handled, through any channel.

## 1. Intake

Call `complaints.intake_complaint()` immediately on receipt, regardless
of channel (phone, email, web form, in person, mail, social media). This
computes and stamps both:

- **Acknowledgement deadline** — 1 business day (RG 271).
- **Response deadline** — 30 calendar days for a standard complaint, 21
  days if it relates to a credit default notice, per the category you
  select at intake. Get the category right; it directly changes the
  legal deadline, not just an internal target.

Link the complaint to whatever it's actually about —
`bill_id`/`disbursement_id`/`application_id`/`credit_decision_id` —
this is required by task section 10, not optional metadata.

## 2. Acknowledge

Call `complaints.acknowledge_complaint()` within 1 business day. The
function itself flags whether this happened late — check
`acknowledgement_late` and treat a `True` as something to actively fix
in the intake process, not just a statistic.

## 3. Assign and investigate

1. `assign_owner()` to a specific case worker.
2. `add_investigation_note()` for anything relevant found.
3. `record_customer_communication()` for every substantive exchange —
   this needs to be complete enough that someone else could pick up the
   case from the notes alone.

## 4. Remedy (if compensation is warranted)

`propose_remedy()` then `approve_remedy()` — maker-checker is mandatory
here; the person proposing a compensation amount cannot also approve
it, regardless of how small the amount is or how much time pressure
exists.

## 5. Resolve

`resolve_complaint()` requires a `root_cause_category` from a fixed
set — pick the one that's actually true, not the most convenient one;
`regulatory_reports.complaints_and_afca_report()`'s root-cause
breakdown is only useful for spotting systemic issues if this is done
honestly.

## 6. If the deadline is going to be missed

Check `complaints.needs_delay_notification()`. If it returns True on an
open complaint, RG 271 requires sending an "IDR delay notification" to
the complainant explaining the delay and their right to escalate to
AFCA. **No notification is sent automatically** — this function only
detects the condition; a human (or a future scheduled job) must
actually send it.

## 7. If the customer escalates to AFCA

**AFCA has no API** — confirmed against their own documentation. Their
member portal (a web UI) is the only way to actually manage an AFCA
case once lodged. In this codebase:

1. Call `complaints.escalate_to_afca()` to record that escalation
   happened, with a documented reason. `afca_reference_number` can be
   left blank at this point — AFCA issues it after the complaint is
   lodged in their consumer portal.
2. Once AFCA issues a case reference (visible in the member portal),
   update it manually — there is no automated sync.
3. Manage the actual case (respond to AFCA requests, upload documents,
   track due dates) entirely through AFCA's member portal — that work
   happens outside this codebase.
