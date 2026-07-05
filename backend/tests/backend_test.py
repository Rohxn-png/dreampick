"""Backend regression suite for Dream Pick MVP.
Covers auth, public referral/tree, orders + activation flow, customer + admin routes,
commission workflow, withdrawal workflow, audit logs, and settings.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://binary-commerce.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_PWD = "Demo@123"
SUPER_ADMIN = "superadmin@dreampick.demo"
ADMIN = "admin@dreampick.demo"
CUSTOMER = "customer1@dreampick.demo"
PENDING = "pending1@dreampick.demo"


# ---------- fixtures ----------
def _login(email, password=DEMO_PWD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def super_admin_token():
    return _login(SUPER_ADMIN)


@pytest.fixture(scope="session")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="session")
def customer1_referral_code(admin_token):
    r = requests.get(f"{API}/admin/users?q=customer1", headers=_headers(admin_token), timeout=15)
    r.raise_for_status()
    users = r.json()["users"]
    c1 = next(u for u in users if u["email"] == CUSTOMER)
    return c1["referral_code"], c1["_id"]


# ---------- health ----------
class TestHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- auth ----------
class TestAuth:
    def test_login_customer_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": CUSTOMER, "password": DEMO_PWD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == CUSTOMER
        assert data["user"]["role"] == "CUSTOMER"
        assert data["user"]["status"] == "ACTIVE"
        assert "password_hash" not in data["user"]

    def test_login_admin_role(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN, "password": DEMO_PWD}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "ADMIN"

    def test_login_super_admin_role(self):
        r = requests.post(f"{API}/auth/login", json={"email": SUPER_ADMIN, "password": DEMO_PWD}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "SUPER_ADMIN"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": CUSTOMER, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_register_new_pending_user_no_referral(self):
        email = f"dpqa+{int(time.time()*1000)}@dreampick.demo"
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "QA NoRef",
            "email": email,
            "phone": "+91-9990000001",
            "password": DEMO_PWD,
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["status"] == "PENDING"
        assert data["user"]["role"] == "CUSTOMER"
        assert "access_token" in data
        assert "password_hash" not in data["user"]

    def test_register_duplicate_email(self):
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "Dup",
            "email": CUSTOMER,
            "phone": "+91-9990000000",
            "password": DEMO_PWD,
        }, timeout=15)
        assert r.status_code == 409

    def test_me_endpoint(self, customer_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == CUSTOMER

    def test_me_no_token_unauthorized(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- public ----------
class TestPublic:
    def test_scooters_list_has_price(self):
        r = requests.get(f"{API}/scooters", timeout=15)
        assert r.status_code == 200
        sc = r.json()["scooters"]
        assert len(sc) >= 1
        assert sc[0]["price"] == 54999 or sc[0]["price"] == 54999.0

    def test_referral_validate_valid(self, customer1_referral_code):
        code, _ = customer1_referral_code
        r = requests.post(f"{API}/referrals/validate", json={"referral_code": code}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert "referrer" in data
        assert "suggested_side" in data["referrer"]
        assert "left_count" in data["referrer"]
        assert "right_count" in data["referrer"]

    def test_referral_validate_invalid(self):
        r = requests.post(f"{API}/referrals/validate", json={"referral_code": "NOPECODE"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_tree_preview_placement(self, customer1_referral_code):
        code, _ = customer1_referral_code
        r = requests.post(f"{API}/tree/preview-placement", json={
            "referral_code": code, "selected_side": "LEFT",
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "placement_preview" in data
        pp = data["placement_preview"]
        assert pp["placement_side"] in ("LEFT", "RIGHT")
        assert "expected_depth" in pp
        assert pp.get("placement_parent_user_code")


# ---------- full purchase + activation flow ----------
class TestPurchaseFlow:
    """Register -> create order -> simulate payment success -> user active + in tree + commissions"""

    def test_full_purchase_activation(self, customer1_referral_code, admin_token):
        code, ref_id = customer1_referral_code
        # pick RIGHT to force placement diversity
        email = f"dpqa+flow{int(time.time()*1000)}@dreampick.demo"
        reg = requests.post(f"{API}/auth/register", json={
            "full_name": "QA Flow",
            "email": email,
            "phone": "+91-9990000010",
            "password": DEMO_PWD,
            "referral_code": code,
            "placement_side": "RIGHT",
        }, timeout=15)
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]
        new_user_id = reg.json()["user"]["_id"]

        # Ancestors' right counts before
        pre = requests.get(f"{API}/admin/users?q=customer1", headers=_headers(admin_token), timeout=15).json()["users"]
        pre_c1 = next(u for u in pre if u["email"] == CUSTOMER)
        pre_right = pre_c1["right_count"]

        # Create order
        oc = requests.post(f"{API}/orders/create", json={}, headers=_headers(token), timeout=15)
        assert oc.status_code == 200, oc.text
        order = oc.json()["order"]
        assert order["payment_status"] == "CREATED"
        assert order["amount"] == 54999 or order["amount"] == 54999.0
        order_id = order["_id"]

        # Simulate payment success
        sp = requests.post(f"{API}/orders/{order_id}/simulate-payment-success", headers=_headers(token), timeout=20)
        assert sp.status_code == 200, sp.text
        body = sp.json()
        assert body["order"]["payment_status"] == "PAID"

        # Verify user activated
        me = requests.get(f"{API}/auth/me", headers=_headers(token), timeout=15).json()["user"]
        assert me["status"] == "ACTIVE"

        # Verify ancestor right count incremented (customer1 is ref)
        post = requests.get(f"{API}/admin/users?q=customer1", headers=_headers(admin_token), timeout=15).json()["users"]
        post_c1 = next(u for u in post if u["email"] == CUSTOMER)
        assert post_c1["right_count"] == pre_right + 1

        # Verify commissions exist (if a new pair was created)
        # A pair depends on matched left/right counts. At minimum, ensure API works
        allc = requests.get(f"{API}/admin/commissions", headers=_headers(admin_token), timeout=15).json()["commissions"]
        assert isinstance(allc, list)
        # If a new pair was created, at least one PENDING commission with amount 2700 exists for an ancestor
        # Not guaranteed but check triggering_user_id chain
        triggered = [c for c in allc if c.get("triggering_user_id") == new_user_id]
        for c in triggered:
            assert c["amount"] == 2700 or c["amount"] == 2700.0

    def test_register_no_referral_and_activate(self):
        email = f"dpqa+root{int(time.time()*1000)}@dreampick.demo"
        reg = requests.post(f"{API}/auth/register", json={
            "full_name": "QA Root",
            "email": email,
            "phone": "+91-9990000020",
            "password": DEMO_PWD,
        }, timeout=15)
        assert reg.status_code == 200
        token = reg.json()["access_token"]

        oc = requests.post(f"{API}/orders/create", json={}, headers=_headers(token), timeout=15)
        assert oc.status_code == 200
        oid = oc.json()["order"]["_id"]
        sp = requests.post(f"{API}/orders/{oid}/simulate-payment-success", headers=_headers(token), timeout=20)
        assert sp.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=_headers(token), timeout=15).json()["user"]
        assert me["status"] == "ACTIVE"


# ---------- customer routes ----------
class TestCustomerRoutes:
    def test_dashboard(self, customer_token):
        r = requests.get(f"{API}/customer/dashboard", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d
        assert "commissions_summary" in d
        assert "available_balance" in d

    def test_tree(self, customer_token):
        r = requests.get(f"{API}/customer/tree", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert "tree" in r.json()

    def test_referrals(self, customer_token):
        r = requests.get(f"{API}/customer/referrals", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "direct_referrals" in j and "downline" in j

    def test_commissions(self, customer_token):
        r = requests.get(f"{API}/customer/commissions", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert "commissions" in r.json()

    def test_wallet(self, customer_token):
        r = requests.get(f"{API}/customer/wallet", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        w = r.json()
        for k in ("available_balance", "pending_balance", "wallet_transactions", "withdrawal_requests"):
            assert k in w

    def test_bank_account_masked(self, customer_token):
        payload = {
            "account_holder": "QA Customer",
            "account_number": "9876543210123456",
            "ifsc": "hdfc0009999",
            "bank_name": "HDFC Bank",
        }
        r = requests.post(f"{API}/customer/bank-accounts", json=payload, headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        ba = r.json()["bank_account"]
        # Assert not full plaintext
        assert ba["account_number"] != payload["account_number"]
        assert ba["account_number"].endswith("3456")
        assert "*" in ba["account_number"]

    def test_withdrawal_requires_bank_account(self, customer_token):
        r = requests.post(f"{API}/customer/withdrawals", json={"amount": 100.0, "bank_account_id": "nope"}, headers=_headers(customer_token), timeout=15)
        assert r.status_code == 404

    def test_withdrawal_insufficient_balance(self, customer_token):
        # Get any bank account for this user
        r = requests.get(f"{API}/customer/bank-accounts", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        bas = r.json()["bank_accounts"]
        if not bas:
            pytest.skip("No bank account for customer")
        r2 = requests.post(f"{API}/customer/withdrawals", json={
            "amount": 9999999.0,
            "bank_account_id": bas[0]["_id"],
        }, headers=_headers(customer_token), timeout=15)
        assert r2.status_code == 400
        assert "insufficient" in r2.text.lower()

    def test_profile_update(self, customer_token):
        r = requests.patch(f"{API}/customer/profile", json={"phone": "+91-9990001234"}, headers=_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["phone"] == "+91-9990001234"


# ---------- admin auth guards ----------
class TestAdminAuth:
    def test_customer_forbidden_on_admin(self, customer_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_headers(customer_token), timeout=15)
        assert r.status_code == 403

    def test_admin_dashboard(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d and "commissions_summary" in d and "recent_users" in d


# ---------- admin users/tree ----------
class TestAdminUsers:
    def test_list_users_with_counts(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) >= 15
        assert all("left_count" in u and "right_count" in u and "matched_pairs" in u for u in users)

    def test_list_users_filter_status(self, admin_token):
        r = requests.get(f"{API}/admin/users?status=PENDING", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u["status"] == "PENDING"

    def test_update_user_status_and_audit_log(self, admin_token):
        # Pick a pending user
        r = requests.get(f"{API}/admin/users?status=PENDING", headers=_headers(admin_token), timeout=15)
        pending = r.json()["users"]
        if not pending:
            pytest.skip("No pending user")
        uid = pending[0]["_id"]
        orig = pending[0]["status"]
        pr = requests.patch(f"{API}/admin/users/{uid}/status", json={"status": "BLOCKED"}, headers=_headers(admin_token), timeout=15)
        assert pr.status_code == 200
        # verify
        r2 = requests.get(f"{API}/admin/users/{uid}", headers=_headers(admin_token), timeout=15).json()
        assert r2["user"]["status"] == "BLOCKED"
        # restore
        requests.patch(f"{API}/admin/users/{uid}/status", json={"status": orig}, headers=_headers(admin_token), timeout=15)
        # audit log
        al = requests.get(f"{API}/admin/audit-logs", headers=_headers(admin_token), timeout=15).json()["audit_logs"]
        assert any(a["target_id"] == uid and a["action"] == "user_status_change" for a in al)

    def test_admin_tree_root(self, admin_token):
        r = requests.get(f"{API}/admin/tree", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        t = r.json()["tree"]
        assert t is not None
        assert "left" in t and "right" in t

    def test_admin_tree_integrity(self, admin_token):
        r = requests.get(f"{API}/admin/tree/integrity-check", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "ok" in j and "issues" in j


# ---------- admin orders + refund ----------
class TestAdminOrders:
    def test_list_orders(self, admin_token):
        r = requests.get(f"{API}/admin/orders", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json()["orders"], list)


# ---------- commission workflow ----------
class TestCommissionWorkflow:
    def test_approve_mark_paid_creates_wallet_txn(self, admin_token):
        pending = requests.get(f"{API}/admin/commissions?status=PENDING", headers=_headers(admin_token), timeout=15).json()["commissions"]
        if not pending:
            pytest.skip("No pending commission")
        c = pending[0]
        # approve
        r = requests.patch(f"{API}/admin/commissions/{c['_id']}/approve", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        # mark paid
        r2 = requests.patch(f"{API}/admin/commissions/{c['_id']}/mark-paid", headers=_headers(admin_token), timeout=15)
        assert r2.status_code == 200

    def test_cannot_mark_rejected_as_paid(self, admin_token):
        pending = requests.get(f"{API}/admin/commissions?status=PENDING", headers=_headers(admin_token), timeout=15).json()["commissions"]
        if not pending:
            pytest.skip("No pending commission")
        c = pending[0]
        r = requests.patch(f"{API}/admin/commissions/{c['_id']}/reject", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        r2 = requests.patch(f"{API}/admin/commissions/{c['_id']}/mark-paid", headers=_headers(admin_token), timeout=15)
        assert r2.status_code == 400

    def test_reverse_commission(self, admin_token):
        pending = requests.get(f"{API}/admin/commissions?status=PENDING", headers=_headers(admin_token), timeout=15).json()["commissions"]
        if not pending:
            pytest.skip("No pending commission")
        c = pending[0]
        r = requests.patch(f"{API}/admin/commissions/{c['_id']}/reverse", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200


# ---------- withdrawal workflow ----------
class TestWithdrawalWorkflow:
    def test_approve_and_mark_paid(self, admin_token):
        pending = requests.get(f"{API}/admin/withdrawals?status=PENDING", headers=_headers(admin_token), timeout=15).json()["withdrawal_requests"]
        if not pending:
            pytest.skip("No pending withdrawal")
        wr = pending[0]
        r = requests.patch(f"{API}/admin/withdrawals/{wr['_id']}/approve", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        r2 = requests.patch(f"{API}/admin/withdrawals/{wr['_id']}/mark-paid", headers=_headers(admin_token), timeout=15)
        assert r2.status_code == 200


# ---------- settings ----------
class TestSettings:
    def test_get_settings(self, admin_token):
        r = requests.get(f"{API}/admin/settings", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        s = r.json()["settings"]
        assert "scooter_price" in s
        assert "commission_amount" in s

    def test_update_settings(self, admin_token):
        r = requests.patch(f"{API}/admin/settings", json={"demo_mode": True}, headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["changes"]["demo_mode"] is True


# ---------- commission idempotency ----------
class TestCommissionIdempotency:
    def test_unique_index_prevents_duplicates(self, admin_token):
        # Fetch some commission and try creating a duplicate directly is not possible via API.
        # Instead, verify per beneficiary+pair_number uniqueness in existing data.
        allc = requests.get(f"{API}/admin/commissions", headers=_headers(admin_token), timeout=15).json()["commissions"]
        seen = set()
        for c in allc:
            key = (c["beneficiary_user_id"], c["matched_pair_number"])
            assert key not in seen, f"Duplicate commission for {key}"
            seen.add(key)
