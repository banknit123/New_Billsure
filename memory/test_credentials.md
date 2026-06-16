# Test Credentials

## Admin Account
- Email: admin@billseasypay.com
- Password: Admin123!

## Customer Account (Standard Tier)
- Email: test@billseasypay.com
- Password: Test123!

## Basic Tier Test Account
- Email: basicuser@test.com
- Password: Test123!

## Notes
- Brand name: BillSure (www.billsure.com.au)
- Tagline: "Never be surprised by a bill again"
- Database: Supabase Postgres
- Auth: Supabase Auth (email/password) with custom JWT fallback
- Admin login redirects to /admin, customer to /dashboard
- Forgot password: /forgot-password page
- Note: User emails still use @billseasypay.com domain (not migrated to avoid breaking Supabase Auth accounts)

## Stripe
- API Key: sk_test_emergent (test mode)

## Encryption
- Algorithm: Fernet (AES-128-CBC)
- Key location: /app/backend/.env ENCRYPTION_KEY

## Supabase
- Project URL: https://nojrxsbgcmoonnobagcv.supabase.co
- Service Key: in /app/backend/.env SUPABASE_SERVICE_KEY
