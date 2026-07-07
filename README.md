# Dreampick Private Limited — Full-stack Platform

Production-ready EV scooter platform with a binary-tree referral network, three commission types (Buyer Cashback, Direct Referral, 1:1 Matching), a secure admin portal, and category-based media management.

## Stack
- **Backend**: FastAPI + Motor (async MongoDB), APScheduler, ReportLab, cryptography.Fernet
- **Frontend**: React (CRA + CRACO) + Tailwind + Shadcn UI + Recharts
- **Auth**: JWT (Bearer + cookies), bcrypt password hashing

## Environment

### `/app/backend/.env`
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=dreampick_db
JWT_SECRET=<random>
BANK_ENCRYPTION_KEY=<fernet-key>
ADMIN_EMAIL=dreampickev@gmail.com
ADMIN_PASSWORD=dreampick@123
COMPANY_NAME=Dreampick Private Limited
GST_NUMBER=29AAMCD4327L1Z6
PLAN_PRICE=54999
SCHEDULER_INTERVAL_MINUTES=60
```

### `/app/frontend/.env`
```
REACT_APP_BACKEND_URL=https://<your-app>.preview.emergentagent.com
```

## Admin credentials (initial)
| Email | Password |
|-------|----------|
| `dreampickev@gmail.com` | `dreampick@123` |

Set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the backend `.env`.

---

## Production Data Reset

Wipe all customer/order/tree/commission/cashback/notification data and keep only the configured admin, system settings and (optionally) media.

### One-line command (from `/app/frontend`)
```
yarn reset-production-data
```

You will be prompted to type `RESET` to confirm. Non-interactive CI usage:
```
ADMIN_EMAIL=dreampickev@gmail.com \
ADMIN_PASSWORD='dreampick@123' \
BACKEND_URL=https://<your-app>.preview.emergentagent.com \
PRESERVE_MEDIA=true \
yarn reset-production-data --yes
```

### What it deletes
- users (except configured admin)
- tree_nodes, orders, commissions, cashback_schedule
- wallet_transactions, withdrawal_requests, bank_accounts, payout_receipts
- notifications, bank_reveal_sessions, password_reset_tokens, audit_logs
- counters (user_code / order_number sequences)
- media_assets — only when `PRESERVE_MEDIA=false`

### What it preserves
- Admin account (`ADMIN_EMAIL` from backend env)
- `system_settings` (commission configs, company name, GST, plan price, rounding modes)
- Media assets (unless explicitly wiped)

### Backend endpoint used
`POST /api/admin/reset-production-data`  (requires admin bearer token)
```json
{ "confirm": "RESET_ALL_CUSTOMER_DATA", "preserve_media": true }
```

---

## Media Manager (Admin → Media)

Every media category maps to exactly one place on the site. Single-slot uploads auto-replace the previous file for that category.

### Single-slot categories
| Category | Where it appears |
|----------|------------------|
| `COMPANY_LOGO` | Navbar and login page |
| `HERO_SCOOTER` | Home hero product image |
| `HERO_BACKGROUND` | Optional decorative hero background |
| `ABOUT_US` | About Us section image |
| `COMPANY_MD_PHOTO` | Leadership card — Managing Director (Suma B) |
| `CO_DIRECTOR_PHOTO` | Leadership card — Co-Director (Venkatesh Naik) |
| `CHIEF_GUEST_MR_FAZI` | Chief Guest card (Mr Fazi) |
| `CHIEF_GUEST_VISHAL_MEHARVADE` | Chief Guest card (Vishal Meharvade) |
| `CHIEF_GUEST_SRINIVAS` | Chief Guest card (Srinivas) |
| `CHIEF_GUEST_HEMANTH_KUMAR` | Chief Guest card (Hemanth Kumar) |
| `COMPANY_LICENSE_1` … `COMPANY_LICENSE_6` | Licenses section (below Gallery) |

### Multi-slot categories
| Category | Where it appears |
|----------|------------------|
| `GALLERY_IMAGE` | Gallery slider (images) |
| `GALLERY_VIDEO` | Gallery slider (videos) |

### Leadership photos (MD & Co-Director)
1. Sign in as admin → **Admin → Media**.
2. Under **Leadership (MD & Co-Director)**, upload a portrait image for **`COMPANY_MD_PHOTO`** and **`CO_DIRECTOR_PHOTO`** (JPG/PNG/WEBP). The photo will appear large on the Home page with a 3D tilt/glow on hover and a click-to-open lightbox.

### Licenses (up to 6 slots — images or PDF)
1. **Admin → Media → Licenses & Certificates**.
2. For each `COMPANY_LICENSE_1..6` slot, fill in **title**, optional **description**, **issue date**, **expiry date**, and choose **an image or PDF file**.
3. Click **Upload** — the tile appears in the **Licenses** section on the Home page (below Gallery) at `#license`.
4. On the Home page, clicking a license tile opens a modal that:
   - Renders an image preview, or
   - For PDFs, offers *View in new tab* and *Download*.

### Live Preview panel
At the top of the Media Manager, the **Live Preview** panel shows all currently uploaded media grouped by Company, Leadership, Chief Guests, Licenses, and Gallery.

---

## Local development
```
# Backend
cd /app/backend && pip install -r requirements.txt

# Frontend
cd /app/frontend && yarn install

# Services are supervised — no manual start required in the container
sudo supervisorctl restart backend frontend
```

## Test credentials
See `/app/memory/test_credentials.md`.
