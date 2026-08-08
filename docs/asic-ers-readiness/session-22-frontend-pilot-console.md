# ASIC ERS Readiness — Session 22 Notes (pilot console integrated into the real BillSure frontend)

Cut from `main`. Direct follow-up to a clarifying question: session 20's
standalone HTML console wasn't what was wanted — this session builds
the equivalent inside the **actual, existing** BillSure/EasyBillsPay
React frontend (`frontend/`), matching its real design system, rather
than a separate invented tool.

## The three things "the BillSure website" could have meant

Clarified with the person before building anything, since each option
is a genuinely different task with different risk:

- **The `billsure.com.au` root domain** — built with GoDaddy's own
  Website Builder (confirmed from the DNS records seen in an earlier
  session: `A @ → WebsiteBuilder Site`). Not code, not in this repo,
  not something Git/GitHub can touch or sync with at all.
- **This repo's `frontend/` React app** — real code, deploys (per
  `DEPLOYMENT.md`) to `www.easybillspay.com.au`, connected to
  `server.py` and the **live** product database. This is what was
  actually meant.
- **The standalone HTML console from session 20** — deliberately
  separate from both of the above, which turned out not to be the
  point.

## What this session built

`frontend/src/pages/AsicPilotConsole.jsx` — the same functional
coverage as session 20's console (status, onboarding + credit
activation, bill upload + payment, hardship, complaints, balance) but
built with the app's own real components (`Card`, `Button`, `Input`,
`Tabs`, `Badge` from `src/components/ui/`) and real brand tokens (navy
`#002855`, teal `#00C4A6`, the actual `/logo-horizontal.png`), matching
the visual language of `Dashboard.jsx` and the rest of the product
rather than looking like a separate tool bolted on.

Wired in via **exactly one new route** in `App.js`
(`/asic-pilot` → `AsicPilotConsole`), added with **zero deletions and
zero modifications to any existing line** — confirmed directly via
`git diff --stat` before committing (`App.js | 7 insertions(+)`, one
new file, nothing else touched).

## Kept deliberately independent, even though it's now the same codebase

- Talks only to `PILOT_API_BASE` (the separate `pilot_api.py` service
  and its separate sandbox database) — never to the `API` constant
  (`App.js`'s `REACT_APP_BACKEND_URL`) that every other page in this
  app uses, which points at the live product's backend and live
  customer data.
- Uses its own API-key auth, stored under a distinct `localStorage` key
  (`billsure_pilot_key`), never touching the `token` key the rest of
  the app uses for real user sessions via `AuthContext`.
- The new route sits outside the `user`-gated routes entirely — no
  dependency on `AuthContext`, no interaction with the existing login/
  logout flow.

## Verification, given no full app build was run

Installing this app's complete dependency tree (many Radix UI
packages, several with peer-dependency conflicts observed directly
when attempted) was judged too slow for this session's scope.
Verified instead via a targeted, real check: installed `esbuild` in an
isolated scratch directory and used it to actually parse/transpile
`AsicPilotConsole.jsx` and the modified `App.js` — both came back
syntactically valid, not just "looks right." Separately confirmed
every imported UI component (`card`, `button`, `input`, `label`,
`textarea`, `badge`, `tabs`) exists as a real file with matching named
exports (`grep`-verified against each file's actual `export`
statement, not assumed from familiarity with shadcn/ui's usual API).

**Not verified**: a full webpack/craco production build, and the app
has not been run in a browser. This is real syntax/import verification,
not a full build-and-click-through confirmation — stated honestly
rather than implied as more complete than it is.

## A real deployment risk, flagged directly and in code

This frontend deploys (per `DEPLOYMENT.md`) to the live product's real
customer-facing domain. Adding `/asic-pilot` as a normal route means
if/when this app is next deployed there, that route becomes reachable
on the live domain too — there is currently no build-time flag or
gating excluding it. Documented explicitly in three places: this note,
a comment at the top of `AsicPilotConsole.jsx`, and a new section in
`DEPLOYMENT.md` telling whoever deploys this next to decide
deliberately whether that's acceptable before shipping to
`www.easybillspay.com.au`.

## Deliberate scope limits this session

- No full build/browser verification (see above).
- No build-time gating added to exclude `/asic-pilot` from a
  production deploy — flagged as something to decide before the next
  real deploy, not solved here.
- Doesn't reuse this app's existing `axiosInstance`/auth patterns,
  deliberately — a plain `fetch()`-based hook instead, to avoid any
  chance of the pilot API key and the live product's bearer token ever
  being sent to the wrong backend.
