# Dream Pick — PRD & Implementation Log

## Product

**Dream Pick** — Full-stack demo web application for an EV scooter (Volt X1, ₹54,999) referral & binary-tree placement platform. Scooter purchase activates a user; new users pick LEFT/RIGHT placement under a sponsor. Each 1:1 matched pair triggers a ₹2,700 commission (PENDING → APPROVED → PAID by admin). Fully mocked payment flow — no real payments.

## Architecture

- **Frontend**: React (JS), Tailwind, Shadcn UI, Sonner toasts, Recharts, React Router.
- **Backend**: FastAPI (Python) + Motor (async MongoDB).
- **Auth**: JWT + bcrypt. Bearer token in localStorage (`dp_access_token`).
- **Data**: MongoDB with UUID-string `_id`s. Unique index on commissions `(beneficiary, pair_number)`; unique index on users `email` and `referral_code`.
- **Tree service**: BFS placement, ancestor count walk, idempotent commission creation.
- **Seed**: Runs on backend startup — SUPER_ADMIN, ADMIN, 16 active customers in a binary tree, 2 pending, orders in PAID/CREATED/FAILED states, mixed-status commissions, one withdrawal request.

## User personas

1. **Customer** — buys the scooter, refers others, earns commissions, requests withdrawals.
2. **Admin** — manages users, orders, commissions, withdrawals, settings; sees audit logs and integrity checks.
3. **Super Admin** — same as Admin plus reserved for future privileged actions.

## Core requirements

- Registration + referral with LEFT/RIGHT placement preview
- Mock payment flow → activates user + BFS-places them in tree
- Ancestor left/right count walk + idempotent commission creation on new matched pairs
- Customer portal: dashboard, tree, referrals, commissions, wallet + withdrawals, profile
- Admin portal: dashboard w/ charts, users, tree explorer + integrity check, orders, commissions, withdrawals, settings, audit logs
- Masked bank account numbers everywhere
- Audit logs on all admin actions
- Fully responsive dark-navy + electric blue theme

## Implemented (2026-02-05)

### Backend (`/app/backend/`)
- `server.py` — FastAPI app + startup seed + CORS
- `auth.py` — bcrypt password hashing, JWT create/verify, request dependencies (`get_current_user`, `get_current_admin`, `get_current_super_admin`)
- `db.py` — Motor client + collection accessors + `next_sequence()` counter helper
- `tree_service.py` — `preview_placement`, `finalize_placement` (BFS), `update_ancestor_counts_and_create_commissions` (idempotent), `get_tree_view`, `get_all_descendant_ids`, `validate_tree_integrity`
- `routes.py` — all `/api/*` endpoints (auth/public/orders/customer/admin)
- `seed.py` — creates super admin, admin, 16 customers in tree, orders in various states, commissions, one withdrawal

### Frontend (`/app/frontend/src/`)
- Router in `App.js` with ProtectedRoute
- `context/AuthContext.jsx` — token in localStorage; auto-attached to axios
- Layouts: `PublicNav`, `CustomerLayout`, `AdminLayout`
- Components: `TreeView` (iterative renderer, level-based), `CheckoutModal`, `ProtectedRoute`
- Public: `Home` (hero + specs + how-it-works + lifestyle + FAQ), `ScooterDetails`, `Register` (real-time referral validation + placement preview), `Login`
- Customer pages: `Dashboard`, `Tree`, `Referrals`, `Commissions`, `Wallet`, `Profile`
- Admin pages: `Dashboard` (KPIs + charts), `Users`, `Tree`, `Orders`, `Commissions`, `Withdrawals`, `Settings`, `AuditLogs`

### Testing
- 39/39 backend pytest tests passing
- End-to-end frontend flows validated via Playwright
- Success rate: 100% backend, 100% frontend (only cosmetic Recharts warning noted)

## Prioritized backlog / P1-P2 remaining

1. **P1** Interactive tree lazy-loading and zoom/pan (current renderer is static up to depth 4)
2. **P1** CSV export for referrals & audit logs (customer commissions + admin orders/commissions already have CSV)
3. **P2** Charts: user registrations over time, left/right branch growth timeline
4. **P2** Rate limiting on `/auth/login` and password reset flow
5. **P2** Real-time referral link QR code + share sheet
6. **P2** Admin user detail: manual placement correction with audit log
7. **P2** Split `routes.py` into per-domain modules
8. **P2** Unify wallet balance calculation (small inconsistency between wallet view and withdrawal-create balance check)

## Demo credentials

- **Super Admin**: `superadmin@dreampick.demo` / `Demo@123`
- **Admin**: `admin@dreampick.demo` / `Demo@123`
- **Customer** (root of tree): `customer1@dreampick.demo` / `Demo@123`
- **Downline customers**: `customer2..customer16@dreampick.demo` / `Demo@123`
- **Pending customers**: `pending1..pending2@dreampick.demo` / `Demo@123`
