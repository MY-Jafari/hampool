"""
Unit tests for BalanceService.recalculate_balance_for_user.

These tests verify that net balances are calculated correctly
from confirmed expenses, unsettled splits, and confirmed settlements.
"""

from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from django.db.models import Sum
from apps.groups.models import Group, Membership, Expense, ExpenseSplit, Balance
from apps.groups.services import BalanceService, SettlementService

User = get_user_model()


class BalanceServiceTests(TransactionTestCase):
    """Tests for the BalanceService to ensure financial correctness."""

    def setUp(self):
        """Create two users, a group, and add both users as members with zero balances."""
        self.user1 = User.objects.create_user(phone_number="09111111111")
        self.user2 = User.objects.create_user(phone_number="09222222222")
        self.group = Group.objects.create(
            name="Balance Test Group", created_by=self.user1, owner=self.user1
        )
        # Create memberships and initial zero balances
        for user in [self.user1, self.user2]:
            Membership.objects.create(user=user, group=self.group)
            Balance.objects.get_or_create(user=user, group=self.group, defaults={"amount": 0})

    # ── Helper methods ─────────────────────────────────────────────

    def _get_balance(self, user):
        """Return the net balance amount for a user in the test group."""
        balance = Balance.objects.get(user=user, group=self.group)
        return balance.amount

    def _create_confirmed_expense(self, paid_by, splits):
        """
        Create a confirmed expense with the given payer and splits.

        Args:
            paid_by: The user who paid.
            splits: A list of (user, amount) tuples.

        Returns:
            The created Expense instance.
        """
        total = sum(amount for _, amount in splits)
        expense = Expense.objects.create(
            group=self.group,
            paid_by=paid_by,
            total_amount=total,
            split_type="exact",
            is_confirmed=True,
        )
        for user, amount in splits:
            ExpenseSplit.objects.create(expense=expense, user=user, amount=amount)

        # Recalculate balances for all affected users
        affected_users = {paid_by} | {user for user, _ in splits}
        for user in affected_users:
            BalanceService.recalculate_balance_for_user(user, self.group)
        return expense

    # ── Tests ──────────────────────────────────────────────────────

    def test_simple_debt(self):
        """User1 pays, User2 owes. Net balances should be +100 and -100."""
        self._create_confirmed_expense(
            paid_by=self.user1, splits=[(self.user1, 100), (self.user2, 100)]
        )
        self.assertEqual(self._get_balance(self.user1), 100)
        self.assertEqual(self._get_balance(self.user2), -100)

    def test_settlement_clears_balance(self):
        """After a settlement, both balances should be zero."""
        self._create_confirmed_expense(
            paid_by=self.user1, splits=[(self.user1, 100), (self.user2, 100)]
        )
        settlement_service = SettlementService()
        settlement = settlement_service.create_settlement(
            group_id=self.group.id,
            from_user=self.user2,  # debtor (negative balance)
            to_user_id=self.user1.id,
            amount=100,
            created_by=self.user2,
        )
        settlement_service.confirm_settlement(settlement_id=settlement.id, confirmed_by=self.user1)
        self.assertEqual(self._get_balance(self.user1), 0)
        self.assertEqual(self._get_balance(self.user2), 0)

    def test_self_payment_no_effect(self):
        """Paying for oneself does not affect balances."""
        self._create_confirmed_expense(paid_by=self.user1, splits=[(self.user1, 150)])
        self.assertEqual(self._get_balance(self.user1), 0)
        self.assertEqual(self._get_balance(self.user2), 0)

    def test_group_balance_sums_to_zero(self):
        """The sum of all balances in a group must always be zero."""
        self._create_confirmed_expense(
            paid_by=self.user1, splits=[(self.user1, 200), (self.user2, 100)]
        )
        self._create_confirmed_expense(
            paid_by=self.user2, splits=[(self.user1, 50), (self.user2, 100)]
        )
        total = Balance.objects.filter(group=self.group).aggregate(total=Sum("amount"))["total"]
        self.assertEqual(total, 0)

    def test_cross_debt_netting(self):
        """Cross debts should net out correctly."""
        self._create_confirmed_expense(
            paid_by=self.user1, splits=[(self.user1, 200), (self.user2, 100)]  # User2 owes 100
        )
        self._create_confirmed_expense(
            paid_by=self.user2, splits=[(self.user1, 150), (self.user2, 50)]  # User1 owes 150
        )
        # User1 paid 300, owed splits: 200+150=350 → net = 300-350 = -50
        # User2 paid 200, owed splits: 100+50=150 → net = 200-150 = 50
        self.assertEqual(self._get_balance(self.user1), -50)
        self.assertEqual(self._get_balance(self.user2), 50)
