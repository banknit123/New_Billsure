# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills. Features include Stripe payments, auto-deductions, OCR bill extraction, notifications, admin analytics, and report exports.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe)
- **Payments**: Stripe Checkout via emergentintegrations
- **Design**: Swiss corporate theme (Outfit + Manrope fonts), fully mobile-responsive
- **PDF Extraction**: pdfplumber (pure Python, no system deps) + Accurassi API fallback (ready for credentials)
- **Schedulers**: Auto-deductions (60s), notifications (120s) via asyncio background tasks

## All Features Implemented
1. Customer Dashboard - Stats, overdue alerts, upcoming/paid bills, plan status
2. Bill Management - Upload via PDF text extraction / manual entry, table with search/filter
3. Smart Payment Plan - 3 fixed deduction options with 8% safety buffer
4. Stripe Payment Gateway - Wallet top-ups via Stripe checkout
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

## Completed (Feb 2026)
- [x] Refactored PDF/bill extraction from pytesseract/pdf2image (system deps) to pdfplumber (pure Python)
- [x] Image uploads gracefully prompt manual entry instead of crashing
- [x] Removed pytesseract and pdf2image from requirements.txt

## Mocked Components
- Email notifications (simulated to console/DB)
- Auto-deductions (simulated wallet credit)
- Accurassi API (PDF extraction fallback, no credentials)
- Image OCR (requires Accurassi API credentials for image-based bill scanning)

## P1 - Remaining
- [ ] Wire up real email service (Resend/SendGrid)
- [ ] Bill sharing with family/roommates

## P2 - Backlog
- [ ] Payment history timeline view
- [ ] User profile settings/avatar
