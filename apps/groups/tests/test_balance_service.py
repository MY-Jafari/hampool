"""
Unit tests for BalanceService.recalculate_balance_for_user — pytest edition.

Verifies net balance calculation from confirmed expenses, unsettled splits,
and confirmed settlements.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from apps.groups.models import Group, Membership, Expense, ExpenseSplit, Balance
from apps.groups.services import BalanceService, SettlementService

User = get_user_model()


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------


@pytest.fixture
def user1(db):
    """First test user."""
    return User.objects.create_user(phone_number="09111111111")


@pytest.fixture
def user2(db):
    """Second test user."""
    return User.objects.create_user(phone_number="09222222222")


@pytest.fixture
def group(user1, user2):
    """Group with both users as members and zero initial balances."""
    group = Group.objects.create(name="Balance Test Group", created_by=user1, owner=user1)
    for user in (user1, user2):
        Membership.objects.create(user=user, group=group)
        Balance.objects.get_or_create(user=user, group=group, defaults={"amount": 0})
    return group


# ------------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------------


def _get_balance(user, group):
    """Return net balance amount for a user in a group."""
    return Balance.objects.get(user=user, group=group).amount


def _create_confirmed_expense(paid_by, splits, group):
    """
    Create a confirmed expense, persist its splits, and immediately
    recalculate balances for all involved users (the same way the
    original unit tests did).
    """
    total = sum(amount for _, amount in splits)
    expense = Expense.objects.create(
        group=group,
        paid_by=paid_by,
        total_amount=total,
        split_type="exact",
        is_confirmed=True,
    )
    for user, amount in splits:
        ExpenseSplit.objects.create(expense=expense, user=user, amount=amount)

    affected_users = {paid_by} | {user for user, _ in splits}
    for user in affected_users:
        BalanceService.recalculate_balance_for_user(user, group)
    return expense


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------


def test_simple_debt(user1, user2, group):
    """User1 pays, User2 owes. Balances must be +100 and -100."""
    _create_confirmed_expense(user1, [(user1, 100), (user2, 100)], group)
    assert _get_balance(user1, group) == 100
    assert _get_balance(user2, group) == -100


def test_settlement_clears_balance(user1, user2, group):
    """After creating and confirming a settlement, both balances return to zero."""
    _create_confirmed_expense(user1, [(user1, 100), (user2, 100)], group)

    settlement_service = SettlementService()
    settlement = settlement_service.create_settlement(
        group_id=group.id,
        from_user=user2,  # debtor (negative balance)
        to_user_id=user1.id,
        amount=100,
        created_by=user2,
    )
    settlement_service.confirm_settlement(settlement_id=settlement.id, confirmed_by=user1)

    assert _get_balance(user1, group) == 0
    assert _get_balance(user2, group) == 0


def test_self_payment_no_effect(user1, user2, group):
    """A user paying only for themselves does not create any debt."""
    _create_confirmed_expense(user1, [(user1, 150)], group)
    assert _get_balance(user1, group) == 0
    assert _get_balance(user2, group) == 0


def test_group_balance_sums_to_zero(user1, user2, group):
    """Sum of all balances in a group must always equal zero."""
    _create_confirmed_expense(user1, [(user1, 200), (user2, 100)], group)
    _create_confirmed_expense(user2, [(user1, 50), (user2, 100)], group)

    total = Balance.objects.filter(group=group).aggregate(total=Sum("amount"))["total"]
    assert total == 0


def test_cross_debt_netting(user1, user2, group):
    """Two-way debts are correctly netted."""
    _create_confirmed_expense(user1, [(user1, 200), (user2, 100)], group)  # U2 owes 100
    _create_confirmed_expense(user2, [(user1, 150), (user2, 50)], group)  # U1 owes 150

    # After netting: U1 net = (100) - (150) = -50; U2 net = (150) - (100) = +50
    assert _get_balance(user1, group) == -50
    assert _get_balance(user2, group) == 50
