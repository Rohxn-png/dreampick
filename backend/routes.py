"""FastAPI routes for authentication, public, customer, admin, and orders."""
import os
import uuid
import secrets
import re
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Response, Request, Depends, Query
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, sanitize_user,
    get_current_user, get_current_admin, get_current_super_admin,
)
from db import (
    users, tree_nodes, scooters, orders, commissions,
    wallet_transactions, withdrawal_requests, bank_accounts,
    audit_logs, system_settings, next_sequence,
)
import tree_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


async def _log_audit(admin_user: dict, action: str, target_type: str, target_id: str, details: dict = None):
    await audit_logs().insert_one({
        "_id": str(uuid.uuid4()),
        "admin_user_id": admin_user["_id"],
        "admin_email": admin_user.get("email"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "created_at": _now_iso(),
    })


# ============== AUTH ROUTES ==============
auth_router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6, max_length=100)
    referral_code: Optional[str] = None
    placement_side: Optional[str] = None  # LEFT or RIGHT


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@auth_router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    email = payload.email.lower().strip()
    existing = await users().find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    sponsor_user_id = None
    placement_side_selected = None
    if payload.referral_code:
        ref_code = payload.referral_code.strip().upper()
        sponsor = await users().find_one({"referral_code": ref_code})
        if not sponsor:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        if sponsor.get("status") != "ACTIVE":
            raise HTTPException(status_code=400, detail="Referrer is not active")
        sponsor_user_id = sponsor["_id"]
        if payload.placement_side not in ("LEFT", "RIGHT"):
            raise HTTPException(status_code=400, detail="placement_side (LEFT/RIGHT) required with referral code")
        placement_side_selected = payload.placement_side

    user_id = str(uuid.uuid4())
    user_code = await _generate_user_code()
    referral_code = _gen_referral_code(payload.full_name)
    # Ensure uniqueness
    while await users().find_one({"referral_code": referral_code}):
        referral_code = _gen_referral_code(payload.full_name)

    doc = {
        "_id": user_id,
        "user_code": user_code,
        "full_name": payload.full_name.strip(),
        "email": email,
        "phone": payload.phone.strip(),
        "password_hash": hash_password(payload.password),
        "role": "CUSTOMER",
        "status": "PENDING",  # Becomes ACTIVE after mock payment
        "referral_code": referral_code,
        "sponsor_user_id": sponsor_user_id,
        "placement_side_selected": placement_side_selected,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await users().insert_one(doc)

    access = create_access_token(user_id, email, "CUSTOMER")
    refresh = create_refresh_token(user_id)
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
    return {"user": sanitize_user(user), "access_token": access}


@auth_router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"success": True}


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


# ============== PUBLIC ROUTES ==============
public_router = APIRouter(tags=["public"])


@public_router.get("/scooters")
async def list_scooters():
    docs = await scooters().find({}).to_list(100)
    return {"scooters": docs}


@public_router.get("/scooters/{scooter_id}")
async def get_scooter(scooter_id: str):
    doc = await scooters().find_one({"_id": scooter_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Scooter not found")
    return doc


class ReferralValidateRequest(BaseModel):
    referral_code: str


@public_router.post("/referrals/validate")
async def validate_referral(payload: ReferralValidateRequest):
    code = payload.referral_code.strip().upper()
    sponsor = await users().find_one({"referral_code": code})
    if not sponsor:
        return {"valid": False}
    node = await tree_nodes().find_one({"_id": sponsor["_id"]})
    left_count = node.get("left_count", 0) if node else 0
    right_count = node.get("right_count", 0) if node else 0
    return {
        "valid": True,
        "referrer": {
            "user_id": sponsor["_id"],
            "user_code": sponsor.get("user_code"),
            "full_name": sponsor.get("full_name"),
            "status": sponsor.get("status"),
            "left_count": left_count,
            "right_count": right_count,
            "balance_diff": abs(left_count - right_count),
            "suggested_side": "LEFT" if left_count <= right_count else "RIGHT",
            "left_slot_empty": node is None or not node.get("left_child_id"),
            "right_slot_empty": node is None or not node.get("right_child_id"),
        },
    }


class TreePreviewRequest(BaseModel):
    referral_code: str
    selected_side: str  # LEFT or RIGHT


@public_router.post("/tree/preview-placement")
async def preview_placement_route(payload: TreePreviewRequest):
    sponsor = await users().find_one({"referral_code": payload.referral_code.strip().upper()})
    if not sponsor:
        raise HTTPException(status_code=400, detail="Invalid referral code")
    try:
        preview = await tree_service.preview_placement(sponsor["_id"], payload.selected_side)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return preview


# ============== ORDER / MOCK CHECKOUT ROUTES ==============
order_router = APIRouter(prefix="/orders", tags=["orders"])


class OrderCreateRequest(BaseModel):
    scooter_id: Optional[str] = None  # if omitted, default scooter is used


@order_router.post("/create")
async def create_order(payload: OrderCreateRequest, user: dict = Depends(get_current_user)):
    # Only pending or newly-registered customers can create an order (for demo, allow any customer)
    if user.get("role") not in ("CUSTOMER",):
        raise HTTPException(status_code=403, detail="Only customers can purchase")

    scooter_id = payload.scooter_id
    if not scooter_id:
        scooter = await scooters().find_one({})
        if not scooter:
            raise HTTPException(status_code=500, detail="No scooter available")
        scooter_id = scooter["_id"]
    else:
        scooter = await scooters().find_one({"_id": scooter_id})
        if not scooter:
            raise HTTPException(status_code=404, detail="Scooter not found")

    # Prevent duplicate active orders
    existing = await orders().find_one({
        "buyer_user_id": user["_id"],
        "payment_status": {"$in": ["CREATED", "PAID"]},
    })
    if existing and existing["payment_status"] == "PAID":
        raise HTTPException(status_code=409, detail="You have already purchased a scooter")
    if existing and existing["payment_status"] == "CREATED":
        return {"order": existing}

    amount = float(await _get_setting("scooter_price", scooter.get("price", 54999)))
    order_number = await _generate_order_number()

    sponsor_user_id = user.get("sponsor_user_id")
    referral_code_used = None
    if sponsor_user_id:
        sp = await users().find_one({"_id": sponsor_user_id})
        if sp:
            referral_code_used = sp.get("referral_code")

    order_doc = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "buyer_user_id": user["_id"],
        "scooter_id": scooter_id,
        "amount": amount,
        "referral_code_used": referral_code_used,
        "sponsor_user_id": sponsor_user_id,
        "placement_side_selected": user.get("placement_side_selected"),
        "payment_status": "CREATED",
        "delivery_status": "PENDING",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await orders().insert_one(order_doc)
    return {"order": order_doc}


async def _finalize_paid_order(order: dict) -> dict:
    """Common logic for marking order paid, activating user, placing in tree, creating commissions."""
    buyer_id = order["buyer_user_id"]
    buyer = await users().find_one({"_id": buyer_id})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    # Update order
    await orders().update_one(
        {"_id": order["_id"]},
        {"$set": {"payment_status": "PAID", "updated_at": _now_iso()}},
    )

    created_commissions = []
    # Activate & place buyer
    if buyer.get("status") != "ACTIVE":
        await users().update_one(
            {"_id": buyer_id},
            {"$set": {"status": "ACTIVE", "updated_at": _now_iso()}},
        )

        sponsor_id = buyer.get("sponsor_user_id")
        side = buyer.get("placement_side_selected") or order.get("placement_side_selected")

        if sponsor_id and side in ("LEFT", "RIGHT"):
            try:
                await tree_service.finalize_placement(buyer_id, sponsor_id, side)
            except ValueError:
                # Sponsor not in tree -- fallback: create standalone node (root-less)
                await tree_nodes().insert_one({
                    "_id": buyer_id, "user_id": buyer_id,
                    "parent_user_id": None, "placement_side": None,
                    "path": "", "depth": 0,
                    "left_child_id": None, "right_child_id": None,
                    "left_count": 0, "right_count": 0, "matched_pairs": 0,
                    "created_at": _now_iso(),
                })
            else:
                # Update tree counts up the chain (display only)
                await tree_service.update_ancestor_counts(buyer_id)
                # Pay the DIRECT sponsor a commission for this referral
                commission_amount = float(await _get_setting("commission_amount", 2700))
                created = await tree_service.create_sponsor_commission(
                    sponsor_id, buyer_id, order["_id"], commission_amount
                )
                if created:
                    created_commissions = [created]
        else:
            # No sponsor -- treat as root
            existing_node = await tree_nodes().find_one({"_id": buyer_id})
            if not existing_node:
                await tree_nodes().insert_one({
                    "_id": buyer_id, "user_id": buyer_id,
                    "parent_user_id": None, "placement_side": None,
                    "path": "", "depth": 0,
                    "left_child_id": None, "right_child_id": None,
                    "left_count": 0, "right_count": 0, "matched_pairs": 0,
                    "created_at": _now_iso(),
                })

    updated_order = await orders().find_one({"_id": order["_id"]})
    return {"order": updated_order, "commissions_created": len(created_commissions)}


@order_router.post("/{order_id}/simulate-payment-success")
async def simulate_payment_success(order_id: str, user: dict = Depends(get_current_user)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["buyer_user_id"] != user["_id"] and user.get("role") not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if order["payment_status"] == "PAID":
        return {"order": order, "message": "Already paid"}
    if order["payment_status"] == "REFUNDED":
        raise HTTPException(status_code=400, detail="Cannot pay a refunded order")
    return await _finalize_paid_order(order)


@order_router.post("/{order_id}/simulate-payment-failure")
async def simulate_payment_failure(order_id: str, user: dict = Depends(get_current_user)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["buyer_user_id"] != user["_id"] and user.get("role") not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Forbidden")
    await orders().update_one(
        {"_id": order_id},
        {"$set": {"payment_status": "FAILED", "updated_at": _now_iso()}},
    )
    return {"order": await orders().find_one({"_id": order_id})}


# ============== CUSTOMER ROUTES ==============
customer_router = APIRouter(prefix="/customer", tags=["customer"])


@customer_router.get("/dashboard")
async def customer_dashboard(user: dict = Depends(get_current_user)):
    user_id = user["_id"]
    node = await tree_nodes().find_one({"_id": user_id})
    left_count = node.get("left_count", 0) if node else 0
    right_count = node.get("right_count", 0) if node else 0
    matched_pairs = node.get("matched_pairs", 0) if node else 0

    # Commission totals
    pipeline = [
        {"$match": {"beneficiary_user_id": user_id}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    comm_totals = {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0}
    async for row in commissions().aggregate(pipeline):
        comm_totals[row["_id"]] = row["total"]

    # Wallet balance = APPROVED + PAID minus withdrawals PAID
    wt_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    wallet = {"COMMISSION_CREDIT": 0, "WITHDRAWAL_DEBIT": 0, "REVERSAL": 0, "ADJUSTMENT": 0}
    async for row in wallet_transactions().aggregate(wt_pipeline):
        wallet[row["_id"]] = row["total"]
    available_balance = wallet["COMMISSION_CREDIT"] - wallet["WITHDRAWAL_DEBIT"] - wallet["REVERSAL"] + wallet["ADJUSTMENT"]

    recent_commissions = await commissions().find(
        {"beneficiary_user_id": user_id}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Recent direct referrals
    recent_refs = await users().find(
        {"sponsor_user_id": user_id}
    ).sort("created_at", -1).limit(5).to_list(5)
    recent_refs = [sanitize_user(u) for u in recent_refs]

    # Order status
    order = await orders().find_one(
        {"buyer_user_id": user_id},
        sort=[("created_at", -1)],
    )

    return {
        "user": user,
        "node": node,
        "counts": {
            "left_count": left_count,
            "right_count": right_count,
            "matched_pairs": matched_pairs,
            "unmatched_left": max(left_count - matched_pairs, 0),
            "unmatched_right": max(right_count - matched_pairs, 0),
        },
        "commissions_summary": comm_totals,
        "available_balance": available_balance,
        "recent_commissions": recent_commissions,
        "recent_referrals": recent_refs,
        "order": order,
    }


@customer_router.get("/tree")
async def customer_tree(depth: int = 4, user: dict = Depends(get_current_user)):
    view = await tree_service.get_tree_view(user["_id"], depth)
    return {"tree": view}


@customer_router.get("/referrals")
async def customer_referrals(user: dict = Depends(get_current_user)):
    # Direct referrals
    directs = await users().find({"sponsor_user_id": user["_id"]}).sort("created_at", -1).to_list(500)
    # Downline (all descendants in tree)
    descendant_ids = await tree_service.get_all_descendant_ids(user["_id"])
    downline = []
    if descendant_ids:
        downline = await users().find({"_id": {"$in": descendant_ids}}).to_list(1000)
    # Add tree node info
    node_map = {}
    async for n in tree_nodes().find({"_id": {"$in": [d["_id"] for d in downline]}}):
        node_map[n["_id"]] = n

    def enrich(u):
        s = sanitize_user(u)
        n = node_map.get(u["_id"])
        s["placement_side"] = n.get("placement_side") if n else None
        s["placement_parent_user_id"] = n.get("parent_user_id") if n else None
        s["depth"] = n.get("depth") if n else None
        return s

    return {
        "direct_referrals": [sanitize_user(u) for u in directs],
        "downline": [enrich(u) for u in downline],
    }


@customer_router.get("/commissions")
async def customer_commissions(user: dict = Depends(get_current_user)):
    rows = await commissions().find({"beneficiary_user_id": user["_id"]}).sort("created_at", -1).to_list(1000)
    return {"commissions": rows}


@customer_router.get("/wallet")
async def customer_wallet(user: dict = Depends(get_current_user)):
    wt = await wallet_transactions().find({"user_id": user["_id"]}).sort("created_at", -1).to_list(500)
    wrs = await withdrawal_requests().find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
    # Balance calculations
    approved_total = 0
    async for c in commissions().find({"beneficiary_user_id": user["_id"], "status": {"$in": ["APPROVED", "PAID"]}}):
        approved_total += c["amount"]
    paid_total = 0
    async for c in commissions().find({"beneficiary_user_id": user["_id"], "status": "PAID"}):
        paid_total += c["amount"]
    pending_total = 0
    async for c in commissions().find({"beneficiary_user_id": user["_id"], "status": "PENDING"}):
        pending_total += c["amount"]

    withdrawn = 0
    async for w in withdrawal_requests().find({"user_id": user["_id"], "status": "PAID"}):
        withdrawn += w["amount"]
    pending_withdrawn = 0
    async for w in withdrawal_requests().find({"user_id": user["_id"], "status": {"$in": ["PENDING", "APPROVED"]}}):
        pending_withdrawn += w["amount"]

    available = approved_total - withdrawn - pending_withdrawn
    return {
        "available_balance": max(available, 0),
        "pending_balance": pending_total,
        "total_paid": paid_total,
        "total_withdrawn": withdrawn,
        "wallet_transactions": wt,
        "withdrawal_requests": wrs,
    }


class BankAccountCreateRequest(BaseModel):
    account_holder: str
    account_number: str
    ifsc: str
    bank_name: str


def _mask_account(num: str) -> str:
    if not num or len(num) < 4:
        return "****"
    return "*" * (len(num) - 4) + num[-4:]


@customer_router.post("/bank-accounts")
async def add_bank_account(payload: BankAccountCreateRequest, user: dict = Depends(get_current_user)):
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "account_holder": payload.account_holder,
        "account_number": payload.account_number,
        "account_number_masked": _mask_account(payload.account_number),
        "ifsc": payload.ifsc.upper(),
        "bank_name": payload.bank_name,
        "created_at": _now_iso(),
    }
    await bank_accounts().insert_one(doc)
    return {"bank_account": {**doc, "account_number": _mask_account(payload.account_number)}}


@customer_router.get("/bank-accounts")
async def list_bank_accounts(user: dict = Depends(get_current_user)):
    docs = await bank_accounts().find({"user_id": user["_id"]}).to_list(20)
    for d in docs:
        d["account_number"] = d.get("account_number_masked", "****")
    return {"bank_accounts": docs}


class WithdrawalRequestCreate(BaseModel):
    amount: float
    bank_account_id: str


@customer_router.post("/withdrawals")
async def create_withdrawal(payload: WithdrawalRequestCreate, user: dict = Depends(get_current_user)):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    ba = await bank_accounts().find_one({"_id": payload.bank_account_id, "user_id": user["_id"]})
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # Ensure enough approved balance
    approved_total = 0
    async for c in commissions().find({"beneficiary_user_id": user["_id"], "status": {"$in": ["APPROVED", "PAID"]}}):
        approved_total += c["amount"]
    withdrawn = 0
    async for w in withdrawal_requests().find({"user_id": user["_id"], "status": {"$in": ["PENDING", "APPROVED", "PAID"]}}):
        withdrawn += w["amount"]
    available = approved_total - withdrawn
    if payload.amount > available:
        raise HTTPException(status_code=400, detail=f"Insufficient approved balance. Available: ₹{available:.2f}")

    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "amount": payload.amount,
        "bank_account_id": ba["_id"],
        "bank_account_masked": ba["account_number_masked"],
        "bank_name": ba["bank_name"],
        "status": "PENDING",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "notes": None,
    }
    await withdrawal_requests().insert_one(doc)
    return {"withdrawal_request": doc}


@customer_router.get("/withdrawals")
async def list_withdrawals(user: dict = Depends(get_current_user)):
    docs = await withdrawal_requests().find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
    return {"withdrawal_requests": docs}


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None


@customer_router.patch("/profile")
async def update_profile(payload: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    updates = {"updated_at": _now_iso()}
    if payload.full_name:
        updates["full_name"] = payload.full_name.strip()
    if payload.phone:
        updates["phone"] = payload.phone.strip()
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        updates["password_hash"] = hash_password(payload.password)
    await users().update_one({"_id": user["_id"]}, {"$set": updates})
    updated = await users().find_one({"_id": user["_id"]})
    return {"user": sanitize_user(updated)}


# ============== ADMIN ROUTES ==============
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(get_current_admin)):
    total_users = await users().count_documents({})
    pending_users = await users().count_documents({"status": "PENDING"})
    active_users = await users().count_documents({"status": "ACTIVE"})
    total_orders = await orders().count_documents({})
    paid_orders = await orders().count_documents({"payment_status": "PAID"})
    failed_orders = await orders().count_documents({"payment_status": "FAILED"})
    refunded_orders = await orders().count_documents({"payment_status": "REFUNDED"})

    sales_pipeline = [
        {"$match": {"payment_status": "PAID"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    sales_total = 0
    async for row in orders().aggregate(sales_pipeline):
        sales_total = row["total"]

    comm_pipeline = [
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    comm_totals = {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0}
    comm_counts = {"PENDING": 0, "APPROVED": 0, "PAID": 0, "REJECTED": 0, "REVERSED": 0}
    async for row in commissions().aggregate(comm_pipeline):
        comm_totals[row["_id"]] = row["total"]
        comm_counts[row["_id"]] = row["count"]

    wr_pending = await withdrawal_requests().count_documents({"status": "PENDING"})

    recent_users = await users().find({}).sort("created_at", -1).limit(5).to_list(5)
    recent_orders = await orders().find({}).sort("created_at", -1).limit(5).to_list(5)

    return {
        "totals": {
            "total_users": total_users,
            "pending_users": pending_users,
            "active_users": active_users,
            "total_orders": total_orders,
            "paid_orders": paid_orders,
            "failed_orders": failed_orders,
            "refunded_orders": refunded_orders,
            "sales_total": sales_total,
            "pending_withdrawals": wr_pending,
        },
        "commissions_summary": comm_totals,
        "commissions_counts": comm_counts,
        "recent_users": [sanitize_user(u) for u in recent_users],
        "recent_orders": recent_orders,
    }


@admin_router.get("/users")
async def admin_list_users(
    q: Optional[str] = None,
    status: Optional[str] = None,
    role: Optional[str] = None,
    _: dict = Depends(get_current_admin),
):
    query = {}
    if status:
        query["status"] = status
    if role:
        query["role"] = role
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"user_code": {"$regex": q, "$options": "i"}},
            {"referral_code": {"$regex": q, "$options": "i"}},
        ]
    docs = await users().find(query).sort("created_at", -1).to_list(500)
    # Enrich with node info
    ids = [d["_id"] for d in docs]
    nodes = {}
    async for n in tree_nodes().find({"_id": {"$in": ids}}):
        nodes[n["_id"]] = n

    def enrich(u):
        s = sanitize_user(u)
        n = nodes.get(u["_id"])
        s["left_count"] = n.get("left_count", 0) if n else 0
        s["right_count"] = n.get("right_count", 0) if n else 0
        s["matched_pairs"] = n.get("matched_pairs", 0) if n else 0
        s["placement_side"] = n.get("placement_side") if n else None
        s["depth"] = n.get("depth") if n else None
        return s

    return {"users": [enrich(u) for u in docs]}


@admin_router.get("/users/{user_id}")
async def admin_user_detail(user_id: str, _: dict = Depends(get_current_admin)):
    u = await users().find_one({"_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    node = await tree_nodes().find_one({"_id": user_id})
    user_orders = await orders().find({"buyer_user_id": user_id}).sort("created_at", -1).to_list(50)
    user_commissions = await commissions().find({"beneficiary_user_id": user_id}).sort("created_at", -1).to_list(200)
    user_withdrawals = await withdrawal_requests().find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    referrals = await users().find({"sponsor_user_id": user_id}).to_list(200)
    return {
        "user": sanitize_user(u),
        "tree_node": node,
        "orders": user_orders,
        "commissions": user_commissions,
        "withdrawal_requests": user_withdrawals,
        "direct_referrals": [sanitize_user(r) for r in referrals],
    }


class UserStatusUpdate(BaseModel):
    status: str  # PENDING, ACTIVE, BLOCKED


@admin_router.patch("/users/{user_id}/status")
async def admin_update_user_status(user_id: str, payload: UserStatusUpdate, admin: dict = Depends(get_current_admin)):
    if payload.status not in ("PENDING", "ACTIVE", "BLOCKED"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await users().update_one({"_id": user_id}, {"$set": {"status": payload.status, "updated_at": _now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await _log_audit(admin, "user_status_change", "user", user_id, {"new_status": payload.status})
    return {"success": True}


@admin_router.get("/tree")
async def admin_tree(user_id: Optional[str] = None, depth: int = 4, _: dict = Depends(get_current_admin)):
    if user_id:
        view = await tree_service.get_tree_view(user_id, depth)
        if not view:
            raise HTTPException(status_code=404, detail="User not in tree")
        return {"tree": view}
    # Find any root (user with no parent)
    root_node = await tree_nodes().find_one({"parent_user_id": None})
    if not root_node:
        return {"tree": None}
    return {"tree": await tree_service.get_tree_view(root_node["_id"], depth)}


@admin_router.get("/tree/integrity-check")
async def admin_tree_integrity(_: dict = Depends(get_current_admin)):
    return await tree_service.validate_tree_integrity()


@admin_router.get("/orders")
async def admin_list_orders(
    status: Optional[str] = None,
    q: Optional[str] = None,
    _: dict = Depends(get_current_admin),
):
    query = {}
    if status:
        query["payment_status"] = status
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q, "$options": "i"}},
            {"referral_code_used": {"$regex": q, "$options": "i"}},
        ]
    docs = await orders().find(query).sort("created_at", -1).to_list(500)
    # Enrich with buyer info
    buyer_ids = list({d["buyer_user_id"] for d in docs})
    buyers = {}
    async for u in users().find({"_id": {"$in": buyer_ids}}):
        buyers[u["_id"]] = {"full_name": u.get("full_name"), "email": u.get("email"), "user_code": u.get("user_code")}
    for d in docs:
        d["buyer"] = buyers.get(d["buyer_user_id"])
    return {"orders": docs}


@admin_router.patch("/orders/{order_id}/simulate-paid")
async def admin_simulate_paid(order_id: str, admin: dict = Depends(get_current_admin)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] == "PAID":
        return {"order": order}
    result = await _finalize_paid_order(order)
    await _log_audit(admin, "order_simulate_paid", "order", order_id, {})
    return result


@admin_router.patch("/orders/{order_id}/simulate-failed")
async def admin_simulate_failed(order_id: str, admin: dict = Depends(get_current_admin)):
    result = await orders().update_one(
        {"_id": order_id},
        {"$set": {"payment_status": "FAILED", "updated_at": _now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    await _log_audit(admin, "order_simulate_failed", "order", order_id, {})
    return {"success": True}


@admin_router.patch("/orders/{order_id}/cancel")
async def admin_cancel_order(order_id: str, admin: dict = Depends(get_current_admin)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await orders().update_one(
        {"_id": order_id},
        {"$set": {"delivery_status": "CANCELLED", "updated_at": _now_iso()}},
    )
    await _log_audit(admin, "order_cancel", "order", order_id, {})
    return {"success": True}


@admin_router.patch("/orders/{order_id}/refund")
async def admin_refund_order(order_id: str, admin: dict = Depends(get_current_admin)):
    order = await orders().find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await orders().update_one(
        {"_id": order_id},
        {"$set": {"payment_status": "REFUNDED", "updated_at": _now_iso()}},
    )
    # Reverse all commissions triggered by this order
    async for c in commissions().find({"order_id": order_id, "status": {"$in": ["PENDING", "APPROVED"]}}):
        await commissions().update_one(
            {"_id": c["_id"]},
            {"$set": {"status": "REVERSED", "reversed_at": _now_iso(), "notes": "Order refunded"}},
        )
    await _log_audit(admin, "order_refund", "order", order_id, {})
    return {"success": True}


@admin_router.patch("/orders/{order_id}/deliver")
async def admin_deliver_order(order_id: str, admin: dict = Depends(get_current_admin)):
    result = await orders().update_one(
        {"_id": order_id},
        {"$set": {"delivery_status": "DELIVERED", "updated_at": _now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    await _log_audit(admin, "order_deliver", "order", order_id, {})
    return {"success": True}


@admin_router.get("/commissions")
async def admin_list_commissions(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    _: dict = Depends(get_current_admin),
):
    query = {}
    if status:
        query["status"] = status
    if user_id:
        query["beneficiary_user_id"] = user_id
    docs = await commissions().find(query).sort("created_at", -1).to_list(1000)
    # Enrich beneficiary info
    ids = list({d["beneficiary_user_id"] for d in docs})
    b_map = {}
    async for u in users().find({"_id": {"$in": ids}}):
        b_map[u["_id"]] = {"full_name": u.get("full_name"), "email": u.get("email"), "user_code": u.get("user_code")}
    for d in docs:
        d["beneficiary"] = b_map.get(d["beneficiary_user_id"])
    return {"commissions": docs}


async def _create_wallet_txn(user_id: str, txn_type: str, amount: float, ref_type: str, ref_id: str):
    await wallet_transactions().insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": txn_type,
        "amount": amount,
        "reference_type": ref_type,
        "reference_id": ref_id,
        "created_at": _now_iso(),
    })


@admin_router.patch("/commissions/{commission_id}/approve")
async def admin_approve_commission(commission_id: str, admin: dict = Depends(get_current_admin)):
    c = await commissions().find_one({"_id": commission_id})
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if c["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {c['status']} commission")
    await commissions().update_one({"_id": commission_id}, {"$set": {"status": "APPROVED", "approved_at": _now_iso()}})
    await _log_audit(admin, "commission_approve", "commission", commission_id, {})
    return {"success": True}


@admin_router.patch("/commissions/{commission_id}/reject")
async def admin_reject_commission(commission_id: str, admin: dict = Depends(get_current_admin)):
    c = await commissions().find_one({"_id": commission_id})
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if c["status"] in ("PAID", "REJECTED", "REVERSED"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a {c['status']} commission")
    await commissions().update_one({"_id": commission_id}, {"$set": {"status": "REJECTED", "rejected_at": _now_iso()}})
    await _log_audit(admin, "commission_reject", "commission", commission_id, {})
    return {"success": True}


@admin_router.patch("/commissions/{commission_id}/reverse")
async def admin_reverse_commission(commission_id: str, admin: dict = Depends(get_current_admin)):
    c = await commissions().find_one({"_id": commission_id})
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if c["status"] == "REVERSED":
        raise HTTPException(status_code=400, detail="Already reversed")
    await commissions().update_one({"_id": commission_id}, {"$set": {"status": "REVERSED", "reversed_at": _now_iso()}})
    if c["status"] == "PAID":
        # Create reversal wallet txn
        await _create_wallet_txn(c["beneficiary_user_id"], "REVERSAL", c["amount"], "commission", commission_id)
    await _log_audit(admin, "commission_reverse", "commission", commission_id, {})
    return {"success": True}


@admin_router.patch("/commissions/{commission_id}/mark-paid")
async def admin_mark_commission_paid(commission_id: str, admin: dict = Depends(get_current_admin)):
    c = await commissions().find_one({"_id": commission_id})
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if c["status"] in ("REJECTED", "REVERSED"):
        raise HTTPException(status_code=400, detail=f"Cannot mark a {c['status']} commission as paid")
    await commissions().update_one({"_id": commission_id}, {"$set": {"status": "PAID", "paid_at": _now_iso()}})
    await _create_wallet_txn(c["beneficiary_user_id"], "COMMISSION_CREDIT", c["amount"], "commission", commission_id)
    await _log_audit(admin, "commission_mark_paid", "commission", commission_id, {})
    return {"success": True}


@admin_router.get("/withdrawals")
async def admin_list_withdrawals(status: Optional[str] = None, _: dict = Depends(get_current_admin)):
    query = {}
    if status:
        query["status"] = status
    docs = await withdrawal_requests().find(query).sort("created_at", -1).to_list(500)
    ids = list({d["user_id"] for d in docs})
    umap = {}
    async for u in users().find({"_id": {"$in": ids}}):
        umap[u["_id"]] = {"full_name": u.get("full_name"), "email": u.get("email"), "user_code": u.get("user_code")}
    for d in docs:
        d["user"] = umap.get(d["user_id"])
    return {"withdrawal_requests": docs}


@admin_router.patch("/withdrawals/{wr_id}/approve")
async def admin_approve_withdrawal(wr_id: str, admin: dict = Depends(get_current_admin)):
    wr = await withdrawal_requests().find_one({"_id": wr_id})
    if not wr:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if wr["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {wr['status']} withdrawal")
    await withdrawal_requests().update_one({"_id": wr_id}, {"$set": {"status": "APPROVED", "updated_at": _now_iso()}})
    await _log_audit(admin, "withdrawal_approve", "withdrawal", wr_id, {})
    return {"success": True}


@admin_router.patch("/withdrawals/{wr_id}/reject")
async def admin_reject_withdrawal(wr_id: str, admin: dict = Depends(get_current_admin)):
    wr = await withdrawal_requests().find_one({"_id": wr_id})
    if not wr:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if wr["status"] in ("PAID", "REJECTED"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a {wr['status']} withdrawal")
    await withdrawal_requests().update_one({"_id": wr_id}, {"$set": {"status": "REJECTED", "updated_at": _now_iso()}})
    await _log_audit(admin, "withdrawal_reject", "withdrawal", wr_id, {})
    return {"success": True}


@admin_router.patch("/withdrawals/{wr_id}/mark-paid")
async def admin_mark_withdrawal_paid(wr_id: str, admin: dict = Depends(get_current_admin)):
    wr = await withdrawal_requests().find_one({"_id": wr_id})
    if not wr:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if wr["status"] not in ("PENDING", "APPROVED"):
        raise HTTPException(status_code=400, detail=f"Cannot mark {wr['status']} withdrawal as paid")
    await withdrawal_requests().update_one({"_id": wr_id}, {"$set": {"status": "PAID", "updated_at": _now_iso()}})
    await _create_wallet_txn(wr["user_id"], "WITHDRAWAL_DEBIT", wr["amount"], "withdrawal", wr_id)
    await _log_audit(admin, "withdrawal_mark_paid", "withdrawal", wr_id, {})
    return {"success": True}


@admin_router.get("/audit-logs")
async def admin_audit_logs(_: dict = Depends(get_current_admin)):
    docs = await audit_logs().find({}).sort("created_at", -1).to_list(500)
    return {"audit_logs": docs}


@admin_router.get("/settings")
async def admin_get_settings(_: dict = Depends(get_current_admin)):
    docs = await system_settings().find({}).to_list(100)
    return {"settings": {d["_id"]: d["value"] for d in docs}}


class SettingsUpdate(BaseModel):
    scooter_price: Optional[float] = None
    commission_amount: Optional[float] = None
    demo_mode: Optional[bool] = None


@admin_router.patch("/settings")
async def admin_update_settings(payload: SettingsUpdate, admin: dict = Depends(get_current_admin)):
    changes = {}
    if payload.scooter_price is not None:
        await system_settings().update_one({"_id": "scooter_price"}, {"$set": {"value": payload.scooter_price}}, upsert=True)
        changes["scooter_price"] = payload.scooter_price
    if payload.commission_amount is not None:
        await system_settings().update_one({"_id": "commission_amount"}, {"$set": {"value": payload.commission_amount}}, upsert=True)
        changes["commission_amount"] = payload.commission_amount
    if payload.demo_mode is not None:
        await system_settings().update_one({"_id": "demo_mode"}, {"$set": {"value": payload.demo_mode}}, upsert=True)
        changes["demo_mode"] = payload.demo_mode
    await _log_audit(admin, "settings_update", "settings", "global", changes)
    return {"success": True, "changes": changes}
