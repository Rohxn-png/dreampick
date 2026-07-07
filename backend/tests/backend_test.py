"""Backend regression suite — Dreampick v3 (activation flow, three commission types,
secure bank reveal, plan PDF, password flows, audit logs).

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

ADMIN_EMAIL = "admin@dreampick.co.in"
ADMIN_PASSWORD = "Admin@Dreampick2026"
DEFAULT_PWD = "Test@123456"


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


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def root_active_customer(admin_token):
    """A registered + activated customer to be used as a sponsor in later tests.
    Uses referral_code=None -> becomes a root node."""
    reg = _register("QA Root Sponsor")
    order = _create_order(reg["token"])
    _admin_activate(admin_token, order["_id"])
    # refresh referral code from /auth/me
    me = requests.get(f"{API}/auth/me", headers=_headers(reg["token"]), timeout=15).json()["user"]
    reg["referral_code"] = me["referral_code"]
    reg["_id"] = me["_id"]
    reg["user"] = me
    return reg


# ---------------- HEALTH ----------------
class TestHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------- PUBLIC CONFIG / PLANS / PDF ----------------
class TestPublicConfig:
    def test_config_has_dreampick_branding(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["company_name"] == "Dreampick Private Limited"
        assert d["gst_number"] == "29AAMCD4327L1Z6"
        assert float(d["plan_price"]) == 54999

    def test_plans_has_three_commission_configs(self):
        r = requests.get(f"{API}/plans", timeout=15)
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert len(plans) == 1
        p = plans[0]
        assert p["name"] == "Basic EV Scooter Plan"
        assert float(p["price"]) == 54999
        assert "features" in p and len(p["features"]) >= 1
        assert "terms" in p and len(p["terms"]) >= 3
        # three commission configs
        for key in ("cashback", "direct_referral", "matching_income"):
            assert key in p
            assert p[key], f"empty {key} config"
        # verify default cashback economics
        cb = p["cashback"]
        assert float(cb["gross_monthly"]) == 3000
        assert int(cb["months"]) == 10
        dr = p["direct_referral"]
        assert float(dr["gross_percent"]) == 5
        m = p["matching_income"]
        assert float(m["gross_percent"]) == 2.5

    def test_plans_pdf_download(self):
        r = requests.get(f"{API}/plans/pdf", timeout=30)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "").lower()
        assert len(r.content) > 2048
        assert r.content[:4] == b"%PDF"


# ---------------- AUTH: LOGIN / REGISTER ----------------
class TestAuthLogin:
    def test_admin_login_success(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "ADMIN"
        assert "password_hash" not in u

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": "wrong-password"}, timeout=15)
        assert r.status_code == 401

    def test_no_super_admin_role_exists(self, admin_token):
        # Both admin users list and public login should show no SUPER_ADMIN
        r = requests.get(f"{API}/admin/users", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u["role"] != "SUPER_ADMIN"

    def test_only_one_admin_and_no_demo_customers(self, admin_token):
        # Admin users are excluded from /admin/users (only role=CUSTOMER shown)
        r = requests.get(f"{API}/admin/users", headers=_headers(admin_token), timeout=15)
        users = r.json()["users"]
        # There should be no demo seed users like customer1@dreampick.demo
        for u in users:
            assert not u["email"].startswith("customer") or "@dreampick.demo" not in u["email"], \
                f"Demo customer found: {u['email']}"
            assert u["email"] != "superadmin@dreampick.demo"


class TestAuthRegister:
    def test_register_creates_pending_customer_no_referral(self):
        email = _rand_email("noref")
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "QA NoRef", "email": email,
            "phone": "+91-9990001111", "password": DEFAULT_PWD,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "CUSTOMER"
        assert d["user"]["status"] == "PENDING"
        assert d["user"]["sponsor_user_id"] is None
        assert "access_token" in d
        assert "password_hash" not in d["user"]

    def test_register_with_valid_referral_stores_sponsor_and_side(self, root_active_customer):
        email = _rand_email("wref")
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "QA WithRef", "email": email,
            "phone": "+91-9990002222", "password": DEFAULT_PWD,
            "referral_code": root_active_customer["referral_code"],
            "placement_side": "LEFT",
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["sponsor_user_id"] == root_active_customer["_id"]
        assert d["user"]["placement_side_selected"] == "LEFT"

    def test_register_duplicate_email_409(self):
        email = _rand_email("dup")
        requests.post(f"{API}/auth/register", json={
            "full_name": "QA Dup", "email": email,
            "phone": "+91-9990003333", "password": DEFAULT_PWD,
        }, timeout=15)
        r2 = requests.post(f"{API}/auth/register", json={
            "full_name": "QA Dup2", "email": email,
            "phone": "+91-9990003333", "password": DEFAULT_PWD,
        }, timeout=15)
        assert r2.status_code == 409


# ---------------- AUTH: FORGOT / RESET / CHANGE ----------------
class TestPasswordFlows:
    def test_forgot_and_reset_password(self):
        reg = _register("QA Pw")
        fp = requests.post(f"{API}/auth/forgot-password", json={"email": reg["email"]}, timeout=15)
        assert fp.status_code == 200
        token = fp.json()["reset_token"]
        assert token
        new_pwd = "NewPwd@456"
        rp = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": new_pwd}, timeout=15)
        assert rp.status_code == 200
        # Login with new password
        lg = requests.post(f"{API}/auth/login",
                           json={"email": reg["email"], "password": new_pwd}, timeout=15)
        assert lg.status_code == 200
        # Old password no longer works
        lg2 = requests.post(f"{API}/auth/login",
                            json={"email": reg["email"], "password": DEFAULT_PWD}, timeout=15)
        assert lg2.status_code == 401

    def test_change_password_correct_and_wrong(self):
        reg = _register("QA Chg")
        # wrong current password
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "nope", "new_password": "NewPw@111"},
                          headers=_headers(reg["token"]), timeout=15)
        assert r.status_code == 401
        # correct
        r2 = requests.post(f"{API}/auth/change-password",
                           json={"current_password": DEFAULT_PWD, "new_password": "NewPw@222"},
                           headers=_headers(reg["token"]), timeout=15)
        assert r2.status_code == 200
        # login using new
        lg = requests.post(f"{API}/auth/login",
                           json={"email": reg["email"], "password": "NewPw@222"}, timeout=15)
        assert lg.status_code == 200


# ---------------- ORDER + ACTIVATION FLOW ----------------
class TestOrderActivation:
    def test_create_order_is_payment_pending(self):
        reg = _register("QA OrdPend")
        o = _create_order(reg["token"])
        assert o["payment_status"] == "PAYMENT_PENDING"
        assert float(o["amount"]) == 54999

    def test_activate_creates_cashback_and_direct_referral_commission(self, admin_token, root_active_customer):
        # register customer under sponsor
        reg = _register("QA Act1", referral_code=root_active_customer["referral_code"], placement_side="RIGHT")
        order = _create_order(reg["token"])
        # activate
        _admin_activate(admin_token, order["_id"])

        # 10 cashback installments created
        cb = requests.get(f"{API}/customer/cashback", headers=_headers(reg["token"]), timeout=15).json()
        rows = cb["cashback_schedule"]
        assert len(rows) == 10
        # first installment gross/deduction/net
        assert float(rows[0]["gross_amount"]) == 3000
        assert float(rows[0]["admin_charge_amount"]) == 300
        assert float(rows[0]["net_amount"]) == 2700

        # direct referral commission for sponsor
        allc = requests.get(f"{API}/admin/commissions?commission_type=DIRECT_REFERRAL",
                            headers=_headers(admin_token), timeout=15).json()["commissions"]
        matches = [c for c in allc
                   if c["beneficiary_user_id"] == root_active_customer["_id"]
                   and c["triggering_user_id"] == reg["user"]["_id"]]
        assert len(matches) == 1
        c = matches[0]
        assert float(c["gross_amount"]) == 2750
        assert float(c["admin_charge_amount"]) == 275
        assert float(c["net_amount"]) == 2475

        # activated order state
        o = requests.get(f"{API}/admin/orders", headers=_headers(admin_token), timeout=15).json()["orders"]
        this = next(x for x in o if x["_id"] == order["_id"])
        assert this["payment_status"] == "ACTIVATED"

    def test_cashback_schedule_idempotent(self, admin_token, root_active_customer):
        reg = _register("QA Idem", referral_code=root_active_customer["referral_code"], placement_side="LEFT")
        order = _create_order(reg["token"])
        _admin_activate(admin_token, order["_id"])
        # activate again - should be no-op
        _admin_activate(admin_token, order["_id"])
        cb = requests.get(f"{API}/customer/cashback", headers=_headers(reg["token"]), timeout=15).json()
        assert len(cb["cashback_schedule"]) == 10

    def test_multiple_directs_produce_multiple_commissions(self, admin_token, root_active_customer):
        # Establish 2 separate direct referrals under root sponsor
        pre_c = requests.get(f"{API}/admin/commissions?commission_type=DIRECT_REFERRAL",
                             headers=_headers(admin_token), timeout=15).json()["commissions"]
        pre_count = sum(1 for c in pre_c if c["beneficiary_user_id"] == root_active_customer["_id"])

        made = 0
        # register 2 more - use alternating sides
        for side in ("LEFT", "RIGHT"):
            reg = _register(f"QA Dir_{side}", referral_code=root_active_customer["referral_code"],
                             placement_side=side)
            o = _create_order(reg["token"])
            _admin_activate(admin_token, o["_id"])
            made += 1

        post_c = requests.get(f"{API}/admin/commissions?commission_type=DIRECT_REFERRAL",
                              headers=_headers(admin_token), timeout=15).json()["commissions"]
        post_count = sum(1 for c in post_c if c["beneficiary_user_id"] == root_active_customer["_id"])
        assert post_count >= pre_count + made  # >= because prior tests may have added


class TestMatchingIncome:
    def test_matching_income_created_for_ancestors(self, admin_token):
        """Register root -> left child -> then right child forms a pair for root."""
        root = _register("QA MatchRoot")
        ro = _create_order(root["token"]); _admin_activate(admin_token, ro["_id"])
        me = requests.get(f"{API}/auth/me", headers=_headers(root["token"]), timeout=15).json()["user"]
        root["_id"] = me["_id"]; root["referral_code"] = me["referral_code"]

        left = _register("QA MatchLeft", referral_code=root["referral_code"], placement_side="LEFT")
        lo = _create_order(left["token"]); _admin_activate(admin_token, lo["_id"])

        right = _register("QA MatchRight", referral_code=root["referral_code"], placement_side="RIGHT")
        ro2 = _create_order(right["token"]); _admin_activate(admin_token, ro2["_id"])

        allc = requests.get(f"{API}/admin/commissions?commission_type=MATCHING_INCOME",
                            headers=_headers(admin_token), timeout=15).json()["commissions"]
        mine = [c for c in allc if c["beneficiary_user_id"] == root["_id"]]
        assert len(mine) >= 1, "matching income should be created after first pair"
        c = mine[0]
        assert float(c["gross_amount"]) == 1374
        assert float(c["admin_charge_amount"]) == 137.4
        assert float(c["net_amount"]) == 1236.6


# ---------------- BANK / REVEAL FLOW ----------------
class TestBankReveal:
    def test_customer_bank_masked_only(self):
        reg = _register("QA Bank")
        payload = {
            "account_holder": "QA Bank",
            "account_number": "9988776655443322",
            "ifsc": "hdfc0000123",
            "bank_name": "HDFC Bank",
            "upi_id": "qabank@upi",
        }
        r = requests.post(f"{API}/customer/bank-accounts",
                          json=payload, headers=_headers(reg["token"]), timeout=15)
        assert r.status_code == 200, r.text
        ba = r.json()["bank_account"]
        assert ba["account_number"] != payload["account_number"]
        assert ba["account_number"].endswith("3322")
        assert "X" in ba["account_number"] or "*" in ba["account_number"]
        # list also masked
        r2 = requests.get(f"{API}/customer/bank-accounts",
                          headers=_headers(reg["token"]), timeout=15)
        for row in r2.json()["bank_accounts"]:
            assert payload["account_number"] not in row["account_number"]

    def test_admin_user_detail_shows_masked_only(self, admin_token):
        reg = _register("QA BankAdm")
        payload = {"account_holder": "QA BankAdm", "account_number": "1111222233334444",
                   "ifsc": "sbin0000111", "bank_name": "SBI"}
        requests.post(f"{API}/customer/bank-accounts", json=payload,
                       headers=_headers(reg["token"]), timeout=15)
        # admin fetches user detail
        r = requests.get(f"{API}/admin/users/{reg['user']['_id']}",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "bank_accounts_masked" in body
        assert body["bank_accounts_masked"], "should have at least one masked bank"
        for ba in body["bank_accounts_masked"]:
            assert payload["account_number"] not in ba["account_number"]
            assert ba["account_number"].endswith("4444")
        # ensure password_hash is stripped everywhere
        assert "password_hash" not in body["user"]

    def test_reveal_bank_requires_reason(self, admin_token):
        reg = _register("QA Reveal")
        payload = {"account_holder": "QA Reveal", "account_number": "9998887776665555",
                   "ifsc": "icic0000222", "bank_name": "ICICI", "upi_id": "qareveal@upi"}
        bar = requests.post(f"{API}/customer/bank-accounts", json=payload,
                            headers=_headers(reg["token"]), timeout=15).json()["bank_account"]
        # without reason -> 400
        r_no = requests.post(f"{API}/admin/users/{reg['user']['_id']}/bank-details/reveal",
                             json={"bank_account_id": bar["_id"], "reason": ""},
                             headers=_headers(admin_token), timeout=15)
        assert r_no.status_code == 400
        # with reason -> 200 + full account number
        r_ok = requests.post(f"{API}/admin/users/{reg['user']['_id']}/bank-details/reveal",
                             json={"bank_account_id": bar["_id"], "reason": "Payout verification"},
                             headers=_headers(admin_token), timeout=15)
        assert r_ok.status_code == 200, r_ok.text
        bd = r_ok.json()["bank_details"]
        assert bd["account_number"] == payload["account_number"]
        assert bd["upi_id"] == payload["upi_id"]
        # audit log entry
        al = requests.get(f"{API}/admin/audit-logs",
                          headers=_headers(admin_token), timeout=15).json()["audit_logs"]
        assert any(a["action"] == "REVEAL_BANK_DETAILS"
                    and a["target_id"] == bar["_id"]
                    and a.get("details", {}).get("reason") == "Payout verification" for a in al)

    def test_bank_audit_copy_actions(self, admin_token):
        reg = _register("QA Copy")
        payload = {"account_holder": "QA Copy", "account_number": "5555666677778888",
                   "ifsc": "kkbk0000333", "bank_name": "Kotak", "upi_id": "qacopy@upi"}
        bar = requests.post(f"{API}/customer/bank-accounts", json=payload,
                            headers=_headers(reg["token"]), timeout=15).json()["bank_account"]
        for act in ("COPY_ACCOUNT_NUMBER", "COPY_IFSC", "COPY_UPI_ID", "HIDE_BANK_DETAILS"):
            r = requests.post(f"{API}/admin/users/{reg['user']['_id']}/bank-details/audit-copy",
                              json={"bank_account_id": bar["_id"], "action": act},
                              headers=_headers(admin_token), timeout=15)
            assert r.status_code == 200, f"{act}: {r.text}"
        al = requests.get(f"{API}/admin/audit-logs",
                          headers=_headers(admin_token), timeout=15).json()["audit_logs"]
        actions_seen = {a["action"] for a in al if a["target_id"] == bar["_id"]}
        for act in ("COPY_ACCOUNT_NUMBER", "COPY_IFSC", "COPY_UPI_ID", "HIDE_BANK_DETAILS"):
            assert act in actions_seen, f"missing audit log for {act}"


# ---------------- RBAC / SETTINGS / PASSWORD MGMT ----------------
class TestRBACAndAdmin:
    def test_customer_cannot_access_admin(self):
        reg = _register("QA RBAC")
        r = requests.get(f"{API}/admin/dashboard",
                         headers=_headers(reg["token"]), timeout=15)
        assert r.status_code == 403

    def test_admin_settings_configs(self, admin_token):
        r = requests.get(f"{API}/admin/settings",
                         headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        s = r.json()["settings"]
        for key in ("cashback_config", "direct_referral_config", "matching_config"):
            assert key in s, f"missing {key}"
        assert float(s["cashback_config"]["gross_monthly"]) == 3000
        assert float(s["direct_referral_config"]["gross_percent"]) == 5
        assert float(s["matching_config"]["gross_percent"]) == 2.5

    def test_admin_settings_patch(self, admin_token):
        new_cfg = {"plan_price": 54999, "gross_monthly": 3000,
                   "admin_charge_percent": 10, "months": 10,
                   "first_payout_delay_days": 45, "status": "active",
                   "rounding_mode": "two_decimals"}
        r = requests.patch(f"{API}/admin/settings",
                           json={"cashback_config": new_cfg},
                           headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200

    def test_admin_set_temp_password_and_send_reset(self, admin_token):
        reg = _register("QA TmpPwd")
        # set temp password
        r = requests.post(
            f"{API}/admin/users/{reg['user']['_id']}/set-temp-password",
            json={"temp_password": "Temp@2026"},
            headers=_headers(admin_token), timeout=15,
        )
        assert r.status_code == 200
        assert "temp_password" not in r.text  # response doesn't leak it
        # login with temp password shows must_change_password
        lg = requests.post(f"{API}/auth/login",
                           json={"email": reg["email"], "password": "Temp@2026"}, timeout=15)
        assert lg.status_code == 200
        assert lg.json()["must_change_password"] is True

        # send password reset
        r2 = requests.post(
            f"{API}/admin/users/{reg['user']['_id']}/send-password-reset",
            headers=_headers(admin_token), timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json().get("reset_token")

    def test_admin_users_response_no_password_hash(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=_headers(admin_token), timeout=15)
        for u in r.json()["users"]:
            assert "password_hash" not in u

    def test_admin_audit_logs_endpoint(self, admin_token):
        r = requests.get(f"{API}/admin/audit-logs", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert "audit_logs" in r.json()


# ---------------- CASHBACK / COMMISSION WORKFLOW ----------------
class TestPayoutWorkflow:
    def test_cashback_approve_and_mark_paid(self, admin_token, root_active_customer):
        # Grab any scheduled cashback record and mark paid
        cbs = requests.get(f"{API}/admin/cashback?status=SCHEDULED",
                           headers=_headers(admin_token), timeout=20).json()["cashback_schedule"]
        if not cbs:
            pytest.skip("no cashback rows")
        rec = cbs[0]
        r1 = requests.patch(f"{API}/admin/cashback/{rec['_id']}/approve",
                            headers=_headers(admin_token), timeout=15)
        assert r1.status_code == 200
        r2 = requests.patch(f"{API}/admin/cashback/{rec['_id']}/mark-paid",
                            headers=_headers(admin_token), timeout=15)
        assert r2.status_code == 200
        # wallet txn CASHBACK_CREDIT should exist for that user
        # need customer token — we'll use admin user detail to check via wallet? use wallet_transactions via user detail
        u = requests.get(f"{API}/admin/users/{rec['user_id']}",
                         headers=_headers(admin_token), timeout=15).json()
        # marker: cashback row now has status PAID
        cb_paid = [x for x in u.get("cashback_schedule", []) if x["_id"] == rec["_id"]]
        assert cb_paid and cb_paid[0]["status"] == "PAID"

    def test_commission_approve_mark_paid(self, admin_token):
        pending = requests.get(f"{API}/admin/commissions?status=PENDING",
                               headers=_headers(admin_token), timeout=20).json()["commissions"]
        if not pending:
            pytest.skip("no pending commissions")
        c = pending[0]
        r = requests.patch(f"{API}/admin/commissions/{c['_id']}/approve",
                           headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        r2 = requests.patch(f"{API}/admin/commissions/{c['_id']}/mark-paid",
                            headers=_headers(admin_token), timeout=15)
        assert r2.status_code == 200

    def test_commission_reject_then_cannot_mark_paid(self, admin_token):
        pending = requests.get(f"{API}/admin/commissions?status=PENDING",
                               headers=_headers(admin_token), timeout=20).json()["commissions"]
        if not pending:
            pytest.skip("no pending commissions to reject")
        c = pending[0]
        requests.patch(f"{API}/admin/commissions/{c['_id']}/reject",
                       headers=_headers(admin_token), timeout=15)
        r = requests.patch(f"{API}/admin/commissions/{c['_id']}/mark-paid",
                           headers=_headers(admin_token), timeout=15)
        assert r.status_code == 400


# ---------------- MEDIA ----------------
class TestMedia:
    def test_media_upload_and_public_listing(self, admin_token):
        # Small 1x1 PNG
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
            "890000000A49444154789C6360000000000200015E9F3A800000000049454E44AE426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        data = {
            "section": "gallery", "title": "QA Test", "caption": "test",
            "display_order": "0", "visible": "true", "media_type": "image",
        }
        r = requests.post(f"{API}/admin/media/upload",
                          data=data, files=files,
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=20)
        assert r.status_code == 200, r.text
        mid = r.json()["media"]["_id"]
        # public listing
        pl = requests.get(f"{API}/media?section=gallery", timeout=15)
        assert pl.status_code == 200
        assert any(m["_id"] == mid for m in pl.json()["media"])
        # cleanup
        requests.delete(f"{API}/admin/media/{mid}",
                        headers=_headers(admin_token), timeout=15)
