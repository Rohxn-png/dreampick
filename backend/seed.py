"""Seed demo data: super admin, admin, 15+ customers in a binary tree, orders, commissions."""
import os
import uuid
import random
from datetime import datetime, timezone, timedelta
import secrets
import re

from auth import hash_password
from db import (
    users, tree_nodes, scooters, orders, commissions,
    wallet_transactions, withdrawal_requests, bank_accounts,
    audit_logs, system_settings, next_sequence,
)
import tree_service


def _iso(dt):
    return dt.isoformat()


def _now():
    return datetime.now(timezone.utc)


def _ref_code(name: str) -> str:
    prefix = re.sub(r"[^A-Z]", "", (name or "USER").upper())[:4] or "USER"
    return f"{prefix}{secrets.token_hex(3).upper()}"


async def _make_user_code() -> str:
    n = await next_sequence("user_code")
    return f"DP{n:05d}"


async def _create_admin(email, name, role, password):
    existing = await users().find_one({"email": email})
    if existing:
        return existing
    uid = str(uuid.uuid4())
    doc = {
        "_id": uid,
        "user_code": await _make_user_code(),
        "full_name": name,
        "email": email,
        "phone": "+91-0000000000",
        "password_hash": hash_password(password),
        "role": role,
        "status": "ACTIVE",
        "referral_code": _ref_code(name),
        "sponsor_user_id": None,
        "placement_side_selected": None,
        "created_at": _iso(_now()),
        "updated_at": _iso(_now()),
    }
    await users().insert_one(doc)
    return doc


async def _create_customer(email, name, phone, sponsor_id=None, side=None, active=True):
    uid = str(uuid.uuid4())
    doc = {
        "_id": uid,
        "user_code": await _make_user_code(),
        "full_name": name,
        "email": email,
        "phone": phone,
        "password_hash": hash_password(os.environ.get("DEMO_CUSTOMER_PASSWORD", "Demo@123")),
        "role": "CUSTOMER",
        "status": "ACTIVE" if active else "PENDING",
        "referral_code": _ref_code(name),
        "sponsor_user_id": sponsor_id,
        "placement_side_selected": side,
        "created_at": _iso(_now()),
        "updated_at": _iso(_now()),
    }
    await users().insert_one(doc)
    return doc


async def _place_and_activate(user_id, sponsor_id, side, order_amount, commission_amount):
    """Create a paid order and place user in tree, generating a sponsor commission."""
    order_id = str(uuid.uuid4())
    order_num = await next_sequence("order_number")
    scooter = await scooters().find_one({})
    order_doc = {
        "_id": order_id,
        "order_number": f"DP-ORD-{order_num:05d}",
        "buyer_user_id": user_id,
        "scooter_id": scooter["_id"] if scooter else None,
        "amount": order_amount,
        "referral_code_used": None,
        "sponsor_user_id": sponsor_id,
        "placement_side_selected": side,
        "payment_status": "PAID",
        "delivery_status": "PENDING",
        "created_at": _iso(_now()),
        "updated_at": _iso(_now()),
    }
    if sponsor_id:
        sponsor = await users().find_one({"_id": sponsor_id})
        if sponsor:
            order_doc["referral_code_used"] = sponsor.get("referral_code")
    await orders().insert_one(order_doc)

    if sponsor_id and side:
        try:
            await tree_service.finalize_placement(user_id, sponsor_id, side)
            await tree_service.update_ancestor_counts(user_id)
            await tree_service.create_sponsor_commission(sponsor_id, user_id, order_id, commission_amount)
        except Exception as e:
            print(f"[seed] placement error for {user_id}: {e}")
    else:
        # Root
        await tree_nodes().insert_one({
            "_id": user_id, "user_id": user_id,
            "parent_user_id": None, "placement_side": None,
            "path": "", "depth": 0,
            "left_child_id": None, "right_child_id": None,
            "left_count": 0, "right_count": 0, "matched_pairs": 0,
            "created_at": _iso(_now()),
        })


async def _migrate_commission_model():
    """One-shot migration to switch from matched-pair commissions to direct-sponsor commissions.
    Idempotent — uses a settings flag.
    """
    flag = await system_settings().find_one({"_id": "commission_model"})
    if flag and flag.get("value") == "direct_sponsor":
        return

    print("[seed] Migrating commission model to direct_sponsor…")

    # Drop existing unique indexes on commissions (best-effort)
    try:
        idxs = await commissions().index_information()
        for name, spec in idxs.items():
            if name == "_id_":
                continue
            await commissions().drop_index(name)
    except Exception as e:
        print(f"[seed] index drop warning: {e}")

    # Clear all commissions and COMMISSION_CREDIT wallet transactions (old model artifacts)
    await commissions().delete_many({})
    await wallet_transactions().delete_many({"type": "COMMISSION_CREDIT"})

    # Recreate index on new uniqueness key
    await commissions().create_index(
        [("beneficiary_user_id", 1), ("triggering_user_id", 1)],
        unique=True,
        name="beneficiary_triggering_unique",
    )

    # Rebuild commissions from existing PAID orders — one per direct sponsor
    doc_cm = await system_settings().find_one({"_id": "commission_amount"})
    commission_amount = float(doc_cm["value"]) if doc_cm else 2700.0

    async for o in orders().find({"payment_status": "PAID"}):
        buyer_id = o["buyer_user_id"]
        buyer = await users().find_one({"_id": buyer_id})
        if not buyer:
            continue
        sponsor_id = buyer.get("sponsor_user_id") or o.get("sponsor_user_id")
        if not sponsor_id:
            continue
        await tree_service.create_sponsor_commission(sponsor_id, buyer_id, o["_id"], commission_amount)

    # Add demo status variety: mark some as APPROVED / PAID
    comm_docs = await commissions().find({}).to_list(1000)
    for i, c in enumerate(comm_docs):
        if i % 4 == 0:
            await commissions().update_one({"_id": c["_id"]}, {"$set": {"status": "APPROVED", "approved_at": _iso(_now())}})
        elif i % 4 == 1:
            await commissions().update_one({"_id": c["_id"]}, {"$set": {"status": "PAID", "approved_at": _iso(_now()), "paid_at": _iso(_now())}})
            await wallet_transactions().insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": c["beneficiary_user_id"],
                "type": "COMMISSION_CREDIT",
                "amount": c["amount"],
                "reference_type": "commission",
                "reference_id": c["_id"],
                "created_at": _iso(_now()),
            })

    await system_settings().update_one(
        {"_id": "commission_model"},
        {"$set": {"value": "direct_sponsor"}},
        upsert=True,
    )
    print("[seed] Commission model migration complete.")


async def seed_all():
    # Indexes (idempotent)
    await users().create_index("email", unique=True)
    await users().create_index("referral_code", unique=True)
    await tree_nodes().create_index([("parent_user_id", 1), ("placement_side", 1)])

    # Migrate commission model BEFORE creating the new index (avoids conflict with old unique idx)
    await _migrate_commission_model()

    # Ensure the new commissions index exists (safe if already created by migration)
    await commissions().create_index(
        [("beneficiary_user_id", 1), ("triggering_user_id", 1)],
        unique=True,
        name="beneficiary_triggering_unique",
    )

    # Settings
    scooter_price = float(os.environ.get("SCOOTER_PRICE", 54999))
    commission_amount = float(os.environ.get("COMMISSION_AMOUNT", 2700))
    await system_settings().update_one({"_id": "scooter_price"}, {"$set": {"value": scooter_price}}, upsert=True)
    await system_settings().update_one({"_id": "commission_amount"}, {"$set": {"value": commission_amount}}, upsert=True)
    await system_settings().update_one({"_id": "demo_mode"}, {"$set": {"value": True}}, upsert=True)
    await system_settings().update_one({"_id": "site_content"}, {"$set": {"value": {"tagline": "Ride the electric future"}}}, upsert=True)

    # Scooter product
    if not await scooters().find_one({}):
        await scooters().insert_one({
            "_id": str(uuid.uuid4()),
            "name": "Dream Pick Volt X1",
            "price": scooter_price,
            "description": "Premium urban electric scooter with 120 km range, 80 km/h top speed, LFP battery, and smart connected features.",
            "image_url": "https://images.unsplash.com/photo-1623079398118-11b5da627a00?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBFViUyMHNjb290ZXIlMjBzdHVkaW8lMjBsaWdodGluZyUyMGRhcmslMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4MzI0OTk2Nnww&ixlib=rb-4.1.0&q=85",
            "specs": {
                "battery": "3.2 kWh LFP",
                "range_km": 120,
                "top_speed_kmph": 80,
                "charge_time_hours": 4,
                "motor": "5.5 kW hub motor",
                "warranty_years": 3,
            },
            "created_at": _iso(_now()),
        })

    # Super admin & admin
    await _create_admin(os.environ["SUPER_ADMIN_EMAIL"], "Super Admin", "SUPER_ADMIN", os.environ["SUPER_ADMIN_PASSWORD"])
    await _create_admin(os.environ["ADMIN_EMAIL"], "Admin", "ADMIN", os.environ["ADMIN_PASSWORD"])

    # Skip customer seeding if already done
    if await users().count_documents({"role": "CUSTOMER"}) >= 15:
        return

    # Build a tree: customer1 is root, then 15 customers under them alternating
    demo_names = [
        "Aarav Sharma", "Ishita Verma", "Rohan Mehta", "Priya Nair", "Kabir Singh",
        "Ananya Iyer", "Vihaan Rao", "Saanvi Desai", "Arjun Kapoor", "Diya Menon",
        "Aditya Joshi", "Meera Patel", "Reyansh Gupta", "Kavya Bhatt", "Ayaan Khan",
        "Neha Bansal", "Yash Chawla",
    ]

    root_customer = await _create_customer("customer1@dreampick.demo", demo_names[0], "+91-9000000001", sponsor_id=None, side=None, active=True)
    await _place_and_activate(root_customer["_id"], None, None, scooter_price, commission_amount)

    active_pool = [root_customer]  # available sponsors
    for i in range(1, 16):
        name = demo_names[i]
        email = f"customer{i+1}@dreampick.demo"
        phone = f"+91-90000000{i+1:02d}"
        # Choose sponsor (rotating) & side (alternate)
        sponsor = active_pool[i % len(active_pool)]
        side = "LEFT" if i % 2 == 1 else "RIGHT"
        cust = await _create_customer(email, name, phone, sponsor_id=sponsor["_id"], side=side, active=True)
        await _place_and_activate(cust["_id"], sponsor["_id"], side, scooter_price, commission_amount)
        active_pool.append(cust)

    # Add 2 pending customers (no order paid)
    pending_names = ["Pending Sam", "Pending Priya"]
    for i, n in enumerate(pending_names):
        sponsor = random.choice(active_pool)
        side = random.choice(["LEFT", "RIGHT"])
        await _create_customer(f"pending{i+1}@dreampick.demo", n, f"+91-91111111{i+1:02d}", sponsor_id=sponsor["_id"], side=side, active=False)
        # Create a CREATED order (not paid)
        order_num = await next_sequence("order_number")
        scooter = await scooters().find_one({})
        pending_user = await users().find_one({"email": f"pending{i+1}@dreampick.demo"})
        await orders().insert_one({
            "_id": str(uuid.uuid4()),
            "order_number": f"DP-ORD-{order_num:05d}",
            "buyer_user_id": pending_user["_id"],
            "scooter_id": scooter["_id"] if scooter else None,
            "amount": scooter_price,
            "referral_code_used": sponsor.get("referral_code"),
            "sponsor_user_id": sponsor["_id"],
            "placement_side_selected": side,
            "payment_status": "CREATED",
            "delivery_status": "PENDING",
            "created_at": _iso(_now()),
            "updated_at": _iso(_now()),
        })

    # Add a FAILED order and REFUNDED order for demo
    scooter = await scooters().find_one({})
    if scooter:
        # FAILED
        target = active_pool[1]
        order_num = await next_sequence("order_number")
        await orders().insert_one({
            "_id": str(uuid.uuid4()),
            "order_number": f"DP-ORD-{order_num:05d}",
            "buyer_user_id": target["_id"],
            "scooter_id": scooter["_id"],
            "amount": scooter_price,
            "referral_code_used": None,
            "sponsor_user_id": None,
            "placement_side_selected": None,
            "payment_status": "FAILED",
            "delivery_status": "PENDING",
            "created_at": _iso(_now()),
            "updated_at": _iso(_now()),
        })

    # Randomly approve/pay some commissions
    comm_docs = await commissions().find({}).to_list(1000)
    for i, c in enumerate(comm_docs):
        if i % 4 == 0:
            await commissions().update_one({"_id": c["_id"]}, {"$set": {"status": "APPROVED", "approved_at": _iso(_now())}})
        elif i % 4 == 1:
            await commissions().update_one({"_id": c["_id"]}, {"$set": {"status": "PAID", "approved_at": _iso(_now()), "paid_at": _iso(_now())}})
            await wallet_transactions().insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": c["beneficiary_user_id"],
                "type": "COMMISSION_CREDIT",
                "amount": c["amount"],
                "reference_type": "commission",
                "reference_id": c["_id"],
                "created_at": _iso(_now()),
            })

    # Create a demo withdrawal request for root customer
    if not await withdrawal_requests().find_one({}):
        # Add a mock bank account first
        ba_id = str(uuid.uuid4())
        await bank_accounts().insert_one({
            "_id": ba_id,
            "user_id": root_customer["_id"],
            "account_holder": root_customer["full_name"],
            "account_number": "1234567890123456",
            "account_number_masked": "************3456",
            "ifsc": "HDFC0001234",
            "bank_name": "HDFC Bank",
            "created_at": _iso(_now()),
        })
        await withdrawal_requests().insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": root_customer["_id"],
            "amount": 5400.0,
            "bank_account_id": ba_id,
            "bank_account_masked": "************3456",
            "bank_name": "HDFC Bank",
            "status": "PENDING",
            "created_at": _iso(_now()),
            "updated_at": _iso(_now()),
            "notes": None,
        })

    print("[seed] Seed data created.")
