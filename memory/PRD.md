# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills. Features include Stripe payments, auto-deductions, OCR bill extraction, notifications, admin analytics, and report exports.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe), cryptography (Fernet)
- **Payments**: Stripe Checkout via emergentintegrations (Card + BECS Direct Debit ready)
- **Design**: Swiss corporate theme (Outfit + Manrope fonts), fully mobile-responsive
- **PDF Extraction**: pdfplumber (pure Python, no system deps) + Accurassi API fallback (ready for credentials)
- **Encryption**: Fernet (AES-128-CBC) field-level encryption for all sensitive financial data
- **Schedulers**: Auto-deductions (60s), notifications (120s) via asyncio background tasks

## All Features Implemented
1. Customer Dashboard - Stats, overdue alerts, upcoming/paid bills, plan status
2. Bill Management - Upload via PDF text extraction / manual entry, table with search/filter
3. Smart Payment Plan - 3 fixed deduction options with 8% safety buffer
4. Stripe Payment Gateway - Wallet top-ups via Stripe checkout (Card + BECS option)
5. Scheduled Auto-Deductions - Background auto-pay for due bills
6. Payment Methods - CRUD for bank accounts and credit/debit cards
7. Transaction History - Full audit trail
8. Notification System - Overdue, upcoming (5-day), low balance alerts with bell UI
9. Email Reminders - Simulated (ready for real email service)
10. Settings - Bank details, DDR mandates, provider connections
11. Admin Financial Overview - KPIs + Recharts charts with PDF export
12. Admin Outstanding Bills - Grouped by period with CSV/PDF export
13. Admin Customer Analytics - Risk levels with CSV export
14. Mobile Responsive - Collapsible sidebar, responsive grids/tables
15. PCI DSS Compliance - Fernet encryption at rest, masked API responses, Stripe-hosted payment collection
16. Admin Compliance Dashboard - /api/security/compliance-status endpoint
17. Data Migration Tool - /api/admin/encrypt-existing-data for encrypting legacy plaintext data

## Completed (Feb 2026)
- [x] Refactored PDF/bill extraction from pytesseract/pdf2image to pdfplumber (pure Python)
- [x] Image uploads gracefully prompt manual entry instead of crashing
- [x] Fernet encryption at rest for bank details (account_number, routing_number)
- [x] Fernet encryption at rest for DDR mandates (bsb, account_number, provider_account_number)
- [x] Fernet encryption for payment methods BSB
- [x] Raw card numbers never stored - only last 4 digits
- [x] Stripe BECS Direct Debit option wired (needs enabling in Stripe Dashboard for production)
- [x] PCI compliance status admin endpoint
- [x] Data migration endpoint for encrypting existing plaintext data

## Mocked Components
- Email notifications (simulated to console/DB)
- Auto-deductions (simulated wallet credit)
- Accurassi API (PDF extraction fallback, no credentials)
- BECS Direct Debit (wired but test Stripe key doesn't support it - enable in production Stripe Dashboard)

## P1 - Remaining
- [ ] Wire up real email service (Resend/SendGrid)
- [ ] Enable BECS Direct Debit in production Stripe Dashboard

## P2 - Backlog
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] User profile settings/avatar
