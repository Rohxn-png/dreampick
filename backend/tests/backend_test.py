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
    "COMPANY_MD_PHOTO", "CO_DIRECTOR_PHOTO",
    "COMPANY_LICENSE_1", "COMPANY_LICENSE_2", "COMPANY_LICENSE_3",
    "COMPANY_LICENSE_4", "COMPANY_LICENSE_5", "COMPANY_LICENSE_6",
]
MULTI_SLOT = ["GALLERY_IMAGE", "GALLERY_VIDEO"]

# Minimal valid PDF bytes
TINY_PDF = (
    b"%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
    b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
    b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n"
    b"0000000060 00000 n \n0000000110 00000 n \n"
    b"trailer<< /Size 4 /Root 1 0 R >>\nstartxref\n170\n%%EOF\n"
)

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


# ============================================================
# V5 TESTS — Production reset + Leadership + License categories
# ============================================================


def _upload_media_raw(admin_token, category, filename, content, content_type, **extra_data):
    files = {"file": (filename, io.BytesIO(content), content_type)}
    data = {"category": category, "display_order": "0", "visible": "true"}
    data.update({k: v for k, v in extra_data.items() if v is not None})
    return requests.post(
        f"{API}/admin/media/upload",
        data=data, files=files,
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )


class TestV5LeadershipMedia:
    """MD & Co-Director single-slot categories."""

    def _cleanup(self, tok, cat):
        docs = requests.get(f"{API}/admin/media?category={cat}",
                            headers=_headers(tok), timeout=15).json()["media"]
        for d in docs:
            requests.delete(f"{API}/admin/media/{d['_id']}", headers=_headers(tok), timeout=15)

    def test_md_photo_upload_and_replace(self, admin_token):
        self._cleanup(admin_token, "COMPANY_MD_PHOTO")
        r1 = _upload_media(admin_token, "COMPANY_MD_PHOTO", filename="md1.png")
        assert r1.status_code == 200, r1.text
        first = r1.json()["media"]
        assert first["media_type"] == "image"
        assert first["category"] == "COMPANY_MD_PHOTO"

        r2 = _upload_media(admin_token, "COMPANY_MD_PHOTO", filename="md2.png")
        assert r2.status_code == 200
        second = r2.json()["media"]
        assert second["_id"] != first["_id"]

        docs = requests.get(f"{API}/admin/media?category=COMPANY_MD_PHOTO",
                            headers=_headers(admin_token), timeout=15).json()["media"]
        assert len(docs) == 1
        # Public GET
        pub = requests.get(f"{API}/media?category=COMPANY_MD_PHOTO", timeout=15).json()["media"]
        assert len(pub) == 1
        self._cleanup(admin_token, "COMPANY_MD_PHOTO")

    def test_co_director_photo_upload(self, admin_token):
        self._cleanup(admin_token, "CO_DIRECTOR_PHOTO")
        r = _upload_media(admin_token, "CO_DIRECTOR_PHOTO", filename="cd.png")
        assert r.status_code == 200
        assert r.json()["media"]["category"] == "CO_DIRECTOR_PHOTO"
        self._cleanup(admin_token, "CO_DIRECTOR_PHOTO")


class TestV5LicenseMedia:
    """COMPANY_LICENSE_1..6 with PDF/image support + metadata."""

    def _cleanup(self, tok, cat):
        docs = requests.get(f"{API}/admin/media?category={cat}",
                            headers=_headers(tok), timeout=15).json()["media"]
        for d in docs:
            requests.delete(f"{API}/admin/media/{d['_id']}", headers=_headers(tok), timeout=15)

    def test_license_image_upload_with_metadata(self, admin_token):
        self._cleanup(admin_token, "COMPANY_LICENSE_1")
        r = _upload_media_raw(
            admin_token, "COMPANY_LICENSE_1",
            "gst.png", TINY_PNG, "image/png",
            title="GST Certificate",
            description="Registered under GSTIN 29AAMCD4327L1Z6",
            issue_date="2024-01-15",
            expiry_date="2029-01-15",
        )
        assert r.status_code == 200, r.text
        m = r.json()["media"]
        assert m["media_type"] == "image"
        assert m["title"] == "GST Certificate"
        assert m["description"] == "Registered under GSTIN 29AAMCD4327L1Z6"
        assert m["issue_date"] == "2024-01-15"
        assert m["expiry_date"] == "2029-01-15"
        # Public GET returns metadata too
        pub = requests.get(f"{API}/media?category=COMPANY_LICENSE_1", timeout=15).json()["media"]
        assert len(pub) == 1
        assert pub[0]["title"] == "GST Certificate"
        assert pub[0]["issue_date"] == "2024-01-15"
        assert pub[0]["expiry_date"] == "2029-01-15"
        self._cleanup(admin_token, "COMPANY_LICENSE_1")

    def test_license_pdf_upload(self, admin_token):
        self._cleanup(admin_token, "COMPANY_LICENSE_2")
        r = _upload_media_raw(
            admin_token, "COMPANY_LICENSE_2",
            "incorporation.pdf", TINY_PDF, "application/pdf",
            title="Certificate of Incorporation",
            description="MCA issued certificate",
        )
        assert r.status_code == 200, r.text
        m = r.json()["media"]
        assert m["media_type"] == "pdf"
        assert m["filename"].endswith(".pdf")
        # Serves as PDF
        pdf_get = requests.get(f"{API}/media/{m['filename']}", timeout=15)
        assert pdf_get.status_code == 200
        self._cleanup(admin_token, "COMPANY_LICENSE_2")

    def test_license_rejects_mp4(self, admin_token):
        r = _upload_media_raw(
            admin_token, "COMPANY_LICENSE_3",
            "bad.mp4", b"\x00" * 32, "video/mp4",
        )
        assert r.status_code == 400
        assert "Unsupported" in r.text or "type" in r.text.lower()

    def test_license_single_slot_replace(self, admin_token):
        self._cleanup(admin_token, "COMPANY_LICENSE_4")
        r1 = _upload_media_raw(
            admin_token, "COMPANY_LICENSE_4",
            "a.png", TINY_PNG, "image/png", title="First",
        )
        assert r1.status_code == 200
        old_id = r1.json()["media"]["_id"]
        old_filename = r1.json()["media"]["filename"]

        r2 = _upload_media_raw(
            admin_token, "COMPANY_LICENSE_4",
            "b.pdf", TINY_PDF, "application/pdf", title="Second",
        )
        assert r2.status_code == 200
        new_id = r2.json()["media"]["_id"]
        assert new_id != old_id

        docs = requests.get(f"{API}/admin/media?category=COMPANY_LICENSE_4",
                            headers=_headers(admin_token), timeout=15).json()["media"]
        assert len(docs) == 1
        assert docs[0]["_id"] == new_id
        assert docs[0]["title"] == "Second"
        # Old file removed from disk
        old_check = requests.get(f"{API}/media/{old_filename}", timeout=15)
        assert old_check.status_code == 404
        self._cleanup(admin_token, "COMPANY_LICENSE_4")

    def test_all_six_license_slots_exist(self, admin_token):
        for i in range(1, 7):
            cat = f"COMPANY_LICENSE_{i}"
            r = _upload_media_raw(admin_token, cat, f"l{i}.png", TINY_PNG, "image/png")
            assert r.status_code == 200, f"{cat}: {r.text}"
            # cleanup
            mid = r.json()["media"]["_id"]
            requests.delete(f"{API}/admin/media/{mid}", headers=_headers(admin_token), timeout=15)


class TestV5AuthOnMediaAndReset:
    def test_media_upload_requires_admin(self):
        # No token
        r = _upload_media(None, "COMPANY_LOGO")
        assert r.status_code in (401, 403)

    def test_reset_requires_admin(self):
        r = requests.post(f"{API}/admin/reset-production-data",
                          json={"confirm": "RESET_ALL_CUSTOMER_DATA"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_reset_wrong_confirm(self, admin_token):
        r = requests.post(f"{API}/admin/reset-production-data",
                          headers=_headers(admin_token),
                          json={"confirm": "WRONG_PHRASE"}, timeout=15)
        assert r.status_code == 400
        assert "Confirmation" in r.text or "mismatch" in r.text.lower()


# NOTE: The reset test is placed last so it does not interfere with other tests in this session.
# It seeds a customer + order, then wipes; then verifies admin can log back in and DB is clean.
class TestV5ResetProductionDataZZZLast:

    def test_reset_wipes_data_preserves_admin_and_media(self, admin_token):
        # 1) Seed some data
        reg = _register("QA V5 ResetSeed")
        o = _create_order(reg["token"])
        _admin_activate(admin_token, o["_id"])

        # Add a media asset (preserve_media=true should keep it)
        r_up = _upload_media(admin_token, "COMPANY_LOGO", filename="preserved.png")
        assert r_up.status_code == 200
        media_id = r_up.json()["media"]["_id"]

        # 2) Confirm data > 0 before reset
        pre_users = requests.get(f"{API}/admin/users",
                                 headers=_headers(admin_token), timeout=15).json()["users"]
        assert any(u["email"] != ADMIN_EMAIL for u in pre_users), "expected at least one non-admin user"

        # 3) Fire reset with preserve_media=true
        rr = requests.post(f"{API}/admin/reset-production-data",
                           headers=_headers(admin_token),
                           json={"confirm": "RESET_ALL_CUSTOMER_DATA", "preserve_media": True},
                           timeout=60)
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body.get("success") is True
        assert body.get("preserved_admin_email") == ADMIN_EMAIL
        counts = body.get("counts", {})
        # Basic shape check
        for k in ("users_deleted", "orders_deleted", "commissions_deleted",
                  "cashback_schedule_deleted", "tree_nodes_deleted",
                  "wallet_transactions_deleted", "notifications_deleted",
                  "audit_logs_deleted"):
            assert k in counts, f"missing count key {k}"
        assert counts["users_deleted"] >= 1
        assert counts["media_assets_deleted"] == 0  # preserve_media=true

        # 4) Admin can still log back in (proves admin doc preserved)
        tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert tok

        # 5) All customers wiped (admin/users lists only CUSTOMER role → empty)
        users_after = requests.get(f"{API}/admin/users",
                                   headers=_headers(tok), timeout=15).json()["users"]
        assert users_after == [], f"Expected no customers, got {len(users_after)}"

        # Admin dashboard renders OK with zero data
        dash = requests.get(f"{API}/admin/dashboard",
                            headers=_headers(tok), timeout=15).json()
        assert dash["totals"]["total_users"] == 0
        assert dash["totals"]["active_users"] == 0
        assert dash["totals"]["total_orders"] == 0
        # All commission/cashback buckets are zero after reset
        assert all(v == 0 for v in dash["direct_referral_totals"].values())
        assert all(v == 0 for v in dash["matching_income_totals"].values())
        assert all(v == 0 for v in dash["cashback_totals"].values())

        # Media is preserved
        media_after = requests.get(f"{API}/admin/media?category=COMPANY_LOGO",
                                   headers=_headers(tok), timeout=15).json()["media"]
        assert any(m["_id"] == media_id for m in media_after), "COMPANY_LOGO media should be preserved"

        # Cleanup the seeded media
        requests.delete(f"{API}/admin/media/{media_id}", headers=_headers(tok), timeout=15)
