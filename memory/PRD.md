# Dreampick Private Limited — PRD & Implementation Log

## Overview
Full-stack production-ready EV scooter platform with three-commission structure:
- **Buyer Cashback**: ₹3,000/month gross, ₹300 admin, ₹2,700 net for 10 months (first payout 45 days after activation)
- **Direct Referral Commission**: ₹2,750 gross (5%), ₹275 admin, ₹2,475 net per successful referral
- **1:1 Matching Income**: ₹1,374 gross (2.5%), ₹137.40 admin, ₹1,236.60 net per new matched pair

All payouts are **manual admin-driven**. No real payment gateways.

## Stack
- Backend: FastAPI + Motor (async MongoDB), APScheduler (in-process), ReportLab (PDF), cryptography.Fernet (bank encryption)
- Frontend: React + Tailwind + Shadcn UI + Recharts
- Auth: JWT + bcrypt. Bearer token in localStorage (`dp_access_token`).

## Roles
- CUSTOMER
- ADMIN (single initial admin auto-seeded from env)
- (SUPER_ADMIN completely removed)

## Feature Set (v3)

### Public
- Home: Dreampick Private Limited branding on far left of navbar, sliding "Loan facility is also available here" ticker, EV scooter placeholder, bilingual English + Kannada Vision/Mission, GST card (29AAMCD4327L1Z6), Leadership (Suma B, Venkatesh Naik) with placeholder avatars, Managers carousel (Santhosh, Durgesh Koli, Manjunath Mudhol, Hanumanth Raj, Maruthi Ganti) with placeholder avatars, Gallery slider (empty state until upload).
- Plans page with three commission cards + Download PDF (branded purple/gold PDF via ReportLab).
- Registration: real-time referral validation, LEFT/RIGHT placement preview, no demo notice.
- Login: no demo buttons, forgot-password link.
- Forgot / Reset Password flow (dev token surfaced for demo — production would email).

### Customer Portal
- Dashboard: welcome card, referral code + Copy Link / Share / WhatsApp / Instagram / Plan PDF buttons, team counts, cashback stats card with next payout date, direct-referral + matching-income summary.
- Cashback schedule table with per-installment status.
- Notifications inbox.
- Tree visualization (level-based).
- Wallet with bank account management (masked account numbers), withdrawal requests.
- Profile.

### Admin Portal
- Dashboard with KPIs and Recharts (cashback pie, recent activations).
- Users list with search/filter → click View → **User Detail page** with:
  - **Bank Details for Manual Payment** card (masked initially).
  - **Reveal Full Bank Details** button → confirmation modal requiring a reason (Monthly Cashback Payout / Referral Commission Payout / 1:1 Matching Payout / Withdrawal Payment / Verification / Other) → full details revealed with per-field Copy buttons and Hide button.
  - Every REVEAL, COPY_ACCOUNT_NUMBER, COPY_IFSC, COPY_UPI_ID, HIDE_BANK_DETAILS action logged to AdminAuditLog with admin id, IP, user-agent, reason, timestamp.
  - Password Management card — set temp password (forces change at next login) or send reset link. Passwords never displayed.
- Orders / Activations: order stays PAYMENT_PENDING until admin clicks Activate → user activated, tree placement finalized, 10 cashback installments generated, direct-referral commission for sponsor created, matching-income commissions created for ancestors on new matched pairs.
- Buyer Cashback: table of scheduled installments with approve / hold / mark-paid (creates CASHBACK_CREDIT wallet transaction).
- Direct Commissions / Matching Income: separate tables per type with approve / reject / hold / reverse / mark-paid.
- Withdrawals: approve / reject / mark-paid.
- Media Manager: upload logo, hero, leadership photos, manager photos, gallery images/videos; per-media title/caption/order/visibility/person assignment.
- Notifications inbox with mark-read.
- Settings: three commission configs (Buyer Cashback, Direct Referral, 1:1 Matching) with live gross/deduction/net preview, rounding-mode selector, active/inactive toggle. Company Name + GST editable. Every change audit-logged.
- Audit Logs page.

### Data / Security
- Bank account numbers + UPI IDs stored **Fernet-encrypted** (`account_number_enc`) with `account_number_masked` for display.
- All admin actions on users / orders / cashback / commissions / withdrawals / bank / settings write to AdminAuditLog with IP + user-agent + reason where applicable.
- Password reset via token (bcrypt hashed at rest; never displayed).
- `must_change_password` flag on user; login response includes it so frontend can force change.
- Rounding: Direct commission uses `nearest_rupee` (₹2,750). Matching uses `round_down` (₹1,374). Deductions and net always use `two_decimals` to yield spec-exact figures.

### Scheduler
- In-process asyncio scheduler ticks every 60 min: promotes `SCHEDULED` cashback records to `DUE` when their `scheduled_date` arrives, and notifies all admins.

## Environment (`/app/backend/.env`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (initial admin auto-created)
- `BANK_ENCRYPTION_KEY` (Fernet)
- `JWT_SECRET`, `COMPANY_NAME`, `GST_NUMBER`, `PLAN_PRICE`, `SCHEDULER_INTERVAL_MINUTES`

## Data-Model Migration
On startup, if system_settings.data_model_version != "dreampick_v3", the DB is fully wiped and re-seeded with a single admin + three commission configs + one product placeholder. Once the marker is set, subsequent restarts are non-destructive.

## Deferred / Backlog
- P1: Rate limiting + brute-force lockout on `/auth/login`
- P1: Send real email for password reset (currently returns token in response body for demo)
- P2: Split monolithic `routes.py` into per-domain modules
- P2: Tree visualization polish — SVG connectors, zoom/pan/minimap
- P2: CSV/PDF payout statements from customer/admin views
- P2: UTM/source tracking on referral URLs
- P2: Payout screenshot upload on mark-paid confirmation (backend supports `payout_receipts` collection but UI not exposed)
- P2: Manual placement corrections in admin (with audit log)
- P2: Split cookies-vs-Bearer auth model (currently both are set, only Bearer is used by frontend)

## Credentials
- Admin: `admin@dreampick.co.in` / `Admin@Dreampick2026`

## Verified end-to-end (2026-02-05)
- Public config, plans, PDF ✓
- Admin login (Bearer) ✓
- Registration + referral placement + activation ✓
- Cashback schedule generation (10 records @ +45d then monthly) ✓
- Direct commission ₹2,750/₹275/₹2,475 ✓
- Matching commission ₹1,374/₹137.40/₹1,236.60 ✓
- Bank reveal flow with reason + audit logging ✓
- Register page free of demo notice + empty referral field ✓
- Purple/gold theme + Dreampick Private Limited branding + ticker ✓
