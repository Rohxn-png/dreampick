"""Binary tree placement, ancestor counting, and Dreampick commission generation
(three types: BUYER_CASHBACK, DIRECT_REFERRAL, MATCHING_INCOME).
"""
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN, ROUND_UP
from db import (
    tree_nodes, users, commissions, cashback_schedule, notifications,
    system_settings,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _round_amount(amount: float, mode: str) -> float:
    q = Decimal(str(amount))
    if mode == "round_down":
        return float(q.quantize(Decimal("1"), rounding=ROUND_DOWN))
    if mode == "round_up":
        return float(q.quantize(Decimal("1"), rounding=ROUND_UP))
    if mode == "nearest_rupee":
        return float(q.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    # two_decimals default
    return float(q.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


async def get_node(user_id: str):
    return await tree_nodes().find_one({"_id": user_id})


async def get_user(user_id: str):
    return await users().find_one({"_id": user_id})


async def _get_config(key: str) -> dict:
    doc = await system_settings().find_one({"_id": key})
    return doc["value"] if doc else {}


async def _find_first_available_slot(branch_root_user_id: str):
    from collections import deque
    root = await get_node(branch_root_user_id)
    if not root:
        return None
    queue = deque([root])
    while queue:
        node = queue.popleft()
        if not node.get("left_child_id"):
            return (node["_id"], "LEFT")
        if not node.get("right_child_id"):
            return (node["_id"], "RIGHT")
        left_child = await get_node(node["left_child_id"])
        right_child = await get_node(node["right_child_id"])
        if left_child:
            queue.append(left_child)
        if right_child:
            queue.append(right_child)
    return None


async def preview_placement(referrer_id: str, selected_side: str) -> dict:
    if selected_side not in ("LEFT", "RIGHT"):
        raise ValueError("selected_side must be LEFT or RIGHT")
    referrer = await get_user(referrer_id)
    if not referrer:
        raise ValueError("Referrer not found")
    if referrer.get("status") != "ACTIVE":
        raise ValueError("Referrer is not active")
    ref_node = await get_node(referrer_id)
    left_count = ref_node.get("left_count", 0) if ref_node else 0
    right_count = ref_node.get("right_count", 0) if ref_node else 0
    balance_diff = abs(left_count - right_count)
    suggested = "LEFT" if left_count <= right_count else "RIGHT"
    child_key = "left_child_id" if selected_side == "LEFT" else "right_child_id"
    direct_slot_empty = ref_node is None or not ref_node.get(child_key)
    if direct_slot_empty:
        placement_parent_id, placement_side = referrer_id, selected_side
        expected_depth = (ref_node.get("depth", 0) if ref_node else 0) + 1
    else:
        branch_root_id = ref_node[child_key]
        slot = await _find_first_available_slot(branch_root_id)
        if not slot:
            raise ValueError("No available slot found")
        placement_parent_id, placement_side = slot
        parent_node = await get_node(placement_parent_id)
        expected_depth = (parent_node.get("depth", 0) if parent_node else 0) + 1
    placement_parent = await get_user(placement_parent_id)
    return {
        "referrer": {
            "user_id": referrer["_id"],
            "user_code": referrer.get("user_code"),
            "full_name": referrer.get("full_name"),
            "left_count": left_count,
            "right_count": right_count,
            "balance_diff": balance_diff,
        },
        "suggested_side": suggested,
        "direct_slot_empty": direct_slot_empty,
        "placement_preview": {
            "placement_parent_user_id": placement_parent_id,
            "placement_parent_user_code": placement_parent.get("user_code") if placement_parent else None,
            "placement_side": placement_side,
            "expected_depth": expected_depth,
            "selected_branch_count": left_count if selected_side == "LEFT" else right_count,
        },
    }


async def finalize_placement(new_user_id: str, referrer_id: str, selected_side: str):
    if selected_side not in ("LEFT", "RIGHT"):
        raise ValueError("selected_side must be LEFT or RIGHT")
    existing = await get_node(new_user_id)
    if existing:
        return existing
    ref_node = await get_node(referrer_id)
    if not ref_node:
        raise ValueError("Referrer is not placed in tree yet")
    child_key = "left_child_id" if selected_side == "LEFT" else "right_child_id"
    if not ref_node.get(child_key):
        placement_parent_id, placement_side = referrer_id, selected_side
    else:
        slot = await _find_first_available_slot(ref_node[child_key])
        if not slot:
            raise ValueError("No available slot in selected branch")
        placement_parent_id, placement_side = slot
    parent_node = await get_node(placement_parent_id)
    parent_path = parent_node.get("path", "")
    parent_depth = parent_node.get("depth", 0)
    step = "L" if placement_side == "LEFT" else "R"
    new_path = parent_path + step if parent_path else step
    new_node = {
        "_id": new_user_id, "user_id": new_user_id,
        "parent_user_id": placement_parent_id, "placement_side": placement_side,
        "path": new_path, "depth": parent_depth + 1,
        "left_child_id": None, "right_child_id": None,
        "left_count": 0, "right_count": 0, "matched_pairs": 0,
        "created_at": _now_iso(),
    }
    await tree_nodes().insert_one(new_node)
    update_field = "left_child_id" if placement_side == "LEFT" else "right_child_id"
    await tree_nodes().update_one(
        {"_id": placement_parent_id, update_field: None},
        {"$set": {update_field: new_user_id}},
    )
    return new_node


async def create_root_node(user_id: str):
    if await get_node(user_id):
        return
    await tree_nodes().insert_one({
        "_id": user_id, "user_id": user_id,
        "parent_user_id": None, "placement_side": None,
        "path": "", "depth": 0,
        "left_child_id": None, "right_child_id": None,
        "left_count": 0, "right_count": 0, "matched_pairs": 0,
        "created_at": _now_iso(),
    })


async def update_ancestor_counts_and_create_matching(new_user_id: str, order_id: str):
    """Walk up: increment counts, and create MATCHING_INCOME commission for each new matched pair.
    Returns list of created matching commission ids.
    """
    created = []
    cfg = await _get_config("matching_config")
    if not cfg or cfg.get("status") != "active":
        # Still walk counts even if matching is inactive
        cfg = None

    current = await get_node(new_user_id)
    if not current:
        return created
    while current and current.get("parent_user_id"):
        ancestor_id = current["parent_user_id"]
        side = current["placement_side"]
        inc_field = "left_count" if side == "LEFT" else "right_count"
        updated = await tree_nodes().find_one_and_update(
            {"_id": ancestor_id},
            {"$inc": {inc_field: 1}},
            return_document=True,
        )
        if not updated:
            break
        new_matched = min(updated.get("left_count", 0), updated.get("right_count", 0))
        old_matched = updated.get("matched_pairs", 0)
        if new_matched > old_matched:
            await tree_nodes().update_one({"_id": ancestor_id}, {"$set": {"matched_pairs": new_matched}})
            if cfg:
                plan_price = float(cfg.get("plan_price", 54999))
                gross_pct = float(cfg.get("gross_percent", 2.5))
                admin_pct = float(cfg.get("admin_charge_percent", 10))
                rounding = cfg.get("rounding_mode", "two_decimals")
                for pair_num in range(old_matched + 1, new_matched + 1):
                    gross = _round_amount(plan_price * gross_pct / 100.0, rounding)
                    deduction = _round_amount(gross * admin_pct / 100.0, "two_decimals")
                    net = _round_amount(gross - deduction, "two_decimals")
                    doc = {
                        "_id": str(uuid.uuid4()),
                        "commission_type": "MATCHING_INCOME",
                        "beneficiary_user_id": ancestor_id,
                        "triggering_user_id": new_user_id,
                        "order_id": order_id,
                        "matched_pair_number": pair_num,
                        "gross_amount": gross,
                        "admin_charge_percent": admin_pct,
                        "admin_charge_amount": deduction,
                        "net_amount": net,
                        "status": "PENDING",
                        "rule_snapshot": dict(cfg),
                        "created_at": _now_iso(),
                        "approved_at": None,
                        "paid_at": None,
                        "rejected_at": None,
                        "reversed_at": None,
                        "notes": None,
                    }
                    try:
                        await commissions().insert_one(doc)
                        created.append(doc["_id"])
                        await notifications().insert_one({
                            "_id": str(uuid.uuid4()),
                            "user_id": ancestor_id,
                            "audience": "CUSTOMER",
                            "kind": "MATCHING_INCOME_CREATED",
                            "title": "New matching income",
                            "body": f"You earned a matching income of ₹{net:.2f} (net).",
                            "link": "/dashboard/commissions",
                            "read": False,
                            "created_at": _now_iso(),
                        })
                    except Exception:
                        pass
        current = await get_node(ancestor_id)
    return created


async def create_direct_referral_commission(sponsor_id: str, new_user_id: str, order_id: str):
    cfg = await _get_config("direct_referral_config")
    if not cfg or cfg.get("status") != "active":
        return None
    plan_price = float(cfg.get("plan_price", 54999))
    gross_pct = float(cfg.get("gross_percent", 5))
    admin_pct = float(cfg.get("admin_charge_percent", 10))
    rounding = cfg.get("rounding_mode", "two_decimals")
    gross = _round_amount(plan_price * gross_pct / 100.0, rounding)
    deduction = _round_amount(gross * admin_pct / 100.0, "two_decimals")
    net = _round_amount(gross - deduction, "two_decimals")
    doc = {
        "_id": str(uuid.uuid4()),
        "commission_type": "DIRECT_REFERRAL",
        "beneficiary_user_id": sponsor_id,
        "triggering_user_id": new_user_id,
        "order_id": order_id,
        "matched_pair_number": None,
        "gross_amount": gross,
        "admin_charge_percent": admin_pct,
        "admin_charge_amount": deduction,
        "net_amount": net,
        "status": "PENDING",
        "rule_snapshot": dict(cfg),
        "created_at": _now_iso(),
        "approved_at": None, "paid_at": None,
        "rejected_at": None, "reversed_at": None,
        "notes": "Direct referral commission",
    }
    try:
        await commissions().insert_one(doc)
        await notifications().insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": sponsor_id,
            "audience": "CUSTOMER",
            "kind": "DIRECT_REFERRAL_CREATED",
            "title": "New direct referral commission",
            "body": f"You earned ₹{net:.2f} (net) from a successful referral.",
            "link": "/dashboard/commissions",
            "read": False,
            "created_at": _now_iso(),
        })
        return doc
    except Exception:
        return None


async def create_cashback_schedule(user_id: str, order_id: str, activation_date_iso: str) -> int:
    """Generate 10 scheduled cashback installments starting activation_date + 45 days."""
    cfg = await _get_config("cashback_config")
    if not cfg or cfg.get("status") != "active":
        return 0
    plan_price = float(cfg.get("plan_price", 54999))
    gross = float(cfg.get("gross_monthly", 3000))
    admin_pct = float(cfg.get("admin_charge_percent", 10))
    months = int(cfg.get("months", 10))
    delay_days = int(cfg.get("first_payout_delay_days", 45))
    rounding = cfg.get("rounding_mode", "two_decimals")

    activation_dt = datetime.fromisoformat(activation_date_iso)
    first_dt = activation_dt + timedelta(days=delay_days)

    deduction = _round_amount(gross * admin_pct / 100.0, rounding)
    net = _round_amount(gross - deduction, rounding)

    created = 0
    for i in range(1, months + 1):
        scheduled = first_dt + timedelta(days=30 * (i - 1))
        doc = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "order_id": order_id,
            "installment_number": i,
            "scheduled_date": scheduled.isoformat(),
            "gross_amount": gross,
            "admin_charge_percent": admin_pct,
            "admin_charge_amount": deduction,
            "net_amount": net,
            "status": "SCHEDULED",
            "approved_at": None,
            "paid_at": None,
            "notes": None,
            "rule_snapshot": {"plan_price": plan_price, **cfg},
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        try:
            await cashback_schedule().insert_one(doc)
            created += 1
        except Exception:
            pass
    return created


async def get_tree_view(root_user_id: str, max_depth: int = 4):
    async def build(user_id, depth):
        if not user_id or depth > max_depth:
            return None
        node = await get_node(user_id)
        if not node:
            return None
        user = await get_user(user_id)
        left = await build(node.get("left_child_id"), depth + 1) if depth < max_depth else None
        right = await build(node.get("right_child_id"), depth + 1) if depth < max_depth else None
        return {
            "user_id": user_id,
            "user_code": user.get("user_code") if user else None,
            "full_name": user.get("full_name") if user else None,
            "status": user.get("status") if user else None,
            "placement_side": node.get("placement_side"),
            "depth": node.get("depth", 0),
            "left_count": node.get("left_count", 0),
            "right_count": node.get("right_count", 0),
            "matched_pairs": node.get("matched_pairs", 0),
            "has_left": bool(node.get("left_child_id")),
            "has_right": bool(node.get("right_child_id")),
            "left": left,
            "right": right,
        }
    return await build(root_user_id, 0)


async def get_all_descendant_ids(root_user_id: str) -> list:
    from collections import deque
    result = []
    root = await get_node(root_user_id)
    if not root:
        return result
    queue = deque()
    if root.get("left_child_id"):
        queue.append(root["left_child_id"])
    if root.get("right_child_id"):
        queue.append(root["right_child_id"])
    while queue:
        uid = queue.popleft()
        result.append(uid)
        node = await get_node(uid)
        if node:
            if node.get("left_child_id"):
                queue.append(node["left_child_id"])
            if node.get("right_child_id"):
                queue.append(node["right_child_id"])
    return result


async def validate_tree_integrity() -> dict:
    issues = []
    seen = {}
    async for node in tree_nodes().find({}):
        parent = node.get("parent_user_id")
        side = node.get("placement_side")
        if parent:
            key = (parent, side)
            if key in seen:
                issues.append({"type": "duplicate_side_occupancy", "parent": parent, "side": side, "users": [seen[key], node["_id"]]})
            else:
                seen[key] = node["_id"]
            if not await tree_nodes().find_one({"_id": parent}):
                issues.append({"type": "missing_parent", "user_id": node["_id"], "parent": parent})
    return {"ok": len(issues) == 0, "issues": issues}
