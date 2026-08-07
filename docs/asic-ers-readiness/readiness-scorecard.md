# Readiness Scorecard

Scoring rule: no credit for planned controls. Partial credit only for
controls implemented but awaiting external configuration. External
blockers (ASIC, AFCA, insurance, banking, legal) are never scored above
0% here regardless of how ready the software is, because they cannot be
satisfied by this repository.

| Area | Score | Basis |
|---|---|---|
| Legal and regulatory classification | 0% | No Australian legal opinion has been obtained on the product structure. Explicitly out of scope for this repository to provide. |
| Product governance | 15% | Pilot config module exists, is validated, and is DB-constrained (`pilot_config.py`, migration 012). No governance process (who proposes/approves changes in practice, escalation) documented yet; no admin UI. |
| Responsible lending | 0% | Not implemented in this repository yet. |
| Customer-funds protection | 20% | A double-entry ledger with account-type separation and a DB balance trigger exists from a prior session and is logic-tested. Not yet integrated with the pilot's per-customer/aggregate caps or gated by launch_gates. External bank reconciliation is a stub. |
| Accounting and reconciliation | 15% | Internal reconciliation (ledger vs. sum of customer balances) exists and is tested. Three-way reconciliation (bank + ledger + bill/payment records) required by the task spec is not built. External bank-feed integration is a stub. |
| Consumer protection (complaints, hardship, disclosures) | 0% | Not implemented in this repository yet. |
| Security and privacy | 10% | RLS default-deny and Fernet encryption exist from prior sessions for the pre-existing app; the pilot-specific tables in migration 012 inherit that posture. MFA, security headers, dependency scanning, and most of section 13 of the task spec are not verified in this session. |
| Operational resilience | 5% | Fail-closed launch-gate logic exists and is tested. No health/readiness endpoints, runbooks, backup/restore verification, or incident-response test evidence for the pilot specifically. |
| Testing | 20% | 30 automated checks for the two controls built this session, all passing, plus pre-existing ledger/Stripe logic tests (also passing, confirmed this session). Coverage of the full section-15 test list (customer cap, affordability, duplicate bills, etc.) is a small fraction of what's required. |
| External evidence | 0% | ASIC ERS exemptions, ERS commencement date, AFCA membership, PI insurance, run-off cover, customer-funds/credit-funding/operating bank accounts, and Australian legal opinion are all unresolved. These are External dependency / Requires legal confirmation items — no code change can close them. |

**Overall: well under 20%.** This reflects that only 2 of the 17 major
scope sections (launch gates, pilot config) have been substantively
built so far, and that the largest-weighted items (legal classification,
responsible lending, consumer protection, external evidence) are all at
or near 0%. This score should rise incrementally and honestly as further
sections are implemented and tested in later sessions — it should never
be manufactured above what's actually been built and verified.
