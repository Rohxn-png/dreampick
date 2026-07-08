# Dreampick Private Limited — PRD

## Original Problem Statement (verbatim scope)
Build a production-ready EV scooter platform for **Dreampick Private Limited** with:
- Binary-tree referral network + admin-manual payouts (no gateway).
- Three commission types: Buyer 10-month Cashback, Direct Referral, 1:1 Matching Income.
- Secure admin portal (JWT, bcrypt) with encrypted bank details (Fernet) + audit log.
- Category-based media management (single-slot & multi-slot).
- Premium purple/gold visual identity, bilingual (English + Kannada) sections.
- Complete customer-data reset workflow.
- MD + Co-Director leadership photos on Home with premium 3D hover + lightbox.
- Licenses section (6 slots — image or PDF) below Gallery with metadata.

## Personas
- **Customer**: Buys the ₹54,999 EV plan, refers via link, earns 3 kinds of commissions, tracks cashback + wallet.
- **Admin (`dreampickev@gmail.com`)**: Approves/pays commissions & withdrawals, uploads media, reveals bank details (audited), can wipe all customer data via one command.

## Stack (approved by user)
- FastAPI + Motor async MongoDB + APScheduler + ReportLab + cryptography.Fernet
- React + CRA/CRACO + Tailwind + Shadcn UI + Recharts

## What's implemented (chronological)
### v1 — MVP
- Auth (JWT/bcrypt), Binary Tree BFS placement, mock orders, customer & admin dashboards.

### v2 — Business Model
- Sponsor-based commissions expanded to 3 types (Direct, Matching, Cashback).
- 10-month cashback scheduler (APScheduler cron).
- Admin secure bank-details reveal + audit logging + plan PDF export.

### v3 — Rebrand & Media
- Dreampick purple/gold theme + Chief Guest cards + Gallery slider.
- Fixed media categories with single-slot auto-replace strategy.
- Nav anchor scrolling, admin credentials → `dreampickev@gmail.com`.

### v4 — Iteration 4 (2026-07-07) — *this release*
- **Production data reset** — `POST /api/admin/reset-production-data`
  + `yarn reset-production-data` CLI script (`/app/frontend/scripts/reset-production-data.js`).
  Wipes users/tree/orders/commissions/cashback/wallet/withdrawals/bank/notifications/reveal sessions/PRT/receipts/audit logs/counters. Preserves admin, settings, media (media wipe optional).
- **MD & Co-Director photos** — new single-slot categories `COMPANY_MD_PHOTO`, `CO_DIRECTOR_PHOTO`.
  Home page renders large 3D-tilt cards with radial glow + click-to-open lightbox modal.
- **Licenses section (6 slots)** — categories `COMPANY_LICENSE_1..6`, supporting Image + PDF.
  MediaAsset extended with `title / description / issue_date / expiry_date / media_type`.
  Home page `#license` section below Gallery with 6 tiles; lightbox with "View in new tab" + "Download" for PDFs.
- **Admin Media Manager** — new slot cards + metadata form + live preview panel grouped by Company / Leadership / Chief Guests / Licenses / Gallery.
- **PublicNav** — added "License" link.
- **README.md** — comprehensive reset + media + license instructions.
- **Path traversal guard** on media serve endpoint.
- **Orphaned file cleanup** on `preserve_media=false` reset.

## Test coverage (2026-07-07)
- Backend pytest: **31/31 PASS** (see `/app/backend/tests/backend_test.py`)
  Includes: TestV5LeadershipMedia, TestV5LicenseMedia (PDF+image+metadata+mp4 rejection),
  TestV5AuthOnMediaAndReset, TestV5ResetProductionDataZZZLast (seed → reset → re-login → zero KPIs → media preserved).
- Frontend (Playwright): all v5 flows verified — nav-license, leadership tilt & lightbox,
  license 6-tile grid + lightbox + PDF View/Download, Admin Media live preview + license form.

## Known / carry-over
- Direct commission net = ₹2,475 exactly is *code-correct* (`tree_service.create_direct_referral_commission`, rounding "nearest_rupee" on gross then 10 % admin charge). After v4 reset, needs one live activation post-reset to reconfirm display in dashboard totals.
- Cosmetic: Kannada glyph spacing in Vision/Mission blocks — optional webfont improvement.

## Backlog / Roadmap
- **P1**: Split `routes.py` (1370 LOC) into modules — auth, admin/dashboard, admin/reset, media, commissions, withdrawals.
- **P1**: Payment gateway (currently manual admin approval only — mocked payout by design).
- **P2**: Kannada web font for bilingual sections.
- **P2**: Server-side PDF/image MIME sniffing on media upload (current risk low — admin-only endpoint).
- **P2**: Loan facility integration flow (marquee already advertises it).

## Test credentials
See `/app/memory/test_credentials.md`.

## Env keys (already configured)
- Backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `BANK_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `COMPANY_NAME`, `GST_NUMBER`, `PLAN_PRICE`, `SCHEDULER_INTERVAL_MINUTES`.
- Frontend: `REACT_APP_BACKEND_URL`.
