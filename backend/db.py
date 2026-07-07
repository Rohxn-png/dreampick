"""MongoDB connection and collection accessors."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

_client = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[os.environ["DB_NAME"]]
    return _db


# Collection getters -- consistent access across app
def users():
    return get_db().users


def tree_nodes():
    return get_db().tree_nodes


def scooters():
    return get_db().scooters


def orders():
    return get_db().orders


def commissions():
    return get_db().commissions


def wallet_transactions():
    return get_db().wallet_transactions


def withdrawal_requests():
    return get_db().withdrawal_requests


def bank_accounts():
    return get_db().bank_accounts


def audit_logs():
    return get_db().audit_logs


def system_settings():
    return get_db().system_settings


def cashback_schedule():
    return get_db().cashback_schedule


def notifications():
    return get_db().notifications


def media_assets():
    return get_db().media_assets


def password_reset_tokens():
    return get_db().password_reset_tokens


def payout_receipts():
    return get_db().payout_receipts


def bank_reveal_sessions():
    return get_db().bank_reveal_sessions


def counters():
    return get_db().counters


async def next_sequence(name: str) -> int:
    """Atomically get next value for a named sequence."""
    doc = await counters().find_one_and_update(
        {"_id": name},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    return doc["value"]
