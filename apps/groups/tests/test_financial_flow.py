"""
Integration tests for the full financial lifecycle using pytest.

These tests verify the correctness of the core financial operations
(expenses, settlements, balances) and the min‑cash‑flow algorithm.
"""

import pytest
from django.contrib.auth import get_user_model
from apps.groups.models import Group, Membership, Balance
from apps.groups.services import (
    GroupService,
    ExpenseService,
    BalanceService,
    SettlementService,
    SettlementOptimizationService,
)

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
def user3(db):
    """Third test user (for multi‑party scenarios)."""
    return User.objects.create_user(phone_number="09333333333")


@pytest.fixture
def group(user1, user2, user3):
    """Group with three members and a budget limit."""
    group = Group.objects.create(
        name="Pytest Group",
        created_by=user1,
        owner=user1,
        budget_limit=1_000_000,
    )
    for user in [user1, user2, user3]:
        Membership.objects.create(user=user, group=group)
        Balance.objects.get_or_create(user=user, group=group, defaults={"amount": 0})
    return group


@pytest.fixture
def services():
    """Return instances of all core services."""
    return {
        "group": GroupService(),
        "expense": ExpenseService(),
        "balance": BalanceService(),
        "settlement": SettlementService(),
        "optimization": SettlementOptimizationService(),
    }


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _create_and_confirm(expense_service, group, paid_by, splits, confirmed_by):
    """Create a confirmed expense, return the expense instance."""
    total = sum(amount for _, amount in splits)
    expense = expense_service.create_expense(
        group_id=group.id,
        paid_by=paid_by,
        validated_data={
            "description": "Test expense",
            "total_amount": total,
            "split_type": "exact",
            "splits": [{"user": u, "amount": a} for u, a in splits],
        },
    )
    expense_service.confirm_expense(expense_id=expense.id, confirmed_by=confirmed_by)
    return expense


def _get_balance(user, group):
    """Return the net balance for a user in a group."""
    return Balance.objects.get(user=user, group=group).amount


# ------------------------------------------------------------------
# Test functions
# ------------------------------------------------------------------


def test_simple_debt_and_settlement(group, user1, user2, services):
    """
    User1 pays, User2 owes → User2 settles → User1 confirms → both zero.
    """
    _create_and_confirm(
        services["expense"],
        group,
        user1,
        [(user1, 200_000), (user2, 100_000)],
        user1,
    )
    assert _get_balance(user1, group) == 100_000
    assert _get_balance(user2, group) == -100_000

    # User2 (debtor) creates settlement
    s = services["settlement"].create_settlement(
        group_id=group.id,
        from_user=user2,
        to_user_id=user1.id,
        amount=100_000,
        created_by=user2,
    )
    assert s.status == "pending"

    # User1 (creditor) confirms
    services["settlement"].confirm_settlement(settlement_id=s.id, confirmed_by=user1)
    assert _get_balance(user1, group) == 0
    assert _get_balance(user2, group) == 0


def test_reverse_settlement_restores_balances(group, user1, user2, services):
    """Confirm then reverse a settlement — balances must be restored."""
    _create_and_confirm(
        services["expense"],
        group,
        user1,
        [(user1, 50_000), (user2, 150_000)],
        user1,
    )
    assert _get_balance(user1, group) == 150_000
    assert _get_balance(user2, group) == -150_000

    s = services["settlement"].create_settlement(
        group_id=group.id,
        from_user=user2,
        to_user_id=user1.id,
        amount=150_000,
        created_by=user2,
    )
    services["settlement"].confirm_settlement(settlement_id=s.id, confirmed_by=user1)
    assert _get_balance(user1, group) == 0
    assert _get_balance(user2, group) == 0

    services["settlement"].reverse_settlement(settlement_id=s.id, requested_by=user2)
    assert _get_balance(user1, group) == 150_000
    assert _get_balance(user2, group) == -150_000


def test_cross_debt_netting(group, user1, user2, services):
    """Two‑way debts should be netted correctly."""
    _create_and_confirm(
        services["expense"],
        group,
        user1,
        [(user1, 120_000), (user2, 80_000)],
        user1,
    )
    _create_and_confirm(
        services["expense"],
        group,
        user2,
        [(user1, 190_000), (user2, 110_000)],
        user1,
    )
    assert _get_balance(user1, group) == -110_000
    assert _get_balance(user2, group) == 110_000

    # Settlement from User1 to User2 for 110k
    s = services["settlement"].create_settlement(
        group_id=group.id,
        from_user=user1,
        to_user_id=user2.id,
        amount=110_000,
        created_by=user1,
    )
    services["settlement"].confirm_settlement(settlement_id=s.id, confirmed_by=user2)
    assert _get_balance(user1, group) == 0
    assert _get_balance(user2, group) == 0


def test_group_balance_sum_is_zero(group, user1, user2, services):
    """After any number of operations, Σ balances must be 0."""
    _create_and_confirm(
        services["expense"],
        group,
        user1,
        [(user1, 100_000), (user2, 200_000)],
        user1,
    )
    _create_and_confirm(
        services["expense"],
        group,
        user2,
        [(user2, 50_000), (user1, 150_000)],
        user1,
    )

    net1 = _get_balance(user1, group)
    if net1 < 0:
        s = services["settlement"].create_settlement(
            group_id=group.id,
            from_user=user1,
            to_user_id=user2.id,
            amount=abs(net1),
            created_by=user1,
        )
        services["settlement"].confirm_settlement(settlement_id=s.id, confirmed_by=user2)

    total = sum(Balance.objects.filter(group=group).values_list("amount", flat=True))
    assert total == 0


def test_min_cash_flow_suggestions(group, user1, user2, user3, services):
    """Optimization algorithm returns correct suggestions for 3 users."""
    _create_and_confirm(
        services["expense"],
        group,
        user1,
        [(user1, 200_000), (user2, 100_000)],
        user1,
    )
    _create_and_confirm(
        services["expense"],
        group,
        user2,
        [(user2, 50_000), (user3, 150_000)],
        user1,
    )
    _create_and_confirm(
        services["expense"],
        group,
        user3,
        [(user3, 100_000), (user1, 200_000)],
        user1,
    )

    result = services["optimization"].suggest_settlements(group_id=group.id)
    assert "balance_version" in result
    assert "suggestions" in result

    suggestions = result["suggestions"]
    assert len(suggestions) == 2
    total_suggested = sum(s["amount"] for s in suggestions)
    assert total_suggested == 100_000
