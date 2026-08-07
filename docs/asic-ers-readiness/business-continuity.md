# Business Continuity

## What exists

- **Backup verification bookkeeping:** `operational_readiness.
  record_backup_verification()` distinguishes "a backup was taken" from
  "a restore was actually tested and confirmed to produce usable data"
  — the latter (`restore_tested=True`) should only ever be set after a
  genuine restore, never as a formality. No storage backend is
  integrated; this is the record-keeping layer only.
- **Background-job stall detection:** `operational_readiness.
  is_job_stalled()` — fails closed (a job that has never reported a
  heartbeat is treated as stalled, not "unknown, assume fine").
  Relevant to the existing app's `scheduler.py` loops
  (`payment_run_scheduler_loop`, `reconciliation_loop`,
  `process_scheduled_collections`) once wired in — not yet connected to
  those loops.
- **Health aggregation:** `operational_readiness.check_health()` — a
  pure aggregation function; overall health is False if any single
  component is unhealthy, with no partial-credit averaging. Not yet
  wired into an actual `/health` HTTP endpoint (task section 14's
  "health and readiness endpoints" item — the aggregation logic exists,
  the endpoint doesn't).
- **Wind-down runbook:** `runbooks/wind-down.md` — what must keep
  working (complaints, hardship, document access, existing repayments)
  versus what must stop (new customer activation, new disbursements)
  when `launch_gates.is_production_authorized()` goes False.

## What doesn't exist (stated plainly)

- No actual backup/restore infrastructure — this is entirely dependent
  on whatever hosting platform this eventually runs on (the existing
  app's `DEPLOYMENT.md` covers Docker/nginx deployment structure from a
  prior session, not backup automation).
- No disaster-recovery site, failover mechanism, or RTO/RPO targets
  defined for the pilot specifically.
- No deployment rollback procedure documented for the pilot's specific
  migrations (012–023) beyond the general git/database-migration
  discipline already followed (additive-only migrations, never applied
  to a live database yet).

## Launch-gate mapping

This maps to `launch_gates.py`'s `business_continuity_test_passed`
gate, which correctly remains unapproved — the code above is real and
tested, but a genuine business-continuity test (simulating an actual
outage and confirming recovery) has not been run.
