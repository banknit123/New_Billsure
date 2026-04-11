# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com, a comprehensive utility bill management and payment portal where:
- Customers upload bills and the system calculates 3 fixed deduction options (weekly/fortnightly/monthly)
- Company auto-pays customer bills using collected deductions
- 8% safety buffer on calculations to protect the company from shortfalls
- Customer dashboard shows paid/outstanding/overdue bills, payment plan status
- Admin dashboard provides financial overview, outstanding bills by period, future liabilities, and customer analytics

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pytesseract
- **Design**: Swiss & High-Contrast corporate theme, Outfit + Manrope fonts
- **OCR**: Server-side pytesseract + Accurassi API (when credentials available)

## Key Features
1. **Customer Dashboard** - Stats overview, overdue alerts, upcoming/paid bills, plan status
2. **Bill Management** - Upload via OCR scan or manual entry, table with search/filter
3. **Smart Payment Plan** - 3 fixed deduction options (weekly/fortnightly/monthly) with 8% safety buffer
4. **Payment Methods** - CRUD for bank accounts and credit/debit cards
5. **Auto-Pay Simulation** - Deduction simulation that adds to wallet balance
6. **Settings** - Bank details, DDR mandates, provider connections
7. **Admin Financial Overview** - KPIs, collected vs owed, cash flow forecast with charts
8. **Admin Outstanding Bills** - Bills grouped by period (overdue, 0-30, 30-60, 60-90, 90+ days)
9. **Admin Customer Analytics** - Risk levels, payment compliance, wallet coverage

## Key API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Bills: GET/POST /api/bills, GET/PUT/DELETE /api/bills/{id}
- Bill Extract: POST /api/bills/extract (multipart file upload)
- Payment Plan: GET /api/payment-plan/calculate, POST /api/payment-plan/select, GET /api/payment-plan/current, POST /api/payment-plan/simulate-deduction
- Payment Methods: GET/POST /api/payment-methods, DELETE /api/payment-methods/{id}, PUT /api/payment-methods/{id}/set-primary
- Admin: GET /api/admin/financial-overview, GET /api/admin/outstanding-by-period, GET /api/admin/customer-analytics

## DB Schema
- `users`: {id, email, password, full_name, wallet_balance, is_admin}
- `bills`: {id, user_id, category, provider, account_number, amount, due_date, frequency, status}
- `payment_plans`: {id, user_id, frequency, deduction_amount, annual_total, buffered_annual, safety_buffer_pct, status, total_collected, total_paid_out}
- `payment_methods`: {id, user_id, type, label, bank_name, bsb, account_number_masked, card_last4, card_brand, is_primary}
- `transactions`: {id, user_id, type, amount, description, status}
- `direct_debit_requests`: {id, user_id, bsb, account_number, provider, max_amount, frequency}
- `provider_connections`: {id, user_id, provider_name, provider_type, account_number}

## What's Been Implemented (All tested, 100% pass rate)
- Full customer dashboard with redesigned corporate UI
- Payment Plan calculator with 3 options + 8% safety buffer
- Payment Methods CRUD (bank/card)
- Admin financial overview with Recharts charts
- Admin outstanding bills by period (overdue/30/60/90+ days)
- Admin customer analytics with risk levels
- OCR bill extraction via server-side pytesseract
- Accurassi API integration (ready for credentials)
- DDR and Provider Connection management

## Mocked Components
- Payment gateway (simulated deposits/payments)
- Payment plan deductions (simulated via endpoint)
- Accurassi API (falls back to OCR when no credentials)

## P1 - Remaining
- [ ] Real payment gateway integration (Stripe)
- [ ] Actual scheduled deductions (currently manual simulation)
- [ ] Configure real Accurassi API credentials

## P2 - Backlog
- [ ] Email notifications for bill reminders
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] Export reports to PDF/CSV
