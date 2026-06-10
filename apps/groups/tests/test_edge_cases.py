"""
Edge‑case tests for the financial core.

Covers rounding, boundary conditions, and error states that are
critical for production correctness.
"""

import pytest
from django.contrib.auth import get_user_model
from apps.groups.models import Group, Membership, Balance
from apps.groups.services import (
    ExpenseService,
    SettlementService,
    SettlementOptimizationService,
)

User = get_user_model()


@pytest.fixture
def user1(db):
    return User.objects.create_user(phone_number="09111111111")


@pytest.fixture
def user2(db):
    return User.objects.create_user(phone_number="09222222222")


@pytest.fixture
def user3(db):
    return User.objects.create_user(phone_number="09333333333")


@pytest.fixture
def user4(db):
    return User.objects.create_user(phone_number="09444444444")


@pytest.fixture
def group(user1, user2, user3, user4):
    group = Group.objects.create(name="Edge Case Group", created_by=user1, owner=user1)
    for user in [user1, user2, user3, user4]:
        Membership.objects.create(user=user, group=group)
        Balance.objects.get_or_create(user=user, group=group, defaults={"amount": 0})
    return group


@pytest.fixture
def expense_service():
    return ExpenseService()


@pytest.fixture
def settlement_service():
    return SettlementService()


@pytest.fixture
def opt_service():
    return SettlementOptimizationService()


# ── Helpers ─────────────────────────────────────────────────────


def _create_and_confirm(expense_service, group, paid_by, splits, confirmed_by):
    """Create and confirm an expense in one step."""
    total = sum(amount for _, amount in splits)
    expense = expense_service.create_expense(
        group_id=group.id,
        paid_by=paid_by,
        validated_data={
            "description": "Test",
            "total_amount": total,
            "split_type": "exact",
            "splits": [{"user": u, "amount": a} for u, a in splits],
        },
    )
    expense_service.confirm_expense(expense_id=expense.id, confirmed_by=confirmed_by)
    return expense


def _balance(user, group):
    return Balance.objects.get(user=user, group=group).amount


# ── Equal split with odd total ─────────────────────────────────


def test_equal_split_odd_total(group, user1, user2, expense_service):
    """500,001 T split equally → sum of splits == total."""
    expense = expense_service.create_expense(
        group_id=group.id,
        paid_by=user1,
        validated_data={
            "description": "Odd split",
            "total_amount": 500_001,
            "split_type": "equal",
            "splits": [{"user": user1}, {"user": user2}],
        },
    )
    expense_service.confirm_expense(expense_id=expense.id, confirmed_by=user1)

    splits = expense.splits.order_by("amount")
    assert len(splits) == 2
    assert splits[0].amount + splits[1].amount == 500_001
    # one user gets remainder
    assert splits[0].amount != splits[1].amount


# ── Percentage split rounding ──────────────────────────────────


def test_percentage_split_rounding(group, user1, user2, user3, expense_service):
    """34% + 33% + 33% on 100,000 T → sum of splits == 100,000."""
    expense = expense_service.create_expense(
        group_id=group.id,
        paid_by=user1,
        validated_data={
            "description": "Pct rounding",
            "total_amount": 100_000,
            "split_type": "percentage",
            "splits": [
                {"user": user1, "percentage": 34},
                {"user": user2, "percentage": 33},
                {"user": user3, "percentage": 33},
            ],
        },
    )
    expense_service.confirm_expense(expense_id=expense.id, confirmed_by=user1)
    total = sum(s.amount for s in expense.splits.all())
    assert total == 100_000


# ── Settlement above debt ─────────────────────────────────────


def test_settlement_exceeds_debt(group, user1, user2, expense_service, settlement_service):
    """Cannot create settlement for more than the owed amount."""
    _create_and_confirm(
        expense_service,
        group,
        user1,
        [(user1, 50_000), (user2, 50_000)],
        user1,
    )
    # user2 owes 50k, try to settle 100k
    with pytest.raises(ValueError):
        settlement_service.create_settlement(
            group_id=group.id,
            from_user=user2,
            to_user_id=user1.id,
            amount=100_000,
            created_by=user2,
        )


# ── Self settlement ────────────────────────────────────────────


def test_self_settlement(group, user1, settlement_service):
    """Cannot create a settlement with yourself."""
    with pytest.raises(ValueError, match="yourself"):
        settlement_service.create_settlement(
            group_id=group.id,
            from_user=user1,
            to_user_id=user1.id,
            amount=10_000,
            created_by=user1,
        )


# ── Double reverse ─────────────────────────────────────────────


def test_double_reverse(group, user1, user2, expense_service, settlement_service):
    """Reversing an already reversed settlement must fail."""
    _create_and_confirm(
        expense_service,
        group,
        user1,
        [(user1, 50_000), (user2, 50_000)],
        user1,
    )
    s = settlement_service.create_settlement(
        group_id=group.id,
        from_user=user2,
        to_user_id=user1.id,
        amount=50_000,
        created_by=user2,
    )
    settlement_service.confirm_settlement(settlement_id=s.id, confirmed_by=user1)
    settlement_service.reverse_settlement(settlement_id=s.id, requested_by=user2)

    with pytest.raises(ValueError):
        settlement_service.reverse_settlement(settlement_id=s.id, requested_by=user2)


# ── Single-member group ────────────────────────────────────────


def test_single_member_group(user1, expense_service):
    """In a solo group, balances stay zero."""
    solo = Group.objects.create(name="Solo", created_by=user1, owner=user1)
    Membership.objects.create(user=user1, group=solo)
    Balance.objects.get_or_create(user=user1, group=solo, defaults={"amount": 0})

    expense = expense_service.create_expense(
        group_id=solo.id,
        paid_by=user1,
        validated_data={
            "description": "Only me",
            "total_amount": 50_000,
            "split_type": "exact",
            "splits": [{"user": user1, "amount": 50_000}],
        },
    )
    expense_service.confirm_expense(expense_id=expense.id, confirmed_by=user1)
    assert Balance.objects.get(user=user1, group=solo).amount == 0


# ── Min‑Cash‑Flow 4 users circular debt ───────────────────────


def test_min_cash_flow_four_users(group, user1, user2, user3, user4, expense_service, opt_service):
    """
    Circular debts: A→B 100, B→C 100, C→D 100, D→A 100.
    Net balances should all be 0 → no suggestions needed.
    """
    # A pays for B
    _create_and_confirm(
        expense_service,
        group,
        user1,
        [(user1, 0), (user2, 100_000)],
        user1,
    )
    # B pays for C
    _create_and_confirm(
        expense_service,
        group,
        user2,
        [(user2, 0), (user3, 100_000)],
        user1,
    )
    # C pays for D
    _create_and_confirm(
        expense_service,
        group,
        user3,
        [(user3, 0), (user4, 100_000)],
        user1,
    )
    # D pays for A
    _create_and_confirm(
        expense_service,
        group,
        user4,
        [(user4, 0), (user1, 100_000)],
        user1,
    )

    # All nets should be zero
    for u in [user1, user2, user3, user4]:
        assert _balance(u, group) == 0

    # Optimization should return empty suggestions
    result = opt_service.suggest_settlements(group_id=group.id)
    assert result["suggestions"] == []


# ── Complex group balance sum zero ─────────────────────────────


def test_complex_group_balance_sum_zero(
    group, user1, user2, user3, user4, expense_service, settlement_service
):
    """After multiple expenses and settlements, Σ balances = 0."""
    # user2 owes 100k to user1
    _create_and_confirm(
        expense_service,
        group,
        user1,
        [(user1, 200_000), (user2, 100_000)],
        user1,
    )
    # user2 owes another 200k to user3
    _create_and_confirm(
        expense_service,
        group,
        user3,
        [(user3, 50_000), (user2, 200_000)],
        user1,
    )
    # user2 is clearly a debtor now
    s = settlement_service.create_settlement(
        group_id=group.id,
        from_user=user2,
        to_user_id=user1.id,
        amount=100_000,
        created_by=user2,
    )
    settlement_service.confirm_settlement(settlement_id=s.id, confirmed_by=user1)

    total = sum(Balance.objects.filter(group=group).values_list("amount", flat=True))
    assert total == 0
