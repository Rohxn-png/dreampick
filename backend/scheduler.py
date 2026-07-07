"""Background scheduler for cashback payout status transitions."""
import asyncio
import logging
from datetime import datetime, timezone
from db import cashback_schedule, notifications, users
import uuid

logger = logging.getLogger("dreampick.scheduler")

_task = None


async def _tick():
    """Mark scheduled cashback records DUE when their scheduled_date <= now."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = cashback_schedule().find({"status": "SCHEDULED", "scheduled_date": {"$lte": now}})
    async for rec in cursor:
        await cashback_schedule().update_one(
            {"_id": rec["_id"]},
            {"$set": {"status": "DUE", "updated_at": now}},
        )
        # Notify admins
        admins = await users().find({"role": "ADMIN"}).to_list(50)
        for a in admins:
            await notifications().insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": a["_id"],
                "audience": "ADMIN",
                "kind": "CASHBACK_DUE",
                "title": "Cashback installment due",
                "body": f"Installment #{rec.get('installment_number')} of ₹{rec.get('net_amount')} is due for approval.",
                "link": f"/admin/cashback?id={rec['_id']}",
                "read": False,
                "created_at": now,
            })


async def _loop(interval_seconds: int):
    while True:
        try:
            await _tick()
        except Exception as e:
            logger.exception(f"Scheduler tick failed: {e}")
        await asyncio.sleep(interval_seconds)


def start(interval_minutes: int = 60):
    global _task
    if _task and not _task.done():
        return
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_loop(interval_minutes * 60))
    logger.info(f"Scheduler started, tick every {interval_minutes} minutes.")


def stop():
    global _task
    if _task and not _task.done():
        _task.cancel()
