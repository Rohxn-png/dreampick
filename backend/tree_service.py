"""Binary tree placement, ancestor counting, and commission generation."""
import os
import uuid
from datetime import datetime, timezone
from db import tree_nodes, users, commissions


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_node(user_id: str):
    return await tree_nodes().find_one({"_id": user_id})


async def get_user(user_id: str):
    return await users().find_one({"_id": user_id})


async def _find_first_available_slot(branch_root_user_id: str):
    """BFS in the subtree of branch_root_user_id to find the shallowest node with an empty child slot.
    Returns (parent_user_id, placement_side).
    """
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
    """Return placement preview info without persisting."""
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
        placement_parent_id = referrer_id
        placement_side = selected_side
        expected_depth = (ref_node.get("depth", 0) if ref_node else 0) + 1
    else:
        branch_root_id = ref_node[child_key]
        slot = await _find_first_available_slot(branch_root_id)
        if not slot:
            # Should not happen for a well-formed tree, but fall back
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


async def finalize_placement(new_user_id: str, referrer_id: str, selected_side: str) -> dict:
    """Insert the new user into the tree and update ancestor counters.
    Returns the new tree node dict.
    """
    if selected_side not in ("LEFT", "RIGHT"):
        raise ValueError("selected_side must be LEFT or RIGHT")

    existing = await get_node(new_user_id)
    if existing:
        return existing  # idempotent

    ref_node = await get_node(referrer_id)
    if not ref_node:
        # Referrer must be in tree (i.e., ACTIVE) to place under them
        raise ValueError("Referrer is not placed in tree yet")

    child_key = "left_child_id" if selected_side == "LEFT" else "right_child_id"
    if not ref_node.get(child_key):
        placement_parent_id = referrer_id
        placement_side = selected_side
    else:
        slot = await _find_first_available_slot(ref_node[child_key])
        if not slot:
            raise ValueError("No available slot found in selected branch")
        placement_parent_id, placement_side = slot

    parent_node = await get_node(placement_parent_id)
    parent_path = parent_node.get("path", "")
    parent_depth = parent_node.get("depth", 0)
    step = "L" if placement_side == "LEFT" else "R"
    new_path = parent_path + step if parent_path else step
    new_depth = parent_depth + 1

    new_node = {
        "_id": new_user_id,
        "user_id": new_user_id,
        "parent_user_id": placement_parent_id,
        "placement_side": placement_side,
        "path": new_path,
        "depth": new_depth,
        "left_child_id": None,
        "right_child_id": None,
        "left_count": 0,
        "right_count": 0,
        "matched_pairs": 0,
        "created_at": _now_iso(),
    }
    await tree_nodes().insert_one(new_node)

    # Attach to parent
    update_field = "left_child_id" if placement_side == "LEFT" else "right_child_id"
    await tree_nodes().update_one(
        {"_id": placement_parent_id, update_field: None},
        {"$set": {update_field: new_user_id}},
    )

    return new_node


async def update_ancestor_counts(new_user_id: str) -> None:
    """Walk from new user upward, updating left/right counts and matched_pairs (for display only)."""
    current = await get_node(new_user_id)
    if not current:
        return
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
        if new_matched > updated.get("matched_pairs", 0):
            await tree_nodes().update_one(
                {"_id": ancestor_id},
                {"$set": {"matched_pairs": new_matched}},
            )
        current = await get_node(ancestor_id)


async def create_sponsor_commission(sponsor_id: str, new_user_id: str, order_id: str, amount: float):
    """Create a PENDING commission of `amount` for the direct sponsor when a referred user activates.
    Idempotent per (beneficiary_user_id, triggering_user_id) via unique index.
    """
    doc = {
        "_id": str(uuid.uuid4()),
        "beneficiary_user_id": sponsor_id,
        "triggering_user_id": new_user_id,
        "order_id": order_id,
        "matched_pair_number": 1,  # legacy field; retained for schema compatibility
        "amount": amount,
        "status": "PENDING",
        "created_at": _now_iso(),
        "approved_at": None,
        "paid_at": None,
        "rejected_at": None,
        "reversed_at": None,
        "notes": "Direct referral commission",
    }
    try:
        await commissions().insert_one(doc)
        return doc
    except Exception:
        # Duplicate — already created
        return None


async def get_tree_view(root_user_id: str, max_depth: int = 4):
    """Return a nested tree structure up to max_depth."""
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
    """Return list of user ids in the subtree rooted at root_user_id (excluding root)."""
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
    """Basic integrity checks: duplicate side occupancy, missing parents."""
    issues = []
    seen_positions = {}  # (parent, side) -> user_id
    cursor = tree_nodes().find({})
    async for node in cursor:
        parent = node.get("parent_user_id")
        side = node.get("placement_side")
        if parent:
            key = (parent, side)
            if key in seen_positions:
                issues.append({
                    "type": "duplicate_side_occupancy",
                    "parent_user_id": parent,
                    "side": side,
                    "user_ids": [seen_positions[key], node["_id"]],
                })
            else:
                seen_positions[key] = node["_id"]
            parent_node = await tree_nodes().find_one({"_id": parent})
            if not parent_node:
                issues.append({
                    "type": "missing_parent",
                    "user_id": node["_id"],
                    "parent_user_id": parent,
                })
    return {"ok": len(issues) == 0, "issues": issues}
