# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe + OpenAI GPT Vision), cryptography (Fernet)
- **Payments**: Stripe Checkout (Card + BECS Direct Debit ready), Admin BPAY/bank payments
- **Bill Extraction**: 
  - PDFs (text-based): pdfplumber + improved regex (accounts, biller codes, BPAY refs with spaces)
  - Images (JPEG/PNG): OpenAI GPT-4o Vision via emergentintegrations
  - Scanned PDFs: pypdfium2 render → GPT Vision
  - Accurassi API (ready for credentials)
- **Encryption**: Fernet (AES-128-CBC) field-level encryption for all sensitive financial data
- **Schedulers**: Auto-deductions (60s), notifications (120s) via asyncio background tasks

## All Features Implemented
1. **Landing Page** - Hero, stats, How It Works, Features, Security, FAQ, Testimonials, CTA, Footer
2. Customer Dashboard - Stats, overdue alerts, upcoming/paid bills, plan status
3. **Bill Extraction** - Supports PDF/JPEG/PNG/any image via GPT Vision + pdfplumber
4. Bill Management - Table with Biller Code + Reference Number columns
5. Smart Payment Plan - 3 fixed deduction options with 8% safety buffer
6. Stripe Payment Gateway - Wallet top-ups (Card + BECS option)
7. Scheduled Auto-Deductions - Background auto-pay for due bills
8. Payment Methods - CRUD for bank accounts and credit/debit cards
9. Transaction History - Full audit trail
10. Notification System - Overdue, upcoming, low balance alerts
11. Settings - Bank details, DDR mandates, provider connections
12. Admin Financial Overview - KPIs + charts with PDF export
13. **Admin Payment Processing** - View pending bills with Biller Code/Ref, single and bulk pay
14. Admin Outstanding Bills - CSV/PDF export
15. Admin Customer Analytics - Risk levels with CSV export
16. PCI DSS Compliance - Fernet encryption, masked API, Stripe-hosted payments
17. Mobile Responsive

## Bill Model Schema
- category, provider, account_number, biller_code, reference_number, bpay_code
- amount, due_date, frequency, status, paid_by, paid_at, payment_reference

## Key API Endpoints
- POST /api/bills/extract - Extracts from PDF/JPEG/PNG (pdfplumber or GPT Vision)
- GET /api/admin/payment-queue - Pending bills with BPAY payment details
- POST /api/admin/pay-bill - Admin pays single bill
- POST /api/admin/pay-bills-bulk - Bulk pay

## Mocked Components
- Email notifications (simulated)
- BECS Direct Debit (test Stripe key)
- Accurassi API (no credentials)

## P1 - Remaining
- [ ] Wire up real email service (Resend/SendGrid)
- [ ] Enable BECS in production Stripe Dashboard

## P2 - Backlog
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] User profile settings/avatar
