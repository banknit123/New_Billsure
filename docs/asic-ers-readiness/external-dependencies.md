# External Dependencies

Items that cannot be resolved by writing code in this repository. Each
maps to a `gate_key` in `backend/launch_gates.py`'s `MANDATORY_GATES`,
so the launch-gate service will correctly keep production blocked until
each is genuinely evidenced.

| Gate key | Dependency | Type | Status |
|---|---|---|---|
| `asic_ers_financial_services_exemption` | ASIC ERS financial-services exemption notification accepted/in effect | External dependency | Not started in this repo's tracking (referenced as "drafted separately, being reviewed in a different conversation" per `CLAUDE.md` — not evidenced here) |
| `asic_ers_credit_exemption` | ASIC ERS credit exemption notification accepted/in effect | External dependency | Same as above |
| `ers_commencement_date_reached` | The applicable ERS notification's commencement date has actually arrived | External dependency | Not evidenced |
| `afca_membership_active` | Active AFCA membership | External dependency | Not evidenced |
| `pi_insurance_active` | Active professional indemnity insurance | External dependency | Not evidenced |
| `pi_runoff_cover_confirmed` | 12-month PI run-off cover confirmed | External dependency | Not evidenced |
| `customer_funds_account_established` | Separate customer-funds/client-money account with an ADI | External dependency | Not evidenced. The existing `TRUST_BANK` ledger account is an internal accounting construct, not proof of a real external bank account. |
| `credit_funding_account_established` | Credit-funding account (BillSure capital) | External dependency | Not evidenced |
| `operating_account_established` | Operating account | External dependency | Not evidenced |
| `au_regulatory_legal_opinion_received` | Australian regulatory legal opinion on the product structure | Requires legal confirmation | Not obtained. See `regulatory-assumptions.md`. |
| `customer_agreements_approved` | Customer agreement wording approved | Requires legal confirmation | Not drafted (final wording) — task spec explicitly prohibits this repository from drafting final legal wording |
| `credit_and_disclosures_approved` | Credit/financial-product disclosures approved | Requires legal confirmation | Not drafted |
| `target_market_determinations_approved` | TMDs approved | Requires legal confirmation | Not drafted |
| `privacy_and_consent_docs_approved` | Privacy/consent documents approved | Requires legal confirmation | Not drafted |
| `production_security_assessment_passed` | Independent production security assessment | External dependency | Not commissioned |
| `penetration_testing_passed` | Penetration test | External dependency | Not commissioned |
| `bank_feed_integration_verified` | Real bank-feed integration tested end-to-end | External dependency | `reconciliation.py`'s `_fetch_external_trust_balance()` is a stub (prior session) |
| `reconciliation_testing_passed` | Full three-way reconciliation tested | Partially internal / partially external | Internal ledger-vs-ledger reconciliation exists and is tested; needs a real bank feed to test the external leg |
| `responsible_lending_workflow_approved` | Responsible-lending workflow reviewed and approved | Internal, not yet built | The workflow itself doesn't exist in code yet (task section 3) — this is not an external blocker once built, but is currently blocked on that build |
| `incident_response_test_passed` | Incident-response test | Internal, not yet built | Runbook and test not created yet |
| `business_continuity_test_passed` | Business-continuity test | Internal, not yet built | Not created yet |
| `wind_down_test_passed` | Wind-down test | Internal, not yet built | `existing_customers_route()` exists as an interface (`launch_gates.py`) but no actual wind-down workflow is built yet |

## A note on scope this session deliberately avoided

The live Supabase project (`EasyBillsPay`) holds real rows, including at
least two accounts that appear to belong to real people (per `CLAUDE.md`
notes from a prior session). Per this task's explicit instruction to use
sandbox providers and synthetic data, this session's new migration
(012) has **not** been applied to that project or any other live
database, and no new code in this session reads from or writes to it.
