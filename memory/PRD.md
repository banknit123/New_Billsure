# BillsEasyPay - Product Requirements Document

## Original Problem Statement
Build www.billseasypay.com, a comprehensive utility bill management and payment portal. Features include user login, bill management, payment gateway simulation, smart payment structuring, an admin panel, bill upload with OCR, utility provider API connections (Accurassi), and a Direct Debit Request (DDR) system for automated payments.

## User Personas
- **Regular User**: Manages bills, uploads bills for OCR extraction, sets up direct debit, connects utility providers
- **Admin User**: Views platform stats, generates bulk payment reports, processes bulk payments

## Core Requirements
1. User authentication (register/login/JWT)
2. Dashboard with bill stats and wallet balance
3. Bill CRUD with categories (Electricity, Water, Gas, Internet, Mobile, Council, Insurance, etc.)
4. Bill upload with OCR extraction (server-side via pytesseract) + Accurassi API for PDF bills
5. Wallet management with simulated payments
6. Payment structure setup (weekly/fortnightly/monthly)
7. Bank details management
8. Direct Debit Request (DDR) system with BSB validation
9. Provider connection management
10. Admin panel with stats, user management, bulk payment reports

## Architecture
- **Frontend**: React.js, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT, Passlib
- **OCR**: Server-side pytesseract (replaced client-side tesseract.js)
- **Bill Extraction API**: Accurassi API (falls back to OCR when credentials not configured)

## What's Been Implemented
- Full MVP with all features listed above
- OpenElectricity API removed and replaced with Accurassi API integration
- Server-side OCR with improved regex patterns for bill data extraction
- Admin bulk payment report date filtering fixed
- All frontend pages functional (Landing, Login, Register, Dashboard, Bills, Wallet, Settings, Admin)

## Key API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Bills: GET/POST /api/bills, GET/PUT/DELETE /api/bills/{id}
- Bill Extract: POST /api/bills/extract (multipart file upload)
- Accurassi: GET /api/accurassi/status
- Wallet: POST /api/transactions/deposit, POST /api/transactions/pay-bill/{id}
- DDR: POST /api/direct-debit/create, GET /api/direct-debit/mandates
- Providers: POST /api/provider/connect, GET /api/provider/connections
- Admin: GET /api/admin/stats, GET /api/admin/bulk-payment-report, POST /api/admin/process-bulk-payment

## DB Schema
- `users`: {id, email, password, full_name, wallet_balance, is_admin, subscription_active, etc.}
- `bills`: {id, user_id, category, provider, account_number, amount, due_date, frequency, status}
- `transactions`: {id, user_id, type, amount, description, status}
- `bank_details`: {id, user_id, bank_name, account_number, routing_number, etc.}
- `direct_debit_requests`: {id, user_id, mandate_reference, bsb, account_number, provider, etc.}
- `provider_connections`: {id, user_id, provider_name, provider_type, account_number, etc.}
- `payment_structures`: {id, user_id, payment_frequency, contribution_amount, etc.}

## Mocked Components
- Payment gateway (simulated deposits/payments)
- Direct debit deductions (simulated)
- Accurassi API (falls back to OCR when no credentials configured)

## P0 - Completed
- [x] Replace OpenElectricity with Accurassi API
- [x] Fix OCR extraction (moved to server-side)
- [x] Fix admin bulk payment report date filtering

## P1 - Remaining
- [ ] Configure real Accurassi API credentials when available
- [ ] Real payment gateway integration (Stripe/PayPal)

## P2 - Backlog/Future
- [ ] Mock data script for DDR + Provider sync demo
- [ ] Email notifications for bill reminders
- [ ] Bill sharing with family/roommates
- [ ] Mobile responsive improvements
