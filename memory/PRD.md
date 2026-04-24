# EasyBillsPay - Product Requirements Document

## Original Problem Statement
Build www.easybillspay.com.au - a utility bill management and payment portal where customers upload bills, choose a fixed deduction plan (weekly/fortnightly/monthly with 8% safety buffer), and the company auto-pays their bills.

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI, Recharts, Lucide-React
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib, pdfplumber, reportlab, emergentintegrations (Stripe + OpenAI GPT Vision), cryptography (Fernet)
- **Payments**: Stripe Checkout (Card + BECS Direct Debit ready), Admin BPAY/bank payments
- **Bill Extraction**: pdfplumber (text PDFs) + GPT-4o Vision (images/scanned PDFs) + Accurassi API
- **Encryption**: Fernet (AES-128-CBC)
- **Domain**: www.easybillspay.com.au

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
11. Legal Pages - Privacy Policy, Terms of Service, BECS DDR Service Agreement (routed at /legal/privacy, /legal/terms, /legal/becs)
12. Compliance Checkboxes - T&C acceptance on Registration, BECS DDR agreement on Payment Plan
13. Resend Email Integration - With graceful fallback if API key missing
14. Security Headers, Rate Limiting, CORS, JWT 4hr expiry

## Pending / Backlog
- P1: Refactor server.py (~2800 lines) into routes/, models/, utils/ modules
- P1: Collect Resend API Key from user for live email delivery
- P1: Collect Accurassi API Key from user for live bill sync
- P2: Real Accurassi integration once key is provided
