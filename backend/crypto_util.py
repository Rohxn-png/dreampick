"""Symmetric encryption for sensitive fields (bank account numbers, UPI IDs)."""
import os
from cryptography.fernet import Fernet, InvalidToken

_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = os.environ["BANK_ENCRYPTION_KEY"].encode()
        _fernet = Fernet(key)
    return _fernet


def encrypt_str(plain: str | None) -> str | None:
    if plain is None or plain == "":
        return None
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_str(cipher: str | None) -> str | None:
    if not cipher:
        return None
    try:
        return _get_fernet().decrypt(cipher.encode()).decode()
    except InvalidToken:
        return None


def mask_account(num: str | None) -> str:
    if not num:
        return "****"
    n = num.strip()
    if len(n) < 4:
        return "*" * len(n)
    return "X" * (len(n) - 4) + n[-4:]
