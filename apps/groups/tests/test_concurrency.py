import threading
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from apps.groups.models import Group, Balance
from apps.groups.services import ExpenseService

User = get_user_model()


class ConcurrentExpenseTest(TransactionTestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(phone_number="09111111111")
        self.user2 = User.objects.create_user(phone_number="09222222222")
        self.group = Group.objects.create(
            name="Concurrency Test", created_by=self.user1, owner=self.user1
        )
        # Add both to group
        from apps.groups.models import Membership

        Membership.objects.create(user=self.user1, group=self.group)
        Membership.objects.create(user=self.user2, group=self.group)

    def test_concurrent_expense_creation(self):
        errors = []

        def create_expense(user):
            try:
                service = ExpenseService()
                service.create_expense(
                    group_id=self.group.id,
                    paid_by=user,
                    validated_data={
                        "description": "Test",
                        "total_amount": 100,
                        "split_type": "equal",
                        "splits": [
                            {"user": self.user1, "amount": 50},
                            {"user": self.user2, "amount": 50},
                        ],
                    },
                )
            except Exception as e:
                errors.append(e)

        threads = []
        for i in range(5):
            t = threading.Thread(target=create_expense, args=(self.user1,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)

        # Check balances
        balance1 = Balance.objects.get(user=self.user1, group=self.group)
        balance2 = Balance.objects.get(user=self.user2, group=self.group)
        self.assertEqual(balance1.amount, 250)  # 5 expenses * 50 each
        self.assertEqual(balance2.amount, -250)
