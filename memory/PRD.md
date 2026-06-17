# BillSure - Product Requirements Document

## Original Problem Statement
Build www.billsure.com.au - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, Supabase (Postgres), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe + OpenAI GPT Vision), cryptography (Fernet)
- **Database**: Supabase Postgres with RLS, audit triggers, indexes
- **Auth**: Supabase Auth (email/password) with custom JWT fallback for backward compatibility
- **Password Reset**: Built-in via Supabase Auth recovery flow (/forgot-password)
- **Payments**: Stripe Checkout (Card + BECS Direct Debit ready), Admin BPAY/bank payments
- **Bill Extraction**: pdfplumber (text PDFs) + GPT-4o Vision (images/scanned PDFs) + Accurassi API
- **Encryption**: Fernet (AES-128-CBC)
- **Domain**: www.billsure.com.au

## All Features Implemented
1. Landing Page - Hero, stats, How It Works, Features, Security, FAQ, Testimonials, CTA, Footer
2. Bill Extraction - PDF/JPEG/PNG via GPT Vision + pdfplumber
3. Bill Management - Table with Biller Code + Reference Number
4. Smart Payment Plan - 3 options with 8% safety buffer
5. Stripe Payments - Card + BECS
6. Auto-Deductions - Background scheduler
7. Admin Payment Processing - View/pay bills on behalf of customers
8. Admin Analytics - Financial overview, outstanding, customers
9. PCI DSS Compliance - Encryption at rest
10. Mobile Responsive
20. Progressive Web App (PWA) — installable from browser, offline-capable, standalone display
    - Web App Manifest with 8 icon sizes (72-512px)
    - Service Worker with cache-first strategy for static assets, network-first for API
    - iOS/Android "Add to Home Screen" install prompt banner
    - Mobile bottom navigation bar (Home, Bills, Insights, More)
    - Safe area support for iOS notch devices
    - Standalone mode (no browser chrome)
11. Legal Pages - Privacy Policy, Terms of Service, BECS DDR Service Agreement (routed at /legal/privacy, /legal/terms, /legal/becs)
12. Compliance Checkboxes - T&C acceptance on Registration, BECS DDR agreement on Payment Plan
13. Resend Email Integration - With graceful fallback if API key missing
14. Security Headers, Rate Limiting, CORS, JWT 4hr expiry
15. AI Bill Intelligence - GPT-4o powered spending analysis with dashboard summary cards + dedicated insights page (/dashboard/insights)
    - Spending overview & trend detection (increasing/decreasing/stable)
    - Category breakdown with Australian benchmark comparisons
    - Provider comparison within utility categories
    - AI-generated highlights, savings tips, seasonal patterns
    - 15-minute server-side cache to reduce API costs
16. Billing Smoothing Engine (v2) - /app/backend/billing_engine.py
    - Annual bill prediction with Australian seasonal weighting (12-month forecast)
    - Monthly equalised payment calculator (true smoothing, not divide-by-12)
    - Excess/deficit balancing logic (plan health: healthy/tight/deficit)
    - Savings vs traditional billing comparison with predictability scores
    - API: /api/v2/predict-bills, /api/v2/simulate-plan, /api/v2/plan-health, /api/v2/savings-comparison
17. Subscription Pricing Layer (v2)
    - 3 tiers: Basic (Free, 5 bills), Standard ($9.90/mo, unlimited + AI), Premium ($19.90/mo, multi-property + 5% buffer)
    - API: /api/v2/subscription/tiers, /api/v2/subscription/current, /api/v2/subscription/select
18. Forecast Dashboard (/dashboard/forecast "Your Annual Plan")
    - 12-month Traditional vs Smoothed area chart (Recharts)
    - Stats: Fixed payment, annual predicted, peak month, seasonal variance
    - Plan health banner with 90-day projection
    - Savings comparison: predictability, peak bill, variance
    - Weekly/Fortnightly/Monthly frequency toggle
19. Production Deployment Structure
    - Dockerfile.backend, Dockerfile.frontend, docker-compose.yml, nginx.conf
    - .env.example with all environment variables
    - DEPLOYMENT.md with branch strategy and upgrade checklist

## Design
- **Color Palette**: Navy (#002855) + Teal (#00C4A6) + White
- **Logo**: /app/frontend/public/logo.png (BillSure with teal dollar icon)
- **Fonts**: Outfit (headings), Manrope (body)
- **UI Library**: Shadcn UI + TailwindCSS + Recharts

## Pending / Backlog
- P2: Further refactor server.py routes into separate route files
- P2: Add GET /api/health endpoint for monitoring
- P3: Cache subscription tier per-request to reduce DB calls
