# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills. Features include Stripe payments, auto-deductions, bill extraction with Biller Code/Reference Number, notifications, admin analytics, admin payment processing, and report exports.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI (Accordion, Button, Select), Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe), cryptography (Fernet)
- **Payments**: Stripe Checkout (Card + BECS Direct Debit ready), Admin BPAY/bank payments
- **Design**: Swiss corporate theme (Outfit + Manrope fonts), fully mobile-responsive
- **PDF Extraction**: pdfplumber (pure Python) + regex for Biller Code, Reference Number, Amount, Due Date, Provider, Account Number
- **Encryption**: Fernet (AES-128-CBC) field-level encryption for all sensitive financial data
- **Schedulers**: Auto-deductions (60s), notifications (120s) via asyncio background tasks

## All Features Implemented
1. **Landing Page** - Hero, animated stats, How It Works, Feature showcases, Security badges, 12-Q FAQ, Testimonials, CTA, Footer
2. Customer Dashboard - Stats, overdue alerts, upcoming/paid bills, plan status
3. Bill Management - Upload via PDF extraction / manual entry, table with Biller Code + Reference columns
4. Smart Payment Plan - 3 fixed deduction options with 8% safety buffer
5. Stripe Payment Gateway - Wallet top-ups (Card + BECS option)
6. Scheduled Auto-Deductions - Background auto-pay for due bills
7. Payment Methods - CRUD for bank accounts and credit/debit cards
8. Transaction History - Full audit trail
9. Notification System - Overdue, upcoming, low balance alerts
10. Email Reminders - Simulated (ready for real email service)
11. Settings - Bank details, DDR mandates, provider connections
12. Admin Financial Overview - KPIs + Recharts charts with PDF export
13. **Admin Payment Processing** (NEW) - View all pending bills with Biller Code, Reference Number, customer details grouped by provider. Single-pay and bulk-pay with payment reference tracking.
14. Admin Outstanding Bills - Grouped by period with CSV/PDF export
15. Admin Customer Analytics - Risk levels with CSV export
16. Mobile Responsive - Collapsible sidebar, responsive grids/tables
17. PCI DSS Compliance - Fernet encryption, masked API responses, Stripe-hosted payment
18. Admin Compliance Dashboard - /api/security/compliance-status
19. Data Migration Tool - /api/admin/encrypt-existing-data

## Bill Model Schema
- category, provider, account_number, biller_code, reference_number, bpay_code
- amount, due_date, frequency, status (pending/paid/overdue)
- paid_by (auto/admin/customer), paid_at, payment_reference

## Key API Endpoints
- POST /api/bills/extract - Extracts biller_code, reference_number, amount, due_date, provider from PDF
- GET /api/admin/payment-queue - All pending bills with payment details grouped by provider
- POST /api/admin/pay-bill - Admin marks single bill as paid (with bank transfer reference)
- POST /api/admin/pay-bills-bulk - Bulk pay multiple bills

## Mocked Components
- Email notifications (simulated to console/DB)
- BECS Direct Debit (test Stripe key doesn't support it - enable in production)
- Accurassi API (no credentials)

## P1 - Remaining
- [ ] Wire up real email service (Resend/SendGrid)
- [ ] Enable BECS Direct Debit in production Stripe Dashboard

## P2 - Backlog
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] User profile settings/avatar
- [ ] Newsletter subscription endpoint
