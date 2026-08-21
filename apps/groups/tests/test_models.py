"""
Tests for the Group model methods and related model behavior.

Covers:
- Group.total_expenses(), remaining_budget()
- Group.generate_invite_code(), is_invite_code_valid()
- Group.get_earliest_admin()
- Group.delete() safe deletion cascade
- Group.__str__
- Membership.__str__
- Expense.__str__
- ExpenseSplit.__str__
- ExpenseItem.__str__
- ExpenseItemShare.__str__
- ActivityLog.__str__
- Settlement.__str__
"""

import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.groups.models import (
    ActivityLog,
    Balance,
    Expense,
    ExpenseItem,
    ExpenseItemShare,
    ExpenseSplit,
    Group,
    Membership,
    Settlement,
)

User = get_user_model()


@pytest.fixture
def user1(db):
    return User.objects.create_user(phone_number="09111111111", password="Test@123", is_active=True)


@pytest.fixture
def user2(db):
    return User.objects.create_user(phone_number="09222222222", password="Test@123", is_active=True)


@pytest.fixture
def group(user1):
    g = Group.objects.create(name="تست گروه", created_by=user1, owner=user1, budget_limit=1_000_000)
    Membership.objects.create(user=user1, group=g, role="admin")
    return g


@pytest.fixture
def group_with_members(user1, user2):
    g = Group.objects.create(name="گروه اعضا", created_by=user1, owner=user1)
    m1 = Membership.objects.create(user=user1, group=g, role="admin")
    m2 = Membership.objects.create(user=user2, group=g, role="member")
    return g, m1, m2


# ══════════════════════════════════════════════════════════════
# GROUP MODEL
# ══════════════════════════════════════════════════════════════


class TestGroupModel:
    def test_str(self, group):
        assert str(group) == "تست گروه"

    def test_total_expenses_no_expenses(self, group):
        assert group.total_expenses() == 0

    def test_total_expenses_with_confirmed(self, group, user1):
        Expense.objects.create(
            group=group,
            paid_by=user1,
            description="test",
            total_amount=200000,
            split_type="equal",
            is_confirmed=True,
        )
        assert group.total_expenses() == 200000

    def test_total_expenses_ignores_unconfirmed(self, group, user1):
        Expense.objects.create(
            group=group,
            paid_by=user1,
            description="test",
            total_amount=200000,
            split_type="equal",
            is_confirmed=False,
        )
        assert group.total_expenses() == 0

    def test_total_expenses_multiple(self, group, user1):
        for i in range(3):
            Expense.objects.create(
                group=group,
                paid_by=user1,
                description=f"test{i}",
                total_amount=(i + 1) * 100000,
                split_type="equal",
                is_confirmed=True,
            )
        assert group.total_expenses() == 600000

    def test_remaining_budget_no_limit(self, user1):
        g = Group.objects.create(name="بدون بودجه", created_by=user1, owner=user1, budget_limit=0)
        assert g.remaining_budget() is None

    def test_remaining_budget_with_limit(self, group):
        Expense.objects.create(
            group=group,
            paid_by=group.created_by,
            description="test",
            total_amount=400000,
            split_type="equal",
            is_confirmed=True,
        )
        assert group.remaining_budget() == 600000  # 1M - 400K

    def test_remaining_budget_over_budget(self, group):
        Expense.objects.create(
            group=group,
            paid_by=group.created_by,
            description="test",
            total_amount=1500000,
            split_type="equal",
            is_confirmed=True,
        )
        assert group.remaining_budget() == -500000


class TestInviteCode:
    def test_generate_invite_code(self, group):
        assert group.invite_code is None
        group.generate_invite_code()
        group.refresh_from_db()
        assert group.invite_code is not None
        assert len(group.invite_code) == 8
        assert group.invite_code_expires_at is not None

    def test_is_invite_code_valid_no_code(self, group):
        assert group.is_invite_code_valid() is False

    def test_is_invite_code_valid_with_code(self, group):
        group.generate_invite_code()
        group.refresh_from_db()
        assert group.is_invite_code_valid() is True

    def test_is_invite_code_valid_expired(self, group):
        group.generate_invite_code()
        group.refresh_from_db()
        group.invite_code_expires_at = timezone.now() - timedelta(days=1)
        group.save(update_fields=["invite_code_expires_at"])
        assert group.is_invite_code_valid() is False

    def test_generate_invite_code_replaces_old(self, group):
        group.generate_invite_code()
        group.refresh_from_db()
        old_code = group.invite_code
        group.generate_invite_code()
        group.refresh_from_db()
        assert group.invite_code != old_code

    def test_generate_invite_code_custom_validity(self, group):
        group.generate_invite_code(validity_days=7)
        group.refresh_from_db()
        expected_min = timezone.now() + timedelta(days=6)
        expected_max = timezone.now() + timedelta(days=8)
        assert expected_min < group.invite_code_expires_at < expected_max


class TestGroupOwnership:
    def test_get_earliest_admin(self, user1, user2):
        g = Group.objects.create(name="تست", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        Membership.objects.create(user=user2, group=g, role="admin")
        earliest = g.get_earliest_admin()
        # Should be the first admin that is NOT the owner
        assert earliest is not None
        assert earliest.user == user2

    def test_get_earliest_admin_no_other_admin(self, user1):
        g = Group.objects.create(name="تست", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        assert g.get_earliest_admin() is None

    def test_get_earliest_admin_ignores_member_role(self, user1, user2):
        g = Group.objects.create(name="تست", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        Membership.objects.create(user=user2, group=g, role="member")
        assert g.get_earliest_admin() is None


class TestGroupSafeDeletion:
    def test_delete_cascades_safely(self, user1, user2):
        g = Group.objects.create(name="حذف", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        Membership.objects.create(user=user2, group=g)
        exp = Expense.objects.create(
            group=g,
            paid_by=user1,
            description="test",
            total_amount=100000,
            split_type="equal",
            is_confirmed=True,
        )
        ExpenseSplit.objects.create(expense=exp, user=user1, amount=50000)
        item = ExpenseItem.objects.create(expense=exp, name="item", total_amount=50000)
        ExpenseItemShare.objects.create(item=item, user=user1, amount=50000)
        ActivityLog.objects.create(group=g, user=user1, action="group_created", description="test")
        Balance.objects.create(user=user1, group=g, amount=0)

        gid = g.pk
        g.delete()

        assert not Group.objects.filter(pk=gid).exists()
        assert not Membership.objects.filter(group_id=gid).exists()
        assert not Expense.objects.filter(group_id=gid).exists()
        assert not ExpenseSplit.objects.filter(expense__group_id=gid).exists()
        assert not ExpenseItem.objects.filter(expense__group_id=gid).exists()
        assert not ExpenseItemShare.objects.filter(item__expense__group_id=gid).exists()
        assert not ActivityLog.objects.filter(group_id=gid).exists()
        assert not Balance.objects.filter(group_id=gid).exists()


# ══════════════════════════════════════════════════════════════
# MODEL __str__ METHODS
# ══════════════════════════════════════════════════════════════


class TestModelStrings:
    def test_membership_str(self, group_with_members):
        g, m1, m2 = group_with_members
        s = str(m1)
        assert "09111111111" in s or "تست گروه" in s

    def test_expense_str(self, group, user1):
        exp = Expense.objects.create(
            group=group,
            paid_by=user1,
            description="شام رستوران",
            total_amount=150000,
            split_type="equal",
        )
        s = str(exp)
        assert "شام رستوران" in s
        assert "150000" in s

    def test_expense_split_str(self, group, user1):
        exp = Expense.objects.create(
            group=group,
            paid_by=user1,
            description="test",
            total_amount=100000,
            split_type="equal",
        )
        split = ExpenseSplit.objects.create(expense=exp, user=user1, amount=50000)
        s = str(split)
        assert "50000" in s

    def test_expense_item_str(self, group, user1):
        exp = Expense.objects.create(
            group=group,
            paid_by=user1,
            description="test",
            total_amount=100000,
            split_type="itemized",
        )
        item = ExpenseItem.objects.create(expense=exp, name="پیتزا", total_amount=80000)
        s = str(item)
        assert "پیتزا" in s
        assert "80000" in s

    def test_expense_item_share_str(self, group, user1):
        exp = Expense.objects.create(
            group=group,
            paid_by=user1,
            description="test",
            total_amount=100000,
            split_type="itemized",
        )
        item = ExpenseItem.objects.create(expense=exp, name="test", total_amount=50000)
        share = ExpenseItemShare.objects.create(item=item, user=user1, amount=25000)
        s = str(share)
        assert "25000" in s

    def test_activity_log_str(self, group, user1):
        log = ActivityLog.objects.create(
            group=group, user=user1, action="expense_created", description="test"
        )
        s = str(log)
        assert "expense_created" in s
        assert "09111111111" in s

    def test_settlement_str(self, group, user1, user2):
        settlement = Settlement.objects.create(
            group=group,
            from_user=user2,
            to_user=user1,
            amount=50000,
            created_by=user2,
        )
        s = str(settlement)
        # Settlement model has no custom __str__, so default Django representation
        assert "Settlement" in s or "settlement" in s.lower()
