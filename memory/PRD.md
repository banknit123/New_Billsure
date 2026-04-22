# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills. Features include Stripe payments, auto-deductions, OCR bill extraction, notifications, admin analytics, and report exports.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI (Accordion, Button), Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe), cryptography (Fernet)
- **Payments**: Stripe Checkout via emergentintegrations (Card + BECS Direct Debit ready)
- **Design**: Swiss corporate theme (Outfit + Manrope fonts), fully mobile-responsive
- **PDF Extraction**: pdfplumber (pure Python, no system deps) + Accurassi API fallback
- **Encryption**: Fernet (AES-128-CBC) field-level encryption for all sensitive financial data
- **Schedulers**: Auto-deductions (60s), notifications (120s) via asyncio background tasks

## All Features Implemented
1. **Landing Page** (NEW) - Hero, animated stats, How It Works (4 steps), Feature showcases (Bill Upload, Smart Plans, Auto-Pay, Payment Methods), Security trust badges, 12-question FAQ accordion, 3 testimonials, CTA banner, rich footer
2. Customer Dashboard - Stats, overdue alerts, upcoming/paid bills, plan status
3. Bill Management - Upload via PDF text extraction / manual entry, table with search/filter
4. Smart Payment Plan - 3 fixed deduction options with 8% safety buffer
5. Stripe Payment Gateway - Wallet top-ups via Stripe checkout (Card + BECS option)
6. Scheduled Auto-Deductions - Background auto-pay for due bills
7. Payment Methods - CRUD for bank accounts and credit/debit cards
8. Transaction History - Full audit trail
9. Notification System - Overdue, upcoming (5-day), low balance alerts with bell UI
10. Email Reminders - Simulated (ready for real email service)
11. Settings - Bank details, DDR mandates, provider connections
12. Admin Financial Overview - KPIs + Recharts charts with PDF export
13. Admin Outstanding Bills - Grouped by period with CSV/PDF export
14. Admin Customer Analytics - Risk levels with CSV export
15. Mobile Responsive - Collapsible sidebar, responsive grids/tables
16. PCI DSS Compliance - Fernet encryption at rest, masked API responses, Stripe-hosted payment collection
17. Admin Compliance Dashboard - /api/security/compliance-status endpoint
18. Data Migration Tool - /api/admin/encrypt-existing-data for encrypting legacy plaintext data

## Completed (Latest Session)
- [x] Refactored PDF/bill extraction to pdfplumber (pure Python, no system deps)
- [x] Fernet encryption at rest for all sensitive financial data (bank details, DDR, payment methods)
- [x] Stripe BECS Direct Debit option wired
- [x] PCI compliance status admin endpoint
- [x] **Complete Landing Page Redesign** - inspired by 1bill.com but with unique content
  - Hero section with animated floating stat cards
  - Stats bar with IntersectionObserver-powered counters
  - "How It Works" 4-step visual walkthrough
  - Feature sections: Bill Upload, Smart Payment Plans, Auto-Pay, Payment Methods
  - Security trust section (dark theme) with 4 badges
  - 12-question FAQ with Shadcn Accordion
  - 3 customer testimonials with star ratings
  - CTA banner, professional 4-column footer
  - Smooth scroll navigation, mobile hamburger menu

## Mocked Components
- Email notifications (simulated to console/DB)
- Auto-deductions (simulated wallet credit)
- Accurassi API (PDF extraction fallback, no credentials)
- BECS Direct Debit (wired but test Stripe key doesn't support it)

## P1 - Remaining
- [ ] Wire up real email service (Resend/SendGrid)
- [ ] Enable BECS Direct Debit in production Stripe Dashboard

## P2 - Backlog
- [ ] Bill sharing with family/roommates
- [ ] Payment history timeline view
- [ ] User profile settings/avatar
- [ ] Newsletter subscription (backend endpoint + frontend form)
