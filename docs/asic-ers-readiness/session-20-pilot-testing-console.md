# ASIC ERS Readiness — Session 20 Notes (a real browser UI for the pilot API)

Cut from `main`. Directly requested: "can I use this domain to get real
UI/UX for testing" — a fair point, since everything tested so far has
been PowerShell scripts, curl commands, or the developer-facing Swagger
`/docs` page. None of that feels like an actual product to click
through.

## What this session built

`backend/pilot_console.html` — a self-contained (no build step, no
external framework) browser console covering the full journey already
proven live in session 17: system status, onboarding + credit
activation, bill upload (real file picker, real server-side OCR) +
payment, hardship requests, complaints, and balance lookup. Every
action shows the real raw JSON response in a persistent log panel, so
nothing is hidden behind a friendly success message that could mask
what the API is actually doing.

Served directly by `pilot_api.py` at both `/` and `/console` — no
separate hosting, no new deployment, no new DNS record. It's live at
the exact same URL(s) the API already answers on, immediately after
the next Render deploy.

## Design notes

Built to the `frontend-design` skill's process (token plan → critique
→ build), deliberately avoiding the three generic "AI-generated" looks
it warns about (cream+terracotta serif, near-black+neon, broadsheet
newsprint). The chosen direction: a "compliance ledger" aesthetic —
IBM Plex Mono for data/labels, Inter for body text, a muted ink-teal
accent, an off-white paper background — grounded in what this actually
is (a regulatory sandbox console for a fintech pilot), not decoration.

**The one deliberate signature element**: a rotated, ink-stamp-style
"SANDBOX — NO REAL MONEY" badge, permanently visible in the sidebar.
This isn't just visual flair — it's a direct, load-bearing restatement
of the single most repeated fact across this entire 20-session
workstream (real-money functionality stays disabled until every launch
gate is genuinely approved), now visible to anyone using the console,
not just buried in a docstring or an evidence-pack file.

The gate-status indicator in the sidebar auto-checks on page load and
updates live — so "is this pilot currently authorized to move real
money" is the first thing visible, not something you have to go dig
for.

## Security note

The API key is entered once per browser and stored only in that
browser's `localStorage` — never transmitted anywhere except back to
this same API's `Authorization` header on requests the person
explicitly triggers by clicking a button. No key is embedded in the
page's source, no key is logged, nothing is sent to any third party.

## Test results

```
python3 backend/test_pilot_api.py   # 32/32 PASS (was 30, +2 checks for the console route)
```

Full regression sweep: `test_end_to_end_dummy_customer_journey.py`,
`test_pilot_auth.py` both passing unmodified.

## Deliberate scope limits this session

- This is an **internal testing console**, not a customer-facing
  consumer product — matches `pilot_auth.py`'s own documented scope
  (operator-issued API keys, not customer self-service auth). A real
  customer-facing UI would need proper customer authentication (magic
  link, OTP, or similar) that doesn't exist yet.
- No mobile-specific testing was done, though the layout uses standard
  responsive CSS patterns (flex layout, no fixed pixel widths beyond
  the sidebar) — not verified against an actual small viewport.
- The console doesn't cover every endpoint (e.g. no document-
  acceptance flow, no identity-verification-session flow) — it covers
  the same core journey session 17's live testing already proved,
  intentionally kept to what's been verified working rather than
  exposing every endpoint before each is confirmed live.
