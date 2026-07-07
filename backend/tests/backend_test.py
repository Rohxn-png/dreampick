"""Backend regression suite — Dreampick v4 (new admin creds, category-based media, 4 chief guests).

Run:
  pytest /app/backend/tests/backend_test.py -v --tb=short \
    --junitxml=/app/test_reports/pytest/pytest_results.xml
"""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set in environment"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "dreampickev@gmail.com"
ADMIN_PASSWORD = "dreampick@123"
OLD_ADMIN_EMAIL = "admin@dreampick.co.in"
OLD_ADMIN_PASSWORD = "Admin@Dreampick2026"
DEFAULT_PWD = "Test@123456"

SINGLE_SLOT = [
    "COMPANY_LOGO", "HERO_SCOOTER", "HERO_BACKGROUND", "ABOUT_US",
    "CHIEF_GUEST_MR_FAZI", "CHIEF_GUEST_VISHAL_MEHARVADE",
    "CHIEF_GUEST_SRINIVAS", "CHIEF_GUEST_HEMANTH_KUMAR",
]
MULTI_SLOT = ["GALLERY_IMAGE", "GALLERY_VIDEO"]

# Small 1x1 PNG bytes
TINY_PNG = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
    "890000000A49444154789C6360000000000200015E9F3A800000000049454E44AE426082"
)


# ---------------- helpers ----------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _rand_email(prefix="tst"):
    return f"TEST_{prefix}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}@dreampick.demo"


def _register(full_name, email=None, phone="+91-9990000001", password=DEFAULT_PWD,
               referral_code=None, placement_side=None):
    email = email or _rand_email()
    body = {"full_name": full_name, "email": email, "phone": phone, "password": password}
    if referral_code:
        body["referral_code"] = referral_code
        body["placement_side"] = placement_side
    r = requests.post(f"{API}/auth/register", json=body, timeout=20)
    r.raise_for_status()
    data = r.json()
    return {"email": email, "password": password, "token": data["access_token"], "user": data["user"]}


def _create_order(token):
    r = requests.post(f"{API}/orders/create", headers=_headers(token), timeout=20)
    r.raise_for_status()
    return r.json()["order"]


def _admin_activate(admin_token, order_id):
    r = requests.patch(f"{API}/admin/orders/{order_id}/activate",
                       headers=_headers(admin_token), timeout=20)
    r.raise_for_status()
    return r.json()


def _upload_media(admin_token, category, filename="test.png", content=None, content_type="image/png"):
    files = {"file": (filename, io.BytesIO(content or TINY_PNG), content_type)}
    data = {"category": category, "display_order": "0", "visible": "true"}
    r = requests.post(f"{API}/admin/media/upload",
                      data=data, files=files,
                      headers={"Authorization": f"Bearer {admin_token}"},
                      timeout=20)
    return r


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


# ---------------- V4 AUTH ----------------
class TestV4Auth:
    def test_new_admin_login_success(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "ADMIN"
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_old_admin_login_fails(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": OLD_ADMIN_EMAIL, "password": OLD_ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 401, f"Old admin should NOT log in but got {r.status_code}"

    def test_new_admin_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401


# ---------------- HEALTH & PUBLIC CONFIG ----------------
class TestHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_config_dreampick_branding(self):
        r = requests.get(f"{API}/config", timeout=15)
        d = r.json()
        assert d["company_name"] == "Dreampick Private Limited"
        assert d["gst_number"] == "29AAMCD4327L1Z6"
        assert float(d["plan_price"]) == 54999


# ---------------- V4 MEDIA (category-based) ----------------
class TestMediaCategories:
    def _cleanup(self, admin_token, category):
        docs = requests.get(f"{API}/admin/media?category={category}",
                            headers=_headers(admin_token), timeout=15).json()["media"]
        for d in docs:
            requests.delete(f"{API}/admin/media/{d['_id']}",
                            headers=_headers(admin_token), timeout=15)

    def test_upload_company_logo_single_slot(self, admin_token):
        self._cleanup(admin_token, "COMPANY_LOGO")
        r = _upload_media(admin_token, "COMPANY_LOGO", filename="logo1.png")
        assert r.status_code == 200, r.text
        m = r.json()["media"]
        assert m["category"] == "COMPANY_LOGO"
        assert m["media_type"] == "image"
        first_id = m["_id"]
        first_filename = m["filename"]

        # Second upload should REPLACE the first
        r2 = _upload_media(admin_token, "COMPANY_LOGO", filename="logo2.png")
        assert r2.status_code == 200
        m2 = r2.json()["media"]
        assert m2["_id"] != first_id

        # Verify only one COMPANY_LOGO now
        docs = requests.get(f"{API}/admin/media?category=COMPANY_LOGO",
                            headers=_headers(admin_token), timeout=15).json()["media"]
        assert len(docs) == 1
        assert docs[0]["_id"] == m2["_id"]

        # File for the first logo should be removed
        # Public media check via /api/media/{filename}
        get_old = requests.get(f"{API}/media/{first_filename}", timeout=15)
        assert get_old.status_code == 404, "Old file should be deleted from disk"

        # Cleanup
        self._cleanup(admin_token, "COMPANY_LOGO")

    def test_upload_invalid_category_400(self, admin_token):
        files = {"file": ("test.png", io.BytesIO(TINY_PNG), "image/png")}
        data = {"category": "NOT_A_REAL_CATEGORY"}
        r = requests.post(f"{API}/admin/media/upload",
                          data=data, files=files,
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=20)
        assert r.status_code == 400

    def test_gallery_image_multi_slot(self, admin_token):
        self._cleanup(admin_token, "GALLERY_IMAGE")
        r1 = _upload_media(admin_token, "GALLERY_IMAGE", filename="g1.png")
        assert r1.status_code == 200
        r2 = _upload_media(admin_token, "GALLERY_IMAGE", filename="g2.png")
        assert r2.status_code == 200
        r3 = _upload_media(admin_token, "GALLERY_IMAGE", filename="g3.png")
        assert r3.status_code == 200
        docs = requests.get(f"{API}/admin/media?category=GALLERY_IMAGE",
                            headers=_headers(admin_token), timeout=15).json()["media"]
        assert len(docs) >= 3
        self._cleanup(admin_token, "GALLERY_IMAGE")

    def test_public_media_by_category_no_leakage(self, admin_token):
        # Clean 4 chief guest slots
        for cat in ("CHIEF_GUEST_MR_FAZI", "CHIEF_GUEST_VISHAL_MEHARVADE",
                    "CHIEF_GUEST_SRINIVAS", "CHIEF_GUEST_HEMANTH_KUMAR"):
            self._cleanup(admin_token, cat)

        # Upload only to MR_FAZI
        r = _upload_media(admin_token, "CHIEF_GUEST_MR_FAZI", filename="fazi.png")
        assert r.status_code == 200
        fazi_id = r.json()["media"]["_id"]

        # Public GET by category=CHIEF_GUEST_MR_FAZI returns just Fazi
        pl = requests.get(f"{API}/media?category=CHIEF_GUEST_MR_FAZI", timeout=15)
        assert pl.status_code == 200
        docs = pl.json()["media"]
        assert len(docs) == 1
        assert docs[0]["_id"] == fazi_id
        assert docs[0]["category"] == "CHIEF_GUEST_MR_FAZI"

        # Other chief guest categories are empty
        for cat in ("CHIEF_GUEST_VISHAL_MEHARVADE", "CHIEF_GUEST_SRINIVAS", "CHIEF_GUEST_HEMANTH_KUMAR"):
            pl2 = requests.get(f"{API}/media?category={cat}", timeout=15)
            assert pl2.json()["media"] == [], f"Leakage into {cat}"

        # Delete media by id: file and doc removed
        del_r = requests.delete(f"{API}/admin/media/{fazi_id}",
                                headers=_headers(admin_token), timeout=15)
        assert del_r.status_code == 200
        # No public media for Fazi anymore
        pl3 = requests.get(f"{API}/media?category=CHIEF_GUEST_MR_FAZI", timeout=15)
        assert pl3.json()["media"] == []

    def test_public_media_logo_returns_only_current(self, admin_token):
        self._cleanup(admin_token, "COMPANY_LOGO")
        r = _upload_media(admin_token, "COMPANY_LOGO", filename="cur.png")
        assert r.status_code == 200
        mid = r.json()["media"]["_id"]
        pl = requests.get(f"{API}/media?category=COMPANY_LOGO", timeout=15)
        docs = pl.json()["media"]
        assert len(docs) == 1
        assert docs[0]["_id"] == mid
        self._cleanup(admin_token, "COMPANY_LOGO")

    def test_delete_media_removes_file(self, admin_token):
        r = _upload_media(admin_token, "ABOUT_US", filename="about.png")
        assert r.status_code == 200
        m = r.json()["media"]
        filename = m["filename"]
        # File should exist via /api/media/{filename}
        f_get = requests.get(f"{API}/media/{filename}", timeout=15)
        assert f_get.status_code == 200
        # Delete
        del_r = requests.delete(f"{API}/admin/media/{m['_id']}",
                                headers=_headers(admin_token), timeout=15)
        assert del_r.status_code == 200
        # File gone from disk
        f_get2 = requests.get(f"{API}/media/{filename}", timeout=15)
        assert f_get2.status_code == 404


# ---------------- PREVIOUSLY WORKING FLOWS (regression) ----------------
class TestRegistrationAndActivation:
    def test_register_creates_pending_customer(self):
        email = _rand_email("noref")
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "QA V4 NoRef", "email": email,
            "phone": "+91-9990001111", "password": DEFAULT_PWD,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "CUSTOMER"
        assert d["user"]["status"] == "PENDING"
        assert "access_token" in d

    def test_create_order_pending(self):
        reg = _register("QA V4 Ord")
        o = _create_order(reg["token"])
        assert o["payment_status"] == "PAYMENT_PENDING"
        assert float(o["amount"]) == 54999

    def test_activate_creates_cashback(self, admin_token):
        reg = _register("QA V4 Act")
        o = _create_order(reg["token"])
        _admin_activate(admin_token, o["_id"])
        cb = requests.get(f"{API}/customer/cashback",
                          headers=_headers(reg["token"]), timeout=15).json()
        assert len(cb["cashback_schedule"]) == 10


class TestListEndpoints:
    def test_admin_dashboard(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d
        assert "cashback_totals" in d
        assert "direct_referral_totals" in d
        assert "matching_income_totals" in d

    def test_admin_commissions_list(self, admin_token):
        r = requests.get(f"{API}/admin/commissions",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert "commissions" in r.json()

    def test_admin_cashback_list(self, admin_token):
        r = requests.get(f"{API}/admin/cashback",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert "cashback_schedule" in r.json()

    def test_admin_withdrawals_list(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert "withdrawal_requests" in r.json()

    def test_admin_users_no_password_hash(self, admin_token):
        r = requests.get(f"{API}/admin/users",
                         headers=_headers(admin_token), timeout=15)
        for u in r.json()["users"]:
            assert "password_hash" not in u
            assert u["role"] != "SUPER_ADMIN"


class TestBankReveal:
    def test_reveal_with_reason(self, admin_token):
        reg = _register("QA V4 Reveal")
        payload = {"account_holder": "QA V4 Reveal", "account_number": "1234567890123456",
                   "ifsc": "icic0000222", "bank_name": "ICICI"}
        bar = requests.post(f"{API}/customer/bank-accounts", json=payload,
                            headers=_headers(reg["token"]), timeout=15).json()["bank_account"]
        # Reason required
        r_no = requests.post(f"{API}/admin/users/{reg['user']['_id']}/bank-details/reveal",
                             json={"bank_account_id": bar["_id"], "reason": ""},
                             headers=_headers(admin_token), timeout=15)
        assert r_no.status_code == 400
        r_ok = requests.post(f"{API}/admin/users/{reg['user']['_id']}/bank-details/reveal",
                             json={"bank_account_id": bar["_id"], "reason": "Payout verification"},
                             headers=_headers(admin_token), timeout=15)
        assert r_ok.status_code == 200
        assert r_ok.json()["bank_details"]["account_number"] == payload["account_number"]
