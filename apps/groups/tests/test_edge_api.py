"""
Additional API tests covering edge cases and previously-untested endpoints.

Covers:
- Transfer ownership (no URL exists → 404 — documents the gap)
- QR code endpoint (returns PNG image)
- Confirming an already-confirmed expense (403)
- Non-owner/non-admin cannot edit expense (403)
- Self-removal from group
- Expired invite code
- Change role without 'role' field (400)
- Settlement list endpoint
- Balance sum-to-zero invariant
- Activity log ordering
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.groups.models import (
    Balance,
    Group,
    Membership,
)

User = get_user_model()

BASE = "/api/v1/"


@pytest.fixture
def api():
    return APIClient()


def _make_user(phone, active=True):
    return User.objects.create_user(phone_number=phone, password="Test@123", is_active=active)


@pytest.fixture
def user1(db):
    return _make_user("09111111111")


@pytest.fixture
def user2(db):
    return _make_user("09222222222")


@pytest.fixture
def user3(db):
    return _make_user("09333333333")


@pytest.fixture
def user4(db):
    return _make_user("09444444444")


@pytest.fixture
def auth(api, user1):
    token = str(RefreshToken.for_user(user1).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def auth2(api, user2):
    token = str(RefreshToken.for_user(user2).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def auth3(api, user3):
    token = str(RefreshToken.for_user(user3).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def auth4(api, user4):
    token = str(RefreshToken.for_user(user4).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def group(user1, user2, user3):
    g = Group.objects.create(name="تست", created_by=user1, owner=user1, budget_limit=1_000_000)
    Membership.objects.create(user=user1, group=g, role="admin")
    Membership.objects.create(user=user2, group=g, role="member")
    Membership.objects.create(user=user3, group=g, role="member")
    for u in (user1, user2, user3):
        Balance.objects.get_or_create(user=u, group=g, defaults={"amount": 0})
    g.generate_invite_code()
    return g


def _create_expense_and_confirm(auth_client, gid, paid_by_id, splits, amount=None):
    if amount is None:
        amount = sum(a for _, a in splits)
    res = auth_client.post(
        f"{BASE}groups/{gid}/expenses/",
        {
            "description": "تست",
            "total_amount": amount,
            "split_type": "exact",
            "splits": [{"user": uid, "amount": a} for uid, a in splits],
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    eid = res.data["id"]
    res = auth_client.patch(
        f"{BASE}groups/{gid}/expenses/{eid}/",
        {"is_confirmed": True},
        format="json",
    )
    assert res.status_code == 200, res.data
    return eid


# ══════════════════════════════════════════════════════════════
# TRANSFER OWNERSHIP
# ══════════════════════════════════════════════════════════════


class TestTransferOwnership:
    """TransferOwnershipView exists in views.py but has NO URL route.
    This documents that fact and tests the service directly."""

    def test_transfer_ownership_no_url_returns_404(self, auth, group, user2):
        """Transfer ownership endpoint returns 404 — no URL route exists."""
        res = auth.post(
            f"{BASE}groups/{group.id}/transfer-ownership/",
            {"user_id": user2.id},
            format="json",
        )
        assert res.status_code == 404

    def test_transfer_ownership_via_service(self, auth, group, user2):
        """Transfer ownership works correctly at the service level."""
        from apps.groups.services import GroupService

        gs = GroupService()
        gs.transfer_ownership(group_id=group.id, new_owner_id=user2.id, current_owner=group.owner)
        group.refresh_from_db()
        assert group.owner == user2
        # user2 should now be admin
        assert Membership.objects.get(user=user2, group=group).role == "admin"

    def test_transfer_ownership_non_owner_forbidden(self, auth2, group, user3):
        """Non-owner cannot transfer ownership."""
        from apps.groups.services import GroupService

        gs = GroupService()
        with pytest.raises(PermissionError):
            gs.transfer_ownership(group_id=group.id, new_owner_id=user3.id, current_owner=user2)


# ══════════════════════════════════════════════════════════════
# QR CODE
# ══════════════════════════════════════════════════════════════


class TestQRCode:
    def test_qr_code_returns_png(self, auth, group):
        res = auth.get(f"{BASE}groups/{group.id}/qr-code/")
        assert res.status_code == 200
        assert res["Content-Type"] == "image/png"
        # Verify it's valid PNG (starts with PNG magic bytes)
        assert res.content[:4] == b"\x89PNG"

    def test_qr_code_auto_generates_invite(self, db):
        """If no invite code exists, QR endpoint auto-generates one."""
        user = User.objects.create_user(
            phone_number="09111111111", password="Test@123", is_active=True
        )
        g = Group.objects.create(name="بدون کد", created_by=user, owner=user)
        Membership.objects.create(user=user, group=g, role="admin")
        assert g.invite_code is None

        token = str(RefreshToken.for_user(user).access_token)
        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = api.get(f"{BASE}groups/{g.id}/qr-code/")
        assert res.status_code == 200
        g.refresh_from_db()
        assert g.invite_code is not None

    def test_qr_code_unauthenticated(self, api, group):
        res = api.get(f"{BASE}groups/{group.id}/qr-code/")
        assert res.status_code == 401

    def test_qr_code_non_member(self, auth4, group):
        res = auth4.get(f"{BASE}groups/{group.id}/qr-code/")
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════
# EXPENSE EDGE CASES
# ══════════════════════════════════════════════════════════════


class TestExpenseEdgeCases:
    def test_cannot_edit_confirmed_expense(self, auth, group, user1, user2):
        """Once an expense is confirmed, PATCH should return 403."""
        eid = _create_expense_and_confirm(
            auth, group.id, user1.id, [(user1.id, 100000), (user2.id, 100000)]
        )
        res = auth.patch(
            f"{BASE}groups/{group.id}/expenses/{eid}/",
            {"description": "ویرایش شده"},
            format="json",
        )
        assert res.status_code == 403

    def test_non_payer_non_admin_cannot_edit_expense(self, auth3, group, user1, user3):
        """user1 creates expense (payer), user3 (non-payer, non-admin) cannot edit it."""
        from apps.groups.services import ExpenseService

        es = ExpenseService()
        exp = es.create_expense(
            group_id=group.id,
            paid_by=user1,
            validated_data={
                "description": "test",
                "total_amount": 100000,
                "split_type": "exact",
                "splits": [
                    {"user": user1, "amount": 50000},
                    {"user": user3, "amount": 50000},
                ],
            },
        )
        # user3 tries to edit user1's expense (user3 didn't pay and is not admin)
        res = auth3.patch(
            f"{BASE}groups/{group.id}/expenses/{exp.id}/",
            {"description": "هک"},
            format="json",
        )
        assert res.status_code == 403

    def test_payer_can_edit_own_unconfirmed_expense(self, api, user1, user2, group):
        """user2 (payer) can edit their own unconfirmed expense."""
        from rest_framework_simplejwt.tokens import RefreshToken as RT

        api2 = APIClient()
        api2.credentials(HTTP_AUTHORIZATION=f"Bearer {RT.for_user(user2).access_token}")
        res = api2.post(
            f"{BASE}groups/{group.id}/expenses/",
            {
                "description": "test",
                "total_amount": 100000,
                "split_type": "exact",
                "splits": [
                    {"user": user1.id, "amount": 50000},
                    {"user": user2.id, "amount": 50000},
                ],
            },
            format="json",
        )
        eid = res.data["id"]
        res = api2.patch(
            f"{BASE}groups/{group.id}/expenses/{eid}/",
            {"description": "ویرایش شده"},
            format="json",
        )
        # Payer can edit their own unconfirmed expense
        assert res.status_code == 200

    def test_percentage_split_where_total_not_100(self, auth, group, user1, user2, user3):
        """Percentages don't add up to 100 — server should handle gracefully."""
        res = auth.post(
            f"{BASE}groups/{group.id}/expenses/",
            {
                "description": "درصدی",
                "total_amount": 300000,
                "split_type": "percentage",
                "splits": [
                    {"user": user1.id, "percentage": 50},
                    {"user": user2.id, "percentage": 30},
                    {"user": user3.id, "percentage": 10},  # total = 90%
                ],
            },
            format="json",
        )
        # The backend may accept or reject — just ensure no 500 error
        assert res.status_code in (201, 400)


# ══════════════════════════════════════════════════════════════
# INVITE CODE EDGE CASES
# ══════════════════════════════════════════════════════════════


class TestInviteCodeEdgeCases:
    def test_join_expired_invite_code(self, api, group, user4):
        """Expired invite code should be rejected."""
        from datetime import timedelta
        from django.utils import timezone

        # Manually expire the code
        group.invite_code_expires_at = timezone.now() - timedelta(days=1)
        group.save(update_fields=["invite_code_expires_at"])

        token = str(RefreshToken.for_user(user4).access_token)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = api.post(
            f"{BASE}groups/join/",
            {"invite_code": group.invite_code},
            format="json",
        )
        assert res.status_code in (400, 404)
        assert not Membership.objects.filter(group=group, user=user4).exists()


# ══════════════════════════════════════════════════════════════
# MEMBERSHIP EDGE CASES
# ══════════════════════════════════════════════════════════════


class TestMembershipEdgeCases:
    def test_self_removal(self, auth2, group, user2):
        """A member can remove themselves from the group."""
        res = auth2.delete(f"{BASE}groups/{group.id}/members/{user2.id}/remove/")
        assert res.status_code in (200, 204)
        assert not Membership.objects.filter(group=group, user=user2).exists()

    def test_change_role_missing_role_field(self, auth, group, user2):
        """PATCH without 'role' field returns 400."""
        res = auth.patch(
            f"{BASE}groups/{group.id}/members/{user2.id}/role/",
            {},
            format="json",
        )
        assert res.status_code == 400

    def test_change_role_invalid_value(self, auth, group, user2):
        """Invalid role value should be rejected."""
        res = auth.patch(
            f"{BASE}groups/{group.id}/members/{user2.id}/role/",
            {"role": "superadmin"},
            format="json",
        )
        assert res.status_code in (400, 403)

    def test_add_duplicate_member(self, auth, group, user2):
        """Adding an existing member should return an error."""
        res = auth.post(
            f"{BASE}groups/{group.id}/members/add/",
            {"phone_number": user2.phone_number},
            format="json",
        )
        assert res.status_code == 400

    def test_remove_owner_blocked(self, auth, group, user1):
        """Cannot remove the owner from the group (owner is protected)."""
        res = auth.delete(f"{BASE}groups/{group.id}/members/{user1.id}/remove/")
        # The service may prevent this or return an error
        assert res.status_code in (400, 403, 200, 204)
        # Owner should still be a member
        assert Membership.objects.filter(group=group, user=user1).exists()


# ══════════════════════════════════════════════════════════════
# SETTLEMENT LIST
# ══════════════════════════════════════════════════════════════


class TestSettlementList:
    def test_list_empty_settlements(self, auth, group):
        res = auth.get(f"{BASE}groups/{group.id}/settlements/")
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) == 0

    def test_list_settlements_after_create(self, auth, auth2, group, user1, user2):
        """Create a settlement and verify it appears in the list."""
        from apps.groups.services import ExpenseService

        es = ExpenseService()
        exp = es.create_expense(
            group_id=group.id,
            paid_by=user1,
            validated_data={
                "description": "t",
                "total_amount": 200000,
                "split_type": "exact",
                "splits": [
                    {"user": user1, "amount": 100000},
                    {"user": user2, "amount": 100000},
                ],
            },
        )
        es.confirm_expense(expense_id=exp.id, confirmed_by=user1)
        # user2 creates a settlement
        res = auth2.post(
            f"{BASE}groups/{group.id}/settlements/",
            {"to_user_id": user1.id, "amount": 100000},
            format="json",
        )
        assert res.status_code == 201

        # List should show it
        res = auth.get(f"{BASE}groups/{group.id}/settlements/")
        assert res.status_code == 200
        assert len(res.data) == 1
        assert res.data[0]["status"] == "pending"


# ══════════════════════════════════════════════════════════════
# BALANCE EDGE CASES
# ══════════════════════════════════════════════════════════════


class TestBalanceEdgeCases:
    def test_balances_all_zero_after_creation(self, auth, group):
        """Fresh group with no expenses → all balances are 0."""
        res = auth.get(f"{BASE}groups/{group.id}/balances/")
        assert res.status_code == 200
        assert len(res.data) == 3
        for b in res.data:
            assert b["net"] == 0

    def test_balances_sum_to_zero(self, auth, group, user1, user2):
        """After any expense, the sum of all balances must be 0."""
        _create_expense_and_confirm(
            auth,
            group.id,
            user1.id,
            [(user1.id, 200000), (user2.id, 100000)],
        )
        res = auth.get(f"{BASE}groups/{group.id}/balances/")
        assert res.status_code == 200
        total = sum(b["net"] for b in res.data)
        assert total == 0

    def test_balances_after_settlement_zero_out(self, auth, auth2, group, user1, user2):
        """After settlement, debtor's balance should be zero."""
        from apps.groups.services import ExpenseService, SettlementService

        es = ExpenseService()
        ss = SettlementService()
        exp = es.create_expense(
            group_id=group.id,
            paid_by=user1,
            validated_data={
                "description": "t",
                "total_amount": 200000,
                "split_type": "exact",
                "splits": [
                    {"user": user1, "amount": 100000},
                    {"user": user2, "amount": 100000},
                ],
            },
        )
        es.confirm_expense(expense_id=exp.id, confirmed_by=user1)
        settlement = ss.create_settlement(
            group_id=group.id,
            from_user=user2,
            to_user_id=user1.id,
            amount=100000,
            created_by=user2,
        )
        ss.confirm_settlement(settlement_id=settlement.id, confirmed_by=user1)

        res = auth.get(f"{BASE}groups/{group.id}/balances/")
        assert res.status_code == 200
        for b in res.data:
            assert b["net"] == 0


# ══════════════════════════════════════════════════════════════
# ACTIVITY LOG
# ══════════════════════════════════════════════════════════════


class TestActivityLog:
    def test_activities_sorted_by_timestamp(self, auth, group, user1, user2):
        """Activities should be ordered by timestamp descending."""
        from apps.groups.models import ActivityLog
        import time

        ActivityLog.objects.create(
            group=group, user=user1, action="expense_created", description="a"
        )
        time.sleep(0.01)
        ActivityLog.objects.create(
            group=group, user=user2, action="expense_confirmed", description="b"
        )

        res = auth.get(f"{BASE}groups/{group.id}/activities/")
        assert res.status_code == 200
        assert len(res.data) == 2
        # Newer first
        assert res.data[0]["action"] == "expense_confirmed"
        assert res.data[1]["action"] == "expense_created"

    def test_activities_empty_for_new_group(self, auth, group):
        res = auth.get(f"{BASE}groups/{group.id}/activities/")
        assert res.status_code == 200
        assert len(res.data) == 0

    def test_activities_non_member_forbidden(self, auth4, group):
        res = auth4.get(f"{BASE}groups/{group.id}/activities/")
        assert res.status_code == 403
