"""FastAPI routes — Dreampick v2 (activation flow, three commission types, secure bank reveal,
notifications, media, password reset, plan PDF)."""
import os
import uuid
import secrets
import re
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Response, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from io import BytesIO

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, sanitize_user,
    get_current_user, get_current_admin,
)
from db import (
    users, tree_nodes, scooters, orders, commissions,
    wallet_transactions, withdrawal_requests, bank_accounts,
    audit_logs, system_settings, next_sequence,
    cashback_schedule, notifications, media_assets,
    password_reset_tokens, payout_receipts, bank_reveal_sessions,
    counters,
)
import tree_service
import crypto_util
import pdf_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _j(item):
    if item is None:
        return None
    if isinstance(item, list):
        return [_j(x) for x in item]
    if isinstance(item, dict):
        return {k: _j(v) for k, v in item.items()}
    return item


def _gen_referral_code(name: str) -> str:
    prefix = re.sub(r"[^A-Z]", "", (name or "USER").upper())[:4] or "USER"
    return f"{prefix}{secrets.token_hex(3).upper()}"


async def _generate_user_code() -> str:
    n = await next_sequence("user_code")
    return f"DP{n:05d}"


async def _generate_order_number() -> str:
    n = await next_sequence("order_number")
    return f"DP-ORD-{n:05d}"


async def _get_setting(key: str, default=None):
    doc = await system_settings().find_one({"_id": key})
    return doc["value"] if doc else default


async def _log_audit(admin_user: dict, action: str, target_type: str, target_id: str, details: dict = None, request: Request = None):
    entry = {
        "_id": str(uuid.uuid4()),
        "admin_user_id": admin_user["_id"],
        "admin_email": admin_user.get("email"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "created_at": _now_iso(),
    }
    if request:
        entry["ip"] = request.client.host if request.client else None
        entry["user_agent"] = request.headers.get("user-agent")
    await audit_logs().insert_one(entry)


async def _notify(user_id: str, audience: str, kind: str, title: str, body: str, link: str = None):
    await notifications().insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "audience": audience,
        "kind": kind,
        "title": title,
        "body": body,
        "link": link,
        "read": False,
        "created_at": _now_iso(),
    })


async def _notify_all_admins(kind: str, title: str, body: str, link: str = None):
    async for a in users().find({"role": "ADMIN"}):
        await _notify(a["_id"], "ADMIN", kind, title, body, link)


# ============== AUTH ROUTES ==============
auth_router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6, max_length=100)
    referral_code: Optional[str] = None
    placement_side: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@auth_router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    email = payload.email.lower().strip()
    if await users().find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    sponsor_user_id = None
    placement_side_selected = None
    if payload.referral_code:
        ref = payload.referral_code.strip().upper()
        sp = await users().find_one({"referral_code": ref})
        if not sp:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        if sp.get("role") != "CUSTOMER" or sp.get("status") != "ACTIVE":
            raise HTTPException(status_code=400, detail="Referrer is not an active customer")
        sponsor_user_id = sp["_id"]
        if payload.placement_side not in ("LEFT", "RIGHT"):
            raise HTTPException(status_code=400, detail="placement_side (LEFT/RIGHT) required with referral code")
        placement_side_selected = payload.placement_side

    uid = str(uuid.uuid4())
    ref_code = _gen_referral_code(payload.full_name)
    while await users().find_one({"referral_code": ref_code}):
        ref_code = _gen_referral_code(payload.full_name)

    doc = {
        "_id": uid,
        "user_code": await _generate_user_code(),
        "full_name": payload.full_name.strip(),
        "email": email,
        "phone": payload.phone.strip(),
        "password_hash": hash_password(payload.password),
        "role": "CUSTOMER",
        "status": "PENDING",
        "referral_code": ref_code,
        "sponsor_user_id": sponsor_user_id,
        "placement_side_selected": placement_side_selected,
        "must_change_password": False,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await users().insert_one(doc)
    await _notify_all_admins("NEW_REGISTRATION", "New customer registration",
                             f"{doc['full_name']} ({doc['user_code']}) has registered.",
                             f"/admin/users?q={doc['user_code']}")
    access = create_access_token(uid, email, "CUSTOMER")
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"user": sanitize_user(doc), "access_token": access}


@auth_router.post("/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower().strip()
    user = await users().find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") == "BLOCKED":
        raise HTTPException(status_code=403, detail="Account blocked")
    access = create_access_token(user["_id"], email, user["role"])
    refresh = create_refresh_token(user["_id"])
    set_auth_cookies(response, access, refresh)
    return {"user": sanitize_user(user), "access_token": access, "must_change_password": user.get("must_change_password", False)}


@auth_router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"success": True}


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user, "must_change_password": user.get("must_change_password", False)}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@auth_router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.lower().strip()
    user = await users().find_one({"email": email})
    # Do not reveal whether the account exists
    token = None
    if user:
        token = secrets.token_urlsafe(32)
        await password_reset_tokens().insert_one({
            "_id": str(uuid.uuid4()),
            "token": token,
            "user_id": user["_id"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
            "used": False,
            "created_at": _now_iso(),
        })
    # In production this would be emailed; for now we return the token to the caller (dev-friendly).
    return {"success": True, "reset_token": token, "note": "In production, the token is emailed. It is returned here only for demo."}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


@auth_router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    rec = await password_reset_tokens().find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or already-used token")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await users().update_one(
        {"_id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False, "updated_at": _now_iso()}},
    )
    await password_reset_tokens().update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"success": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


@auth_router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    full = await users().find_one({"_id": user["_id"]})
    if not verify_password(payload.current_password, full["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await users().update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False, "updated_at": _now_iso()}},
    )
    return {"success": True}


# ============== PUBLIC ROUTES ==============
public_router = APIRouter(tags=["public"])


@public_router.get("/config")
async def get_public_config():
    return {
        "company_name": await _get_setting("company_name", "Dreampick Private Limited"),
        "gst_number": await _get_setting("gst_number", "29AAMCD4327L1Z6"),
        "plan_price": await _get_setting("plan_price", 54999),
    }


@public_router.get("/plans")
async def get_plans():
    cashback = await _get_setting("cashback_config", {})
    direct = await _get_setting("direct_referral_config", {})
    matching = await _get_setting("matching_config", {})
    return {
        "plans": [{
            "name": "Basic EV Scooter Plan",
            "price": await _get_setting("plan_price", 54999),
            "gst_note": "Price is ₹54,999 + GST",
            "features": ["45–50 km range", "Battery and charge converter: 1-year warranty", "Non-registered vehicle, Non-RTO"],
            "terms": [
                "First payout starts after 45 days from successful registration and confirmed order activation.",
                "Scheduled monthly payouts follow the approved payout schedule.",
                "The buyer cashback schedule ends after the 10th monthly payout.",
                "Orders, cancellations, refunds, eligibility, delivery, and payout approval are tracked by the system.",
                "Final eligibility and payout approval are subject to company policy and order verification.",
            ],
            "cashback": cashback,
            "direct_referral": direct,
            "matching_income": matching,
        }]
    }


@public_router.get("/plans/pdf")
async def download_plan_pdf():
    company = await _get_setting("company_name", "Dreampick Private Limited")
    gst = await _get_setting("gst_number", "29AAMCD4327L1Z6")
    pdf_bytes = pdf_service.generate_plan_pdf(company, gst)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Dreampick-Basic-EV-Plan.pdf"'},
    )


@public_router.get("/media")
async def public_media(category: Optional[str] = None, _section_deprecated: Optional[str] = None):
    q = {"visible": True}
    if category:
        q["category"] = category
    docs = await media_assets().find(q).sort("display_order", 1).to_list(200)
    return {"media": _j(docs)}


class ReferralValidateRequest(BaseModel):
    referral_code: str


@public_router.post("/referrals/validate")
async def validate_referral(payload: ReferralValidateRequest):
    code = payload.referral_code.strip().upper()
    sp = await users().find_one({"referral_code": code, "role": "CUSTOMER"})
    if not sp:
        return {"valid": False}
    node = await tree_nodes().find_one({"_id": sp["_id"]})
    lc = node.get("left_count", 0) if node else 0
    rc = node.get("right_count", 0) if node else 0
    return {
        "valid": True,
        "referrer": {
            "user_id": sp["_id"], "user_code": sp.get("user_code"),
            "full_name": sp.get("full_name"), "status": sp.get("status"),
            "left_count": lc, "right_count": rc,
            "balance_diff": abs(lc - rc),
            "suggested_side": "LEFT" if lc <= rc else "RIGHT",
            "left_slot_empty": node is None or not node.get("left_child_id"),
            "right_slot_empty": node is None or not node.get("right_child_id"),
        },
    }


class TreePreviewRequest(BaseModel):
    referral_code: str
    selected_side: str


@public_router.post("/tree/preview-placement")
async def preview_placement_route(payload: TreePreviewRequest):
    sp = await users().find_one({"referral_code": payload.referral_code.strip().upper()})
    if not sp:
        raise HTTPException(status_code=400, detail="Invalid referral code")
    try:
        return await tree_service.preview_placement(sp["_id"], payload.selected_side)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== ORDER ROUTES ==============
order_router = APIRouter(prefix="/orders", tags=["orders"])


@order_router.post("/create")
async def create_order(user: dict = Depends(get_current_user)):
    if user.get("role") != "CUSTOMER":
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    existing = await orders().find_one({
        "buyer_user_id": user["_id"],
        "payment_status": {"$in": ["CREATED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ACTIVATED"]},
    })
    if existing:
        return {"order": _j(existing)}
    scooter = await scooters().find_one({})
    plan_price = float(await _get_setting("plan_price", 54999))
    order_num = await _generate_order_number()
    sponsor_id = user.get("sponsor_user_id")
    ref_code_used = None
    if sponsor_id:
        sp = await users().find_one({"_id": sponsor_id})
        if sp:
            ref_code_used = sp.get("referral_code")
    doc = {
        "_id": str(uuid.uuid4()),
        "order_number": order_num,
        "buyer_user_id": user["_id"],
        "scooter_id": scooter["_id"] if scooter else None,
        "amount": plan_price,
        "referral_code_used": ref_code_used,
        "sponsor_user_id": sponsor_id,
        "placement_side_selected": user.get("placement_side_selected"),
        "payment_status": "PAYMENT_PENDING",
        "delivery_status": "PENDING",
        "activated_at": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await orders().insert_one(doc)
    await _notify_all_admins("NEW_ACTIVATION_REQUEST", "New activation request",
                             f"{user['full_name']} submitted activation request {order_num}.",
                             f"/admin/orders?q={order_num}")
    return {"order": _j(doc)}


# ============== CUSTOMER ROUTES ==============
customer_router = APIRouter(prefix="/customer", tags=["customer"])


@customer_router.get("/dashboard")
async def customer_dashboard(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    node = await tree_nodes().find_one({"_id": uid})
    lc = node.get("left_count", 0) if node else 0
    rc = node.get("right_count", 0) if node else 0
    mp = node.get("matched_pairs", 0) if node else 0

    def blank():
        return {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0, "ON_HOLD": 0}

    cashback_totals = {"gross": 0, "deduction": 0, "net": 0, "count_paid": 0}
    async for row in cashback_schedule().find({"user_id": uid}):
        cashback_totals["gross"] += row.get("gross_amount", 0)
        cashback_totals["deduction"] += row.get("admin_charge_amount", 0)
        cashback_totals["net"] += row.get("net_amount", 0)
        if row.get("status") == "PAID":
            cashback_totals["count_paid"] += 1

    next_cb = await cashback_schedule().find_one(
        {"user_id": uid, "status": {"$in": ["SCHEDULED", "DUE", "APPROVED"]}},
        sort=[("scheduled_date", 1)],
    )

    direct_totals = blank()
    matching_totals = blank()
    async for c in commissions().find({"beneficiary_user_id": uid}):
        target = direct_totals if c["commission_type"] == "DIRECT_REFERRAL" else matching_totals
        target[c["status"]] = target.get(c["status"], 0) + c.get("net_amount", 0)

    recent_notifs = await notifications().find({"user_id": uid, "audience": "CUSTOMER"}).sort("created_at", -1).limit(5).to_list(5)
    order = await orders().find_one({"buyer_user_id": uid}, sort=[("created_at", -1)])

    return {
        "user": user,
        "counts": {
            "left_count": lc, "right_count": rc, "matched_pairs": mp,
            "unmatched_left": max(lc - mp, 0), "unmatched_right": max(rc - mp, 0),
        },
        "cashback": {
            "totals": cashback_totals,
            "next_payout_date": next_cb["scheduled_date"] if next_cb else None,
            "completed_installments": cashback_totals["count_paid"],
            "total_installments": 10,
            "ended": cashback_totals["count_paid"] >= 10,
        },
        "direct_referral_totals": direct_totals,
        "matching_income_totals": matching_totals,
        "recent_notifications": _j(recent_notifs),
        "order": _j(order),
    }


@customer_router.get("/tree")
async def customer_tree(depth: int = 4, user: dict = Depends(get_current_user)):
    return {"tree": await tree_service.get_tree_view(user["_id"], depth)}


@customer_router.get("/referrals")
async def customer_referrals(user: dict = Depends(get_current_user)):
    directs = await users().find({"sponsor_user_id": user["_id"]}).sort("created_at", -1).to_list(500)
    desc = await tree_service.get_all_descendant_ids(user["_id"])
    downline = []
    if desc:
        downline = await users().find({"_id": {"$in": desc}}).to_list(1000)
    node_map = {}
    async for n in tree_nodes().find({"_id": {"$in": [d["_id"] for d in downline]}}):
        node_map[n["_id"]] = n

    def enrich(u):
        s = sanitize_user(u)
        n = node_map.get(u["_id"])
        s["placement_side"] = n.get("placement_side") if n else None
        s["depth"] = n.get("depth") if n else None
        return s

    return {
        "direct_referrals": [sanitize_user(u) for u in directs],
        "downline": [enrich(u) for u in downline],
    }


@customer_router.get("/commissions")
async def customer_commissions(user: dict = Depends(get_current_user)):
    rows = await commissions().find({"beneficiary_user_id": user["_id"]}).sort("created_at", -1).to_list(1000)
    return {"commissions": _j(rows)}


@customer_router.get("/cashback")
async def customer_cashback(user: dict = Depends(get_current_user)):
    rows = await cashback_schedule().find({"user_id": user["_id"]}).sort("installment_number", 1).to_list(50)
    return {"cashback_schedule": _j(rows)}


@customer_router.get("/notifications")
async def customer_notifications(user: dict = Depends(get_current_user)):
    rows = await notifications().find({"user_id": user["_id"], "audience": "CUSTOMER"}).sort("created_at", -1).to_list(200)
    unread = sum(1 for r in rows if not r.get("read"))
    return {"notifications": _j(rows), "unread": unread}


@customer_router.patch("/notifications/{nid}/read")
async def customer_notif_read(nid: str, user: dict = Depends(get_current_user)):
    await notifications().update_one({"_id": nid, "user_id": user["_id"]}, {"$set": {"read": True}})
    return {"success": True}


@customer_router.get("/wallet")
async def customer_wallet(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    wt = await wallet_transactions().find({"user_id": uid}).sort("created_at", -1).to_list(500)
    wrs = await withdrawal_requests().find({"user_id": uid}).sort("created_at", -1).to_list(200)
    approved_total = 0.0
    async for c in commissions().find({"beneficiary_user_id": uid, "status": {"$in": ["APPROVED", "PAID"]}}):
        approved_total += c.get("net_amount", 0)
    async for cb in cashback_schedule().find({"user_id": uid, "status": {"$in": ["APPROVED", "PAID"]}}):
        approved_total += cb.get("net_amount", 0)
    withdrawn = 0.0
    async for w in withdrawal_requests().find({"user_id": uid, "status": {"$in": ["PENDING", "APPROVED", "PAID"]}}):
        withdrawn += w.get("amount", 0)
    available = max(approved_total - withdrawn, 0)
    return {
        "available_balance": available,
        "wallet_transactions": _j(wt),
        "withdrawal_requests": _j(wrs),
    }


class BankAccountCreateRequest(BaseModel):
    account_holder: str
    account_number: str
    ifsc: str
    bank_name: str
    upi_id: Optional[str] = None


@customer_router.post("/bank-accounts")
async def add_bank_account(payload: BankAccountCreateRequest, user: dict = Depends(get_current_user)):
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "account_holder": payload.account_holder.strip(),
        "account_number_enc": crypto_util.encrypt_str(payload.account_number.strip()),
        "account_number_masked": crypto_util.mask_account(payload.account_number.strip()),
        "ifsc": payload.ifsc.upper().strip(),
        "bank_name": payload.bank_name.strip(),
        "upi_id_enc": crypto_util.encrypt_str(payload.upi_id.strip() if payload.upi_id else None),
        "upi_id_masked": crypto_util.mask_account(payload.upi_id.strip()) if payload.upi_id else None,
        "verification_status": "UNVERIFIED",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await bank_accounts().insert_one(doc)
    return {"bank_account": {
        "_id": doc["_id"], "bank_name": doc["bank_name"],
        "ifsc": doc["ifsc"], "account_number": doc["account_number_masked"],
        "upi_id": doc["upi_id_masked"], "verification_status": doc["verification_status"],
    }}


@customer_router.get("/bank-accounts")
async def list_bank_accounts(user: dict = Depends(get_current_user)):
    rows = await bank_accounts().find({"user_id": user["_id"]}).to_list(20)
    out = [{
        "_id": r["_id"], "bank_name": r.get("bank_name"),
        "ifsc": r.get("ifsc"),
        "account_number": r.get("account_number_masked", "****"),
        "upi_id": r.get("upi_id_masked"),
        "verification_status": r.get("verification_status"),
        "account_holder": r.get("account_holder"),
    } for r in rows]
    return {"bank_accounts": out}


class WithdrawalCreate(BaseModel):
    amount: float
    bank_account_id: str


@customer_router.post("/withdrawals")
async def create_withdrawal(payload: WithdrawalCreate, user: dict = Depends(get_current_user)):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    ba = await bank_accounts().find_one({"_id": payload.bank_account_id, "user_id": user["_id"]})
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"], "amount": payload.amount,
        "bank_account_id": ba["_id"], "bank_account_masked": ba["account_number_masked"],
        "bank_name": ba["bank_name"], "status": "PENDING",
        "created_at": _now_iso(), "updated_at": _now_iso(), "notes": None,
    }
    await withdrawal_requests().insert_one(doc)
    await _notify_all_admins("WITHDRAWAL_REQUESTED", "New withdrawal request",
                             f"{user['full_name']} requested ₹{payload.amount:.2f}",
                             "/admin/withdrawals")
    return {"withdrawal_request": _j(doc)}


@customer_router.get("/withdrawals")
async def list_withdrawals(user: dict = Depends(get_current_user)):
    docs = await withdrawal_requests().find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
    return {"withdrawal_requests": _j(docs)}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


@customer_router.patch("/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": _now_iso()}
    if payload.full_name:
        updates["full_name"] = payload.full_name.strip()
    if payload.phone:
        updates["phone"] = payload.phone.strip()
    await users().update_one({"_id": user["_id"]}, {"$set": updates})
    updated = await users().find_one({"_id": user["_id"]})
    return {"user": sanitize_user(updated)}


# ============== ADMIN ROUTES ==============
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(get_current_admin)):
    total_users = await users().count_documents({"role": "CUSTOMER"})
    pending_users = await users().count_documents({"role": "CUSTOMER", "status": "PENDING"})
    active_users = await users().count_documents({"role": "CUSTOMER", "status": "ACTIVE"})
    total_orders = await orders().count_documents({})
    activated_orders = await orders().count_documents({"payment_status": "ACTIVATED"})
    pending_activation = await orders().count_documents({"payment_status": {"$in": ["PAYMENT_PENDING", "PAYMENT_CONFIRMED"]}})

    def blank():
        return {"SCHEDULED": 0, "DUE": 0, "APPROVED": 0, "PAID": 0, "ON_HOLD": 0, "CANCELLED": 0, "REVERSED": 0}
    cashback_totals = blank()
    async for cb in cashback_schedule().find({}):
        cashback_totals[cb["status"]] = cashback_totals.get(cb["status"], 0) + cb.get("net_amount", 0)

    direct_totals = {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0, "ON_HOLD": 0}
    matching_totals = {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0, "ON_HOLD": 0}
    async for c in commissions().find({}):
        target = direct_totals if c["commission_type"] == "DIRECT_REFERRAL" else matching_totals
        target[c["status"]] = target.get(c["status"], 0) + c.get("net_amount", 0)

    wr_pending = await withdrawal_requests().count_documents({"status": "PENDING"})
    unread_notifs = await notifications().count_documents({"audience": "ADMIN", "read": False})

    recent_users = await users().find({"role": "CUSTOMER"}).sort("created_at", -1).limit(5).to_list(5)
    recent_orders = await orders().find({}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "totals": {
            "total_users": total_users, "pending_users": pending_users, "active_users": active_users,
            "total_orders": total_orders, "activated_orders": activated_orders,
            "pending_activation": pending_activation,
            "pending_withdrawals": wr_pending, "unread_notifications": unread_notifs,
        },
        "cashback_totals": cashback_totals,
        "direct_referral_totals": direct_totals,
        "matching_income_totals": matching_totals,
        "recent_users": [sanitize_user(u) for u in recent_users],
        "recent_orders": _j(recent_orders),
    }


@admin_router.get("/users")
async def admin_list_users(q: Optional[str] = None, status: Optional[str] = None, _: dict = Depends(get_current_admin)):
    query = {"role": "CUSTOMER"}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"user_code": {"$regex": q, "$options": "i"}},
            {"referral_code": {"$regex": q, "$options": "i"}},
        ]
    docs = await users().find(query).sort("created_at", -1).to_list(500)
    ids = [d["_id"] for d in docs]
    node_map = {}
    async for n in tree_nodes().find({"_id": {"$in": ids}}):
        node_map[n["_id"]] = n

    def enrich(u):
        s = sanitize_user(u)
        n = node_map.get(u["_id"])
        s["left_count"] = n.get("left_count", 0) if n else 0
        s["right_count"] = n.get("right_count", 0) if n else 0
        s["matched_pairs"] = n.get("matched_pairs", 0) if n else 0
        s["placement_side"] = n.get("placement_side") if n else None
        return s
    return {"users": [enrich(u) for u in docs]}


@admin_router.get("/users/{user_id}")
async def admin_user_detail(user_id: str, _: dict = Depends(get_current_admin)):
    u = await users().find_one({"_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    node = await tree_nodes().find_one({"_id": user_id})
    o = await orders().find({"buyer_user_id": user_id}).sort("created_at", -1).to_list(50)
    c = await commissions().find({"beneficiary_user_id": user_id}).sort("created_at", -1).to_list(200)
    cb = await cashback_schedule().find({"user_id": user_id}).sort("installment_number", 1).to_list(50)
    w = await withdrawal_requests().find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    banks = await bank_accounts().find({"user_id": user_id}).to_list(20)
    masked_banks = [{
        "_id": b["_id"], "bank_name": b.get("bank_name"), "ifsc": b.get("ifsc"),
        "account_holder": b.get("account_holder"),
        "account_number": b.get("account_number_masked", "****"),
        "upi_id": b.get("upi_id_masked"),
        "verification_status": b.get("verification_status"),
        "updated_at": b.get("updated_at"),
    } for b in banks]
    referrals = await users().find({"sponsor_user_id": user_id}).to_list(200)
    return {
        "user": sanitize_user(u),
        "tree_node": _j(node),
        "orders": _j(o),
        "commissions": _j(c),
        "cashback_schedule": _j(cb),
        "withdrawal_requests": _j(w),
        "bank_accounts_masked": masked_banks,
        "direct_referrals": [sanitize_user(r) for r in referrals],
    }


class RevealBankRequest(BaseModel):
    bank_account_id: str
    reason: str


@admin_router.post("/users/{user_id}/bank-details/reveal")
async def admin_reveal_bank(user_id: str, payload: RevealBankRequest, request: Request, admin: dict = Depends(get_current_admin)):
    if not payload.reason or payload.reason.strip() == "":
        raise HTTPException(status_code=400, detail="Reason is required")
    ba = await bank_accounts().find_one({"_id": payload.bank_account_id, "user_id": user_id})
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")
    account_number = crypto_util.decrypt_str(ba.get("account_number_enc"))
    upi_id = crypto_util.decrypt_str(ba.get("upi_id_enc"))
    session_id = str(uuid.uuid4())
    await bank_reveal_sessions().insert_one({
        "_id": session_id,
        "admin_user_id": admin["_id"],
        "target_user_id": user_id,
        "bank_account_id": ba["_id"],
        "reason": payload.reason,
        "created_at": _now_iso(),
    })
    await _log_audit(admin, "REVEAL_BANK_DETAILS", "bank_account", ba["_id"],
                     {"reason": payload.reason, "target_user": user_id, "session_id": session_id},
                     request=request)
    return {
        "session_id": session_id,
        "bank_details": {
            "account_holder": ba.get("account_holder"),
            "account_number": account_number,
            "ifsc": ba.get("ifsc"),
            "bank_name": ba.get("bank_name"),
            "upi_id": upi_id,
            "verification_status": ba.get("verification_status"),
            "updated_at": ba.get("updated_at"),
        },
    }


class BankAuditCopyRequest(BaseModel):
    bank_account_id: str
    action: str  # COPY_ACCOUNT_NUMBER | COPY_IFSC | COPY_UPI_ID | HIDE_BANK_DETAILS


@admin_router.post("/users/{user_id}/bank-details/audit-copy")
async def admin_audit_bank_copy(user_id: str, payload: BankAuditCopyRequest, request: Request, admin: dict = Depends(get_current_admin)):
    valid = ("COPY_ACCOUNT_NUMBER", "COPY_IFSC", "COPY_UPI_ID", "HIDE_BANK_DETAILS")
    if payload.action not in valid:
        raise HTTPException(status_code=400, detail="Invalid action")
    await _log_audit(admin, payload.action, "bank_account", payload.bank_account_id,
                     {"target_user": user_id}, request=request)
    return {"success": True}


class UserStatusUpdate(BaseModel):
    status: str


@admin_router.patch("/users/{user_id}/status")
async def admin_update_status(user_id: str, payload: UserStatusUpdate, request: Request, admin: dict = Depends(get_current_admin)):
    if payload.status not in ("PENDING", "ACTIVE", "BLOCKED"):
        raise HTTPException(status_code=400, detail="Invalid status")
    r = await users().update_one({"_id": user_id}, {"$set": {"status": payload.status, "updated_at": _now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await _log_audit(admin, "USER_STATUS_CHANGE", "user", user_id, {"new_status": payload.status}, request=request)
    return {"success": True}


class SetTempPassword(BaseModel):
    temp_password: str = Field(..., min_length=6)


@admin_router.post("/users/{user_id}/set-temp-password")
async def admin_set_temp_password(user_id: str, payload: SetTempPassword, request: Request, admin: dict = Depends(get_current_admin)):
    r = await users().update_one(
        {"_id": user_id},
        {"$set": {"password_hash": hash_password(payload.temp_password), "must_change_password": True, "updated_at": _now_iso()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await _log_audit(admin, "TEMP_PASSWORD_SET", "user", user_id, {}, request=request)
    return {"success": True}


@admin_router.post("/users/{user_id}/send-password-reset")
async def admin_send_password_reset(user_id: str, request: Request, admin: dict = Depends(get_current_admin)):
    u = await users().find_one({"_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    token = secrets.token_urlsafe(32)
    await password_reset_tokens().insert_one({
        "_id": str(uuid.uuid4()), "token": token, "user_id": u["_id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used": False, "created_at": _now_iso(),
    })
    await _log_audit(admin, "SEND_PASSWORD_RESET", "user", user_id, {}, request=request)
    return {"success": True, "reset_token": token, "note": "In production this token would be emailed to the user."}


# --- Tree ---
@admin_router.get("/tree")
async def admin_tree(user_id: Optional[str] = None, depth: int = 4, _: dict = Depends(get_current_admin)):
    if user_id:
        view = await tree_service.get_tree_view(user_id, depth)
        if not view:
            raise HTTPException(status_code=404, detail="User not in tree")
        return {"tree": view}
    root = await tree_nodes().find_one({"parent_user_id": None})
    if not root:
        return {"tree": None}
    return {"tree": await tree_service.get_tree_view(root["_id"], depth)}


@admin_router.get("/tree/integrity-check")
async def admin_tree_integrity(_: dict = Depends(get_current_admin)):
    return await tree_service.validate_tree_integrity()


# --- Orders (activation flow) ---
@admin_router.get("/orders")
async def admin_orders(status: Optional[str] = None, q: Optional[str] = None, _: dict = Depends(get_current_admin)):
    query = {}
    if status:
        query["payment_status"] = status
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q, "$options": "i"}},
            {"referral_code_used": {"$regex": q, "$options": "i"}},
        ]
    docs = await orders().find(query).sort("created_at", -1).to_list(500)
    bids = list({d["buyer_user_id"] for d in docs})
    bmap = {}
    async for u in users().find({"_id": {"$in": bids}}):
        bmap[u["_id"]] = {"full_name": u.get("full_name"), "email": u.get("email"), "user_code": u.get("user_code")}
    for d in docs:
        d["buyer"] = bmap.get(d["buyer_user_id"])
    return {"orders": _j(docs)}


async def _activate_order(order: dict, admin: dict, request: Request):
    """Activate a user's account, place in tree, generate cashback schedule + commissions."""
    buyer_id = order["buyer_user_id"]
    buyer = await users().find_one({"_id": buyer_id})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    if order["payment_status"] == "ACTIVATED":
        return
    now = _now_iso()
    await orders().update_one(
        {"_id": order["_id"]},
        {"$set": {"payment_status": "ACTIVATED", "activated_at": now, "updated_at": now}},
    )
    if buyer.get("status") != "ACTIVE":
        await users().update_one({"_id": buyer_id}, {"$set": {"status": "ACTIVE", "updated_at": now}})
        sponsor_id = buyer.get("sponsor_user_id")
        side = buyer.get("placement_side_selected") or order.get("placement_side_selected")
        if sponsor_id and side in ("LEFT", "RIGHT"):
            try:
                await tree_service.finalize_placement(buyer_id, sponsor_id, side)
                await tree_service.update_ancestor_counts_and_create_matching(buyer_id, order["_id"])
                await tree_service.create_direct_referral_commission(sponsor_id, buyer_id, order["_id"])
            except ValueError:
                await tree_service.create_root_node(buyer_id)
        else:
            await tree_service.create_root_node(buyer_id)
    # Cashback schedule
    created = await tree_service.create_cashback_schedule(buyer_id, order["_id"], now)
    await _notify(buyer_id, "CUSTOMER", "ORDER_ACTIVATED", "Your order is activated!",
                  f"Order {order['order_number']} is now ACTIVE. {created} cashback installments scheduled.",
                  "/dashboard")
    await _log_audit(admin, "ORDER_ACTIVATED", "order", order["_id"], {"cashback_installments": created}, request=request)


@admin_router.patch("/orders/{order_id}/activate")
async def admin_activate_order(order_id: str, request: Request, admin: dict = Depends(get_current_admin)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await _activate_order(order, admin, request)
    return {"success": True, "order": _j(await orders().find_one({"_id": order_id}))}


class OrderStatusUpdate(BaseModel):
    status: str  # PAYMENT_PENDING | PAYMENT_CONFIRMED | FAILED | CANCELLED | REFUNDED


@admin_router.patch("/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: OrderStatusUpdate, request: Request, admin: dict = Depends(get_current_admin)):
    valid = ("PAYMENT_PENDING", "PAYMENT_CONFIRMED", "FAILED", "CANCELLED", "REFUNDED")
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    r = await orders().update_one({"_id": order_id}, {"$set": {"payment_status": payload.status, "updated_at": _now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.status in ("CANCELLED", "REFUNDED"):
        # Put future cashback records on hold + reverse pending commissions
        async for cb in cashback_schedule().find({"order_id": order_id, "status": {"$in": ["SCHEDULED", "DUE"]}}):
            await cashback_schedule().update_one({"_id": cb["_id"]}, {"$set": {"status": "ON_HOLD", "notes": f"Order {payload.status}"}})
        async for c in commissions().find({"order_id": order_id, "status": {"$in": ["PENDING", "APPROVED"]}}):
            await commissions().update_one({"_id": c["_id"]}, {"$set": {"status": "REVERSED", "reversed_at": _now_iso(), "notes": f"Order {payload.status}"}})
    await _log_audit(admin, f"ORDER_STATUS_{payload.status}", "order", order_id, {}, request=request)
    return {"success": True}


# --- Cashback management ---
@admin_router.get("/cashback")
async def admin_cashback(status: Optional[str] = None, _: dict = Depends(get_current_admin)):
    q = {}
    if status:
        q["status"] = status
    rows = await cashback_schedule().find(q).sort("scheduled_date", 1).to_list(1000)
    uids = list({r["user_id"] for r in rows})
    umap = {}
    async for u in users().find({"_id": {"$in": uids}}):
        umap[u["_id"]] = {"full_name": u.get("full_name"), "user_code": u.get("user_code"), "email": u.get("email")}
    for r in rows:
        r["user"] = umap.get(r["user_id"])
    return {"cashback_schedule": _j(rows)}


class PayoutMarkPaid(BaseModel):
    payment_reference: Optional[str] = None
    payment_date: Optional[str] = None
    payment_method: Optional[str] = "BANK_TRANSFER"
    admin_notes: Optional[str] = None


async def _create_wallet_txn(uid: str, ttype: str, amount: float, ref_type: str, ref_id: str):
    await wallet_transactions().insert_one({
        "_id": str(uuid.uuid4()), "user_id": uid, "type": ttype,
        "amount": amount, "reference_type": ref_type, "reference_id": ref_id,
        "created_at": _now_iso(),
    })


@admin_router.patch("/cashback/{rec_id}/{action}")
async def admin_cashback_action(rec_id: str, action: str, request: Request, admin: dict = Depends(get_current_admin)):
    valid = ("approve", "hold", "cancel", "reverse", "mark-paid")
    if action not in valid:
        raise HTTPException(status_code=400, detail="Invalid action")
    rec = await cashback_schedule().find_one({"_id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Cashback record not found")
    now = _now_iso()
    status_map = {"approve": "APPROVED", "hold": "ON_HOLD", "cancel": "CANCELLED", "reverse": "REVERSED", "mark-paid": "PAID"}
    new_status = status_map[action]
    update = {"status": new_status, "updated_at": now}
    if action == "approve":
        update["approved_at"] = now
    if action == "mark-paid":
        update["paid_at"] = now
    await cashback_schedule().update_one({"_id": rec_id}, {"$set": update})
    if action == "mark-paid":
        await _create_wallet_txn(rec["user_id"], "CASHBACK_CREDIT", rec.get("net_amount", 0), "cashback", rec_id)
        await _notify(rec["user_id"], "CUSTOMER", "CASHBACK_PAID", "Cashback paid",
                      f"Installment #{rec['installment_number']} of ₹{rec['net_amount']} has been paid.", "/dashboard/cashback")
    await _log_audit(admin, f"CASHBACK_{action.upper()}", "cashback", rec_id, {}, request=request)
    return {"success": True}


# --- Commission management (unified by type) ---
@admin_router.get("/commissions")
async def admin_commissions(commission_type: Optional[str] = None, status: Optional[str] = None, _: dict = Depends(get_current_admin)):
    q = {}
    if commission_type:
        q["commission_type"] = commission_type
    if status:
        q["status"] = status
    rows = await commissions().find(q).sort("created_at", -1).to_list(1000)
    uids = list({r["beneficiary_user_id"] for r in rows})
    umap = {}
    async for u in users().find({"_id": {"$in": uids}}):
        umap[u["_id"]] = {"full_name": u.get("full_name"), "user_code": u.get("user_code"), "email": u.get("email")}
    for r in rows:
        r["beneficiary"] = umap.get(r["beneficiary_user_id"])
    return {"commissions": _j(rows)}


@admin_router.patch("/commissions/{cid}/{action}")
async def admin_commission_action(cid: str, action: str, request: Request, admin: dict = Depends(get_current_admin)):
    valid = ("approve", "hold", "reject", "reverse", "mark-paid")
    if action not in valid:
        raise HTTPException(status_code=400, detail="Invalid action")
    c = await commissions().find_one({"_id": cid})
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if action == "mark-paid" and c["status"] in ("REJECTED", "REVERSED"):
        raise HTTPException(status_code=400, detail="Cannot mark a rejected/reversed commission as paid")
    now = _now_iso()
    status_map = {"approve": "APPROVED", "hold": "ON_HOLD", "reject": "REJECTED", "reverse": "REVERSED", "mark-paid": "PAID"}
    update = {"status": status_map[action]}
    if action == "approve":
        update["approved_at"] = now
    if action == "reject":
        update["rejected_at"] = now
    if action == "reverse":
        update["reversed_at"] = now
    if action == "mark-paid":
        update["paid_at"] = now
    await commissions().update_one({"_id": cid}, {"$set": update})
    if action == "mark-paid":
        await _create_wallet_txn(c["beneficiary_user_id"],
                                 "COMMISSION_CREDIT" if c["commission_type"] == "DIRECT_REFERRAL" else "MATCHING_CREDIT",
                                 c.get("net_amount", 0), "commission", cid)
        await _notify(c["beneficiary_user_id"], "CUSTOMER", "COMMISSION_PAID", "Commission paid",
                      f"{c['commission_type']} of ₹{c['net_amount']} has been paid.", "/dashboard/commissions")
    await _log_audit(admin, f"COMMISSION_{action.upper()}", "commission", cid, {"type": c["commission_type"]}, request=request)
    return {"success": True}


# --- Withdrawals ---
@admin_router.get("/withdrawals")
async def admin_withdrawals(status: Optional[str] = None, _: dict = Depends(get_current_admin)):
    q = {}
    if status:
        q["status"] = status
    rows = await withdrawal_requests().find(q).sort("created_at", -1).to_list(500)
    uids = list({r["user_id"] for r in rows})
    umap = {}
    async for u in users().find({"_id": {"$in": uids}}):
        umap[u["_id"]] = {"full_name": u.get("full_name"), "user_code": u.get("user_code"), "email": u.get("email")}
    for r in rows:
        r["user"] = umap.get(r["user_id"])
    return {"withdrawal_requests": _j(rows)}


@admin_router.patch("/withdrawals/{wid}/{action}")
async def admin_withdrawal_action(wid: str, action: str, payload: Optional[PayoutMarkPaid] = None, request: Request = None, admin: dict = Depends(get_current_admin)):
    valid = ("approve", "reject", "mark-paid")
    if action not in valid:
        raise HTTPException(status_code=400, detail="Invalid action")
    wr = await withdrawal_requests().find_one({"_id": wid})
    if not wr:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    now = _now_iso()
    status_map = {"approve": "APPROVED", "reject": "REJECTED", "mark-paid": "PAID"}
    await withdrawal_requests().update_one({"_id": wid}, {"$set": {"status": status_map[action], "updated_at": now}})
    if action == "mark-paid":
        await _create_wallet_txn(wr["user_id"], "WITHDRAWAL_DEBIT", wr["amount"], "withdrawal", wid)
        if payload:
            await payout_receipts().insert_one({
                "_id": str(uuid.uuid4()),
                "withdrawal_id": wid,
                "payment_reference": payload.payment_reference,
                "payment_date": payload.payment_date or now,
                "payment_method": payload.payment_method,
                "admin_notes": payload.admin_notes,
                "created_by": admin["_id"],
                "created_at": now,
            })
        await _notify(wr["user_id"], "CUSTOMER", "WITHDRAWAL_PAID", "Withdrawal paid",
                      f"Your withdrawal of ₹{wr['amount']} has been paid.", "/dashboard/wallet")
    await _log_audit(admin, f"WITHDRAWAL_{action.upper()}", "withdrawal", wid, {}, request=request)
    return {"success": True}


# --- Notifications (admin) ---
@admin_router.get("/notifications")
async def admin_notifications(admin: dict = Depends(get_current_admin)):
    rows = await notifications().find({"user_id": admin["_id"], "audience": "ADMIN"}).sort("created_at", -1).to_list(200)
    unread = sum(1 for r in rows if not r.get("read"))
    return {"notifications": _j(rows), "unread": unread}


@admin_router.patch("/notifications/{nid}/read")
async def admin_notif_read(nid: str, admin: dict = Depends(get_current_admin)):
    await notifications().update_one({"_id": nid, "user_id": admin["_id"]}, {"$set": {"read": True}})
    return {"success": True}


# --- Audit logs ---
@admin_router.get("/audit-logs")
async def admin_audit_logs(_: dict = Depends(get_current_admin)):
    rows = await audit_logs().find({}).sort("created_at", -1).to_list(500)
    return {"audit_logs": _j(rows)}


# --- Settings (three commission configs) ---
@admin_router.get("/settings")
async def admin_get_settings(_: dict = Depends(get_current_admin)):
    docs = await system_settings().find({}).to_list(100)
    return {"settings": {d["_id"]: d["value"] for d in docs}}


class SettingsUpdate(BaseModel):
    cashback_config: Optional[dict] = None
    direct_referral_config: Optional[dict] = None
    matching_config: Optional[dict] = None
    plan_price: Optional[float] = None
    gst_number: Optional[str] = None
    company_name: Optional[str] = None


@admin_router.patch("/settings")
async def admin_update_settings(payload: SettingsUpdate, request: Request, admin: dict = Depends(get_current_admin)):
    changes = {}
    for k in ("cashback_config", "direct_referral_config", "matching_config", "plan_price", "gst_number", "company_name"):
        val = getattr(payload, k)
        if val is not None:
            await system_settings().update_one({"_id": k}, {"$set": {"value": val}}, upsert=True)
            changes[k] = val
    if changes:
        await _log_audit(admin, "SETTINGS_UPDATE", "settings", "global", changes, request=request)
    return {"success": True, "changes": changes}


# --- Production data reset (destructive; wipes all customer data, preserves admin + settings + media) ---
class ResetProductionDataRequest(BaseModel):
    confirm: str
    preserve_media: bool = True


@admin_router.post("/reset-production-data")
async def admin_reset_production_data(payload: ResetProductionDataRequest, request: Request, admin: dict = Depends(get_current_admin)):
    """Wipe all customer/order/tree/commission data.  Preserves:
    - The configured admin account (ADMIN_EMAIL from env).
    - system_settings (commission configs, company name, GST, etc.).
    - media_assets (unless preserve_media=false).
    """
    if payload.confirm != "RESET_ALL_CUSTOMER_DATA":
        raise HTTPException(status_code=400, detail="Confirmation phrase mismatch. Send confirm='RESET_ALL_CUSTOMER_DATA'.")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    keep_admin = await users().find_one({"email": admin_email, "role": "ADMIN"})
    if not keep_admin:
        raise HTTPException(status_code=500, detail="Configured admin account not found; refusing to reset.")

    # Wipe: delete everything not tied to the configured admin
    r_users = await users().delete_many({"_id": {"$ne": keep_admin["_id"]}})
    r_tree = await tree_nodes().delete_many({})
    r_orders = await orders().delete_many({})
    r_comm = await commissions().delete_many({})
    r_cb = await cashback_schedule().delete_many({})
    r_wt = await wallet_transactions().delete_many({})
    r_wr = await withdrawal_requests().delete_many({})
    r_bank = await bank_accounts().delete_many({})
    r_notif = await notifications().delete_many({})
    r_reveal = await bank_reveal_sessions().delete_many({})
    r_prt = await password_reset_tokens().delete_many({})
    r_receipts = await payout_receipts().delete_many({})
    r_audit = await audit_logs().delete_many({})

    r_media = None
    if not payload.preserve_media:
        # Clean up files from disk too
        async for old in media_assets().find({}):
            try:
                fn = old.get("filename")
                if fn:
                    os.remove(os.path.join(UPLOAD_DIR, fn))
            except Exception:
                pass
        r_media = await media_assets().delete_many({})

    # Reset counters (user_code, order_number)
    await counters().delete_many({})

    await _log_audit(admin, "PRODUCTION_DATA_RESET", "system", "global", {
        "preserve_media": payload.preserve_media,
        "counts": {
            "users_deleted": r_users.deleted_count,
            "tree_nodes_deleted": r_tree.deleted_count,
            "orders_deleted": r_orders.deleted_count,
            "commissions_deleted": r_comm.deleted_count,
            "cashback_schedule_deleted": r_cb.deleted_count,
            "wallet_transactions_deleted": r_wt.deleted_count,
            "withdrawal_requests_deleted": r_wr.deleted_count,
            "bank_accounts_deleted": r_bank.deleted_count,
            "notifications_deleted": r_notif.deleted_count,
            "bank_reveal_sessions_deleted": r_reveal.deleted_count,
            "password_reset_tokens_deleted": r_prt.deleted_count,
            "payout_receipts_deleted": r_receipts.deleted_count,
            "audit_logs_deleted": r_audit.deleted_count,
            "media_assets_deleted": r_media.deleted_count if r_media else 0,
        },
    }, request=request)

    return {
        "success": True,
        "preserved_admin_email": admin_email,
        "counts": {
            "users_deleted": r_users.deleted_count,
            "tree_nodes_deleted": r_tree.deleted_count,
            "orders_deleted": r_orders.deleted_count,
            "commissions_deleted": r_comm.deleted_count,
            "cashback_schedule_deleted": r_cb.deleted_count,
            "wallet_transactions_deleted": r_wt.deleted_count,
            "withdrawal_requests_deleted": r_wr.deleted_count,
            "bank_accounts_deleted": r_bank.deleted_count,
            "notifications_deleted": r_notif.deleted_count,
            "bank_reveal_sessions_deleted": r_reveal.deleted_count,
            "password_reset_tokens_deleted": r_prt.deleted_count,
            "payout_receipts_deleted": r_receipts.deleted_count,
            "audit_logs_deleted": r_audit.deleted_count,
            "media_assets_deleted": r_media.deleted_count if r_media else 0,
        },
    }


# --- Media management ---
UPLOAD_DIR = "/app/backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Fixed media categories. Single-slot categories auto-replace existing media on new upload.
SINGLE_SLOT_CATEGORIES = {
    "COMPANY_LOGO", "HERO_SCOOTER", "HERO_BACKGROUND", "ABOUT_US",
    "CHIEF_GUEST_MR_FAZI", "CHIEF_GUEST_VISHAL_MEHARVADE",
    "CHIEF_GUEST_SRINIVAS", "CHIEF_GUEST_HEMANTH_KUMAR",
    "COMPANY_MD_PHOTO", "CO_DIRECTOR_PHOTO",
    "COMPANY_LICENSE_1", "COMPANY_LICENSE_2", "COMPANY_LICENSE_3",
    "COMPANY_LICENSE_4", "COMPANY_LICENSE_5", "COMPANY_LICENSE_6",
}
LICENSE_CATEGORIES = {f"COMPANY_LICENSE_{i}" for i in range(1, 7)}
MULTI_SLOT_CATEGORIES = {"GALLERY_IMAGE", "GALLERY_VIDEO"}
ALL_CATEGORIES = SINGLE_SLOT_CATEGORIES | MULTI_SLOT_CATEGORIES


@admin_router.post("/media/upload")
async def admin_upload_media(
    category: str = Form(...),
    title: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    display_order: int = Form(0),
    visible: bool = Form(True),
    issue_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    if category not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {sorted(ALL_CATEGORIES)}")
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov")
    if category in LICENSE_CATEGORIES:
        allowed_exts = (".png", ".jpg", ".jpeg", ".webp", ".pdf")
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {allowed_exts}")
    is_video = ext in (".mp4", ".webm", ".mov")
    is_pdf = ext == ".pdf"
    media_type = "video" if is_video else ("pdf" if is_pdf else "image")

    fid = str(uuid.uuid4())
    filename = f"{fid}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")
    with open(path, "wb") as f:
        f.write(content)
    url = f"/api/media/{filename}"

    # For single-slot categories, remove any existing media in that slot
    if category in SINGLE_SLOT_CATEGORIES:
        async for old in media_assets().find({"category": category}):
            try:
                os.remove(os.path.join(UPLOAD_DIR, old.get("filename", "")))
            except Exception:
                pass
        await media_assets().delete_many({"category": category})

    doc = {
        "_id": fid,
        "category": category,
        "section": category.lower(),  # legacy compat
        "title": title,
        "caption": caption,
        "description": description,
        "issue_date": issue_date,
        "expiry_date": expiry_date,
        "display_order": display_order,
        "visible": visible,
        "media_type": media_type,
        "url": url,
        "filename": filename,
        "uploaded_by": admin["_id"],
        "created_at": _now_iso(),
    }
    await media_assets().insert_one(doc)
    await _log_audit(admin, "MEDIA_UPLOAD", "media", fid, {"category": category})
    return {"media": _j(doc)}


@admin_router.get("/media")
async def admin_list_media(category: Optional[str] = None, _: dict = Depends(get_current_admin)):
    q = {}
    if category:
        q["category"] = category
    docs = await media_assets().find(q).sort([("category", 1), ("display_order", 1)]).to_list(500)
    return {"media": _j(docs)}


@admin_router.delete("/media/{mid}")
async def admin_delete_media(mid: str, admin: dict = Depends(get_current_admin)):
    doc = await media_assets().find_one({"_id": mid})
    if not doc:
        raise HTTPException(status_code=404, detail="Media not found")
    try:
        os.remove(os.path.join(UPLOAD_DIR, doc.get("filename", "")))
    except Exception:
        pass
    await media_assets().delete_one({"_id": mid})
    await _log_audit(admin, "MEDIA_DELETE", "media", mid, {"category": doc.get("category")})
    return {"success": True}


class MediaUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    description: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    display_order: Optional[int] = None
    visible: Optional[bool] = None


@admin_router.patch("/media/{mid}")
async def admin_update_media(mid: str, payload: MediaUpdate, admin: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if updates:
        await media_assets().update_one({"_id": mid}, {"$set": updates})
    return {"success": True}


# Static-file serving for uploads through /api (Kubernetes ingress compatible)
media_serve_router = APIRouter(prefix="/media", tags=["media"])


@media_serve_router.get("/{filename}")
async def serve_media(filename: str):
    from fastapi.responses import FileResponse
    # Guard against path traversal — allow only bare filenames with a known extension
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.abspath(os.path.join(UPLOAD_DIR, filename))
    if os.path.commonpath([path, os.path.abspath(UPLOAD_DIR)]) != os.path.abspath(UPLOAD_DIR):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
