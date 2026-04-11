# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com, a comprehensive utility bill management and payment portal where:
- Customers upload bills and the system calculates 3 fixed deduction options (weekly/fortnightly/monthly)
- Company auto-pays customer bills using collected deductions
- 8% safety buffer on calculations to protect the company from shortfalls
- Customer dashboard shows paid/outstanding/overdue bills, payment plan status
- Admin dashboard provides financial overview, outstanding bills by period, and customer analytics
- Real Stripe payment gateway for wallet funding
- Scheduled auto-deductions that automatically process and pay bills

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pytesseract, emergentintegrations (Stripe)
- **Payments**: Stripe Checkout via emergentintegrations library
- **Design**: Swiss & High-Contrast corporate theme, Outfit + Manrope fonts
- **OCR**: Server-side pytesseract + Accurassi API (ready for credentials)
- **Scheduler**: asyncio background task for auto-deductions every 60s

## Key Features Implemented
1. **Customer Dashboard** - Stats overview, overdue alerts, upcoming/paid bills, plan status
2. **Bill Management** - Upload via OCR scan or manual entry, table with search/filter
3. **Smart Payment Plan** - 3 fixed deduction options with 8% safety buffer
4. **Stripe Payment Gateway** - Fund wallet via Stripe checkout ($50/$100/$250/plan amount)
5. **Scheduled Auto-Deductions** - Background scheduler processes deductions and auto-pays due bills
6. **Payment Methods** - CRUD for bank accounts and credit/debit cards
7. **Transaction History** - Full history of deductions, auto-payments, Stripe top-ups
8. **Settings** - Bank details, DDR mandates, provider connections
9. **Admin Financial Overview** - KPIs, collected vs owed, cash flow forecast with Recharts
10. **Admin Outstanding Bills** - Grouped by period (overdue, 0-30, 30-60, 60-90, 90+ days)
11. **Admin Customer Analytics** - Risk levels, payment compliance, wallet coverage

## Key API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Bills: GET/POST /api/bills, GET/PUT/DELETE /api/bills/{id}, POST /api/bills/extract
- Payment Plan: GET /api/payment-plan/calculate, POST /api/payment-plan/select, GET /api/payment-plan/current
- Stripe: POST /api/payments/create-checkout, GET /api/payments/status/{id}, POST /api/webhook/stripe, GET /api/payments/history
- Scheduler: POST /api/scheduler/trigger-now
- Transactions: GET /api/transactions/history
- Payment Methods: GET/POST /api/payment-methods, DELETE /api/payment-methods/{id}, PUT /api/payment-methods/{id}/set-primary
- Admin: GET /api/admin/financial-overview, GET /api/admin/outstanding-by-period, GET /api/admin/customer-analytics

## DB Collections
- `users`, `bills`, `transactions`, `payment_plans`, `payment_methods`, `payment_transactions`, `direct_debit_requests`, `provider_connections`, `bank_details`

## Mocked Components
- Auto-deductions simulate wallet credit (not actual bank debit)
- Accurassi API falls back to OCR (no credentials)
- Stripe checkout creates real sessions but status polling falls back to DB

## P1 - Remaining
- [ ] Email notifications for bill reminders
- [ ] Export admin reports to PDF/CSV

## P2 - Backlog
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] Mobile-responsive improvements
