# EasyBillsPay v2 — Deployment & Branch Strategy
## Architecture

```
v2.easybillspay.com.au
├── Frontend (React, Nginx)    → Docker container port 3000
├── Backend (FastAPI, Uvicorn)  → Docker container port 8001
└── MongoDB 7                   → Docker volume (persistent)
```

## Branch Strategy

| Branch     | Purpose                          | Deploys to                      |
|------------|----------------------------------|---------------------------------|
| `main`     | Production (current v1)          | www.easybillspay.com.au         |
| `v2`       | v2 development                   | v2.easybillspay.com.au (staging)|
| `feature/*`| Feature branches off v2          | Local / PR previews             |

## Deployment Commands

### Local Development
```bash
docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8001
# MongoDB:  mongodb://localhost:27017
```

### Staging (v2.easybillspay.com.au)
```bash
docker-compose -f docker-compose.yml up -d --build
```

### Production Upgrade Path
1. Merge `v2` → `main` after full QA
2. Run database migration scripts (if any)
3. Deploy with zero-downtime rolling update
4. Monitor logs for 24 hours

## Environment Separation

| Variable          | Dev/Local              | Staging                            | Production                        |
|-------------------|------------------------|------------------------------------|-----------------------------------|
| MONGO_URL         | mongodb://localhost    | mongodb://mongo-staging:27017      | mongodb://mongo-prod:27017        |
| CORS_ORIGINS      | http://localhost:3000  | https://v2.easybillspay.com.au     | https://www.easybillspay.com.au   |
| STRIPE_API_KEY    | sk_test_...            | sk_test_...                        | sk_live_...                       |
| REACT_APP_BACKEND_URL | http://localhost:3000 | https://v2.easybillspay.com.au  | https://www.easybillspay.com.au   |

### ASIC ERS pilot console (optional, separate from the table above)

`REACT_APP_PILOT_API_URL` -- only used by `src/pages/AsicPilotConsole.jsx`
(the `/asic-pilot` route). Defaults to `https://pilot-api.billsure.com.au`
in code if unset, so it's genuinely optional to configure. Deliberately
NOT added to the main environment table above: this points at the
**separate** ASIC ERS pilot sandbox API and database
(`backend/pilot_api.py`, a different service from the one
`REACT_APP_BACKEND_URL` points at), and setting it has no effect on
anything else this app does. See `docs/asic-ers-readiness/` for the
full context on what this route is and is not authorised to do.

**Before deploying this frontend to a real customer-facing domain**,
decide deliberately whether `/asic-pilot` should be reachable there.
It is currently a normal route like any other in this app -- there is
no build-time flag excluding it from a production build. If you don't
want pilot testing pages reachable on the live product's domain,
either remove the route before that specific deploy, or gate it behind
something (a feature flag, a build variant) before shipping this app
to `www.easybillspay.com.au` or wherever it's actually served live.

## Safe Upgrade Checklist
- [ ] All tests pass on v2 branch
- [ ] Database migration scripts tested on staging
- [ ] Stripe webhook endpoint updated for new domain
- [ ] CORS origins include both old and new domains during transition
- [ ] DNS updated for v2 subdomain
- [ ] SSL certificates provisioned (Let's Encrypt)
- [ ] Rollback plan documented
