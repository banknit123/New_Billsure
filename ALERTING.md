# Alerting

## Reconciliation exceptions

`reconciliation_exceptions` rows are a stop-ship signal — see
`backend/reconciliation.py`'s module docstring: a nonzero internal
variance means the ledger and the sum of customer balances have drifted,
which should never happen by construction unless there's a bug or an
out-of-band database edit. `payment_runs.approve_payment_run()` refuses
to approve any payment run while an exception is open. Before this,
nothing told anyone an exception had been created — it just sat in the
table until someone happened to check `GET /admin/reconciliation/exceptions`.

Two independent alert channels now fire the moment
`reconciliation.run_trust_reconciliation()` creates a
`reconciliation_exceptions` row. Both are best-effort and pluggable —
neither is required, but at least one should be configured before this
goes anywhere near real money:

### 1. Email — `OPS_ALERT_EMAIL`

Set to an email address. Sends via the existing `utils.auth.send_email`
(Resend, if `RESEND_API_KEY` is set — otherwise it just logs what would
have been sent, same as every other email in this codebase).

### 2. Webhook — `RECONCILIATION_ALERT_WEBHOOK_URL`

`reconciliation.notify_reconciliation_exception(exception)` POSTs a
plain-text summary (not JSON — see below) to whatever URL this env var
points at:

```
BillSure reconciliation exception: internal_variance
Amount variance: $12.34
Reconciliation run: <uuid>
Exception id: <uuid>
Payment run approval is blocked until this exception is resolved.
Review it at /admin/reconciliation/exceptions.
```

Deliberately **not** wired to any specific alerting service — this
project hasn't picked one, and shouldn't be forced to via a code change
later. Point it at whatever you actually use:

- **Slack**: an [incoming webhook](https://api.slack.com/messaging/webhooks)
  URL. Slack accepts a raw text body on `text/plain` content type for a
  basic message (no JSON payload wrapping required for a plain summary
  like this one).
- **PagerDuty**: their
  [Events API v2](https://developer.pagerduty.com/docs/events-api-v2/overview/)
  generic webhook, or a routing proxy in front of it if you need the
  payload reshaped into their expected JSON structure.
- **Anything else**: any HTTP endpoint that accepts a POST with a
  plain-text body — an internal on-call tool, a logging aggregator's
  webhook ingest, etc.

If your target service requires a specific JSON shape rather than plain
text, put a small adapter in front of it (a Cloudflare Worker, a Lambda,
an internal endpoint) and point `RECONCILIATION_ALERT_WEBHOOK_URL` at
the adapter instead of changing `notify_reconciliation_exception()`
itself to know about one specific service.

### Never fails silently

If `RECONCILIATION_ALERT_WEBHOOK_URL` isn't set, or the POST itself
fails (network error, non-2xx response), `notify_reconciliation_exception()`
logs at **ERROR** level rather than doing nothing — a missing or broken
alert channel is itself something that needs to be noticed, not
swallowed. Same principle applies to the email channel via `_alert_ops()`
(logs a warning if `OPS_ALERT_EMAIL` is unset).

Set at least one of `OPS_ALERT_EMAIL` / `RECONCILIATION_ALERT_WEBHOOK_URL`
before relying on reconciliation to actually protect anything — right
now, with neither set, an exception is still fully recorded and still
blocks payment-run approval, but nobody is told it happened until they
go looking.
