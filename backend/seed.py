"""Seed: fresh ready-to-use Dreampick database.
- Creates ONE admin from env
- Sets default commission configurations
- WIPES all demo data on first migration
"""
import os
import uuid
import re
import secrets
from datetime import datetime, timezone
from auth import hash_password
from db import (
    users, tree_nodes, scooters, orders, commissions,
    wallet_transactions, withdrawal_requests, bank_accounts,
    audit_logs, system_settings, next_sequence,
    cashback_schedule, notifications, media_assets,
    password_reset_tokens, payout_receipts, bank_reveal_sessions,
)


def _iso(dt):
    return dt.isoformat()


def _now():
    return datetime.now(timezone.utc)


async def _make_user_code() -> str:
    n = await next_sequence("user_code")
    return f"DP{n:05d}"


def _ref_code(name: str) -> str:
    prefix = re.sub(r"[^A-Z]", "", (name or "USER").upper())[:4] or "USER"
    return f"{prefix}{secrets.token_hex(3).upper()}"


async def _wipe_demo_data():
    """Called only if the fresh-start marker isn't set."""
    marker = await system_settings().find_one({"_id": "data_model_version"})
    if marker and marker.get("value") == "dreampick_v3":
        return False
    # Wipe everything except settings (we'll rebuild settings)
    await users().delete_many({})
    await tree_nodes().delete_many({})
    await orders().delete_many({})
    await commissions().delete_many({})
    await wallet_transactions().delete_many({})
    await withdrawal_requests().delete_many({})
    await bank_accounts().delete_many({})
    await audit_logs().delete_many({})
    await cashback_schedule().delete_many({})
    await notifications().delete_many({})
    await media_assets().delete_many({})
    await password_reset_tokens().delete_many({})
    await payout_receipts().delete_many({})
    await bank_reveal_sessions().delete_many({})
    # Reset counters
    from db import counters
    await counters().delete_many({})
    return True


async def seed_all():
    wiped = await _wipe_demo_data()

    # Indexes (after wipe so no dup key issues)
    await users().create_index("email", unique=True)
    await users().create_index("referral_code", unique=True)
    await tree_nodes().create_index([("parent_user_id", 1), ("placement_side", 1)])

    # Drop existing commissions indexes (may have old schema)
    try:
        idxs = await commissions().index_information()
        for name in list(idxs.keys()):
            if name != "_id_":
                await commissions().drop_index(name)
    except Exception:
        pass

    # New commission indexes — separate for matching (with pair number) and direct referral
    await commissions().create_index(
        [("commission_type", 1), ("beneficiary_user_id", 1), ("matched_pair_number", 1)],
        unique=True,
        partialFilterExpression={"matched_pair_number": {"$type": "int"}},
        name="matching_unique_idx",
    )
    await commissions().create_index(
        [("commission_type", 1), ("beneficiary_user_id", 1), ("triggering_user_id", 1), ("order_id", 1)],
        unique=True,
        name="direct_unique_idx",
    )
    await password_reset_tokens().create_index("token", unique=True)

    wiped = True  # already handled at top
    cashback_cfg = {
        "plan_price": 54999,
        "gross_monthly": 3000,
        "admin_charge_percent": 10,
        "months": 10,
        "first_payout_delay_days": 45,
        "status": "active",
        "rounding_mode": "two_decimals",
    }
    direct_cfg = {
        "plan_price": 54999,
        "gross_percent": 5,
        "admin_charge_percent": 10,
        "status": "active",
        "rounding_mode": "nearest_rupee",
    }
    matching_cfg = {
        "plan_price": 54999,
        "gross_percent": 2.5,
        "admin_charge_percent": 10,
        "status": "active",
        "rounding_mode": "round_down",
    }
    await system_settings().update_one({"_id": "cashback_config"}, {"$set": {"value": cashback_cfg}}, upsert=True)
    await system_settings().update_one({"_id": "direct_referral_config"}, {"$set": {"value": direct_cfg}}, upsert=True)
    await system_settings().update_one({"_id": "matching_config"}, {"$set": {"value": matching_cfg}}, upsert=True)
    await system_settings().update_one({"_id": "plan_price"}, {"$set": {"value": 54999}}, upsert=True)
    await system_settings().update_one({"_id": "gst_number"}, {"$set": {"value": os.environ.get("GST_NUMBER", "29AAMCD4327L1Z6")}}, upsert=True)
    await system_settings().update_one({"_id": "company_name"}, {"$set": {"value": os.environ.get("COMPANY_NAME", "Dreampick Private Limited")}}, upsert=True)
    await system_settings().update_one({"_id": "data_model_version"}, {"$set": {"value": "dreampick_v3"}}, upsert=True)

    # Product placeholder (needed for orders reference)
    if not await scooters().find_one({}):
        await scooters().insert_one({
            "_id": str(uuid.uuid4()),
            "name": "Basic EV Scooter Plan",
            "price": 54999,
            "description": "Basic EV Scooter Plan — 45-50 km range, 1-year battery & converter warranty, Non-registered vehicle (Non-RTO).",
            "image_url": None,
            "specs": {"range_km": "45–50", "warranty_years": 1, "registration": "Non-RTO"},
            "created_at": _iso(_now()),
        })

    # Initial admin (only if not exists)
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    existing = await users().find_one({"email": admin_email})
    if not existing:
        uid = str(uuid.uuid4())
        await users().insert_one({
            "_id": uid,
            "user_code": await _make_user_code(),
            "full_name": "Dreampick Admin",
            "email": admin_email,
            "phone": "",
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "role": "ADMIN",
            "status": "ACTIVE",
            "referral_code": _ref_code("ADMIN"),
            "sponsor_user_id": None,
            "placement_side_selected": None,
            "must_change_password": False,
            "created_at": _iso(_now()),
            "updated_at": _iso(_now()),
        })

    if wiped:
        print("[seed] Fresh Dreampick database initialised (demo data cleared).")
