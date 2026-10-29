"""
seed_demo_data.py — Populates database with realistic demo data for Hampool.

Usage:
    python manage.py seed_demo_data
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from apps.groups.models import (
    Group,
    Membership,
    Expense,
    ExpenseSplit,
    Settlement,
    ActivityLog,
)
from apps.groups.services import BalanceService

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with demo users, groups, expenses, and settlements."

    def handle(self, *args, **options):
        self.stdout.write("--- Seeding Hampool Demo Data ---")

        # 1. Create or get test users
        users_data = [
            {
                "phone_number": "09121234567",
                "full_name": "علی رضایی",
                "email": "ali.rezaei@example.com",
                "password": "Password123!",
            },
            {
                "phone_number": "09129876543",
                "full_name": "سارا کاظمی",
                "email": "sara.kazemi@example.com",
                "password": "Password123!",
            },
            {
                "phone_number": "09351112233",
                "full_name": "محمد محمدی",
                "email": "m.mohammadi@example.com",
                "password": "Password123!",
            },
            {
                "phone_number": "09904445566",
                "full_name": "نگین امیری",
                "email": "negin.amiri@example.com",
                "password": "Password123!",
            },
        ]

        users = {}
        for udata in users_data:
            user, created = User.objects.get_or_create(
                phone_number=udata["phone_number"],
                defaults={
                    "full_name": udata["full_name"],
                    "email": udata["email"],
                    "is_active": True,
                    "language": "fa",
                },
            )
            user.is_active = True
            user.set_password(udata["password"])
            user.save()
            users[udata["phone_number"]] = user
            action_label = "Created" if created else "Updated"
            self.stdout.write(f"  {action_label} user: {user.full_name} ({user.phone_number})")

        ali = users["09121234567"]
        sara = users["09129876543"]
        mohammad = users["09351112233"]
        negin = users["09904445566"]

        # 2. Create Group 1: سفر شمال ۱۴۰۳
        group1, created = Group.objects.get_or_create(
            name="سفر شمال ۱۴۰۳",
            defaults={
                "description": "هزینه‌های ویلا، خریدها، بنزین و کافه سفر چالوس",
                "budget_limit": 10_000_000,
                "created_by": ali,
                "owner": ali,
            },
        )
        if not group1.invite_code:
            group1.generate_invite_code(validity_days=7)

        # Memberships for Group 1
        Membership.objects.get_or_create(group=group1, user=ali, defaults={"role": "admin"})
        Membership.objects.get_or_create(group=group1, user=sara, defaults={"role": "admin"})
        Membership.objects.get_or_create(group=group1, user=mohammad, defaults={"role": "member"})
        Membership.objects.get_or_create(group=group1, user=negin, defaults={"role": "member"})

        # Group 1 Expenses
        # Expense 1: اجاره ویلا چالوس (Paid by Ali, 3,000,000 T, equal among 4)
        exp1, _ = Expense.objects.get_or_create(
            group=group1,
            description="اجاره ویلا چالوس",
            defaults={
                "paid_by": ali,
                "total_amount": 3_000_000,
                "split_type": "equal",
                "is_confirmed": True,
            },
        )
        for u in [ali, sara, mohammad, negin]:
            ExpenseSplit.objects.get_or_create(
                expense=exp1, user=u, defaults={"amount": 750_000, "settled": False}
            )

        # Expense 2: خرید سوپرمارکت و میوه (Paid by Sara, 1,200,000 T, equal among 4)
        exp2, _ = Expense.objects.get_or_create(
            group=group1,
            description="خرید سوپرمارکت و میوه",
            defaults={
                "paid_by": sara,
                "total_amount": 1_200_000,
                "split_type": "equal",
                "is_confirmed": True,
            },
        )
        for u in [ali, sara, mohammad, negin]:
            ExpenseSplit.objects.get_or_create(
                expense=exp2, user=u, defaults={"amount": 300_000, "settled": False}
            )

        # Expense 3: شام رستوران باران (Paid by Ali, 1,800,000 T, exact split)
        exp3, _ = Expense.objects.get_or_create(
            group=group1,
            description="شام رستوران باران",
            defaults={
                "paid_by": ali,
                "total_amount": 1_800_000,
                "split_type": "exact",
                "is_confirmed": True,
            },
        )
        exact_shares = [(ali, 450_000), (sara, 550_000), (mohammad, 400_000), (negin, 400_000)]
        for u, amt in exact_shares:
            ExpenseSplit.objects.get_or_create(
                expense=exp3, user=u, defaults={"amount": amt, "settled": False}
            )

        # Expense 4: بنزین و عوارضی آزادراه (Paid by Mohammad, 400,000 T, equal among 4)
        exp4, _ = Expense.objects.get_or_create(
            group=group1,
            description="بنزین و عوارضی آزادراه",
            defaults={
                "paid_by": mohammad,
                "total_amount": 400_000,
                "split_type": "equal",
                "is_confirmed": True,
            },
        )
        for u in [ali, sara, mohammad, negin]:
            ExpenseSplit.objects.get_or_create(
                expense=exp4, user=u, defaults={"amount": 100_000, "settled": False}
            )

        # Expense 5: کافه و بستنی ساحلی (Paid by Negin, 350,000 T, Unconfirmed)
        exp5, _ = Expense.objects.get_or_create(
            group=group1,
            description="کافه و بستنی لب ساحل",
            defaults={
                "paid_by": negin,
                "total_amount": 350_000,
                "split_type": "equal",
                "is_confirmed": False,
            },
        )
        for u in [ali, sara, mohammad, negin]:
            ExpenseSplit.objects.get_or_create(
                expense=exp5, user=u, defaults={"amount": 87_500, "settled": False}
            )

        # Settlements for Group 1
        # Confirmed Settlement 1: Sara -> Ali 500,000 Toman
        s1, _ = Settlement.objects.get_or_create(
            group=group1,
            from_user=sara,
            to_user=ali,
            amount=500_000,
            defaults={
                "status": "confirmed",
                "created_by": sara,
                "confirmed_by": ali,
                "confirmed_at": timezone.now() - timedelta(days=1),
            },
        )

        # Confirmed Settlement 2: Mohammad -> Ali 300,000 Toman
        s2, _ = Settlement.objects.get_or_create(
            group=group1,
            from_user=mohammad,
            to_user=ali,
            amount=300_000,
            defaults={
                "status": "confirmed",
                "created_by": mohammad,
                "confirmed_by": ali,
                "confirmed_at": timezone.now() - timedelta(hours=6),
            },
        )

        # Pending Settlement 3: Negin -> Ali 400,000 Toman
        s3, _ = Settlement.objects.get_or_create(
            group=group1,
            from_user=negin,
            to_user=ali,
            amount=400_000,
            defaults={
                "status": "pending",
                "created_by": negin,
            },
        )

        # 3. Create Group 2: هم‌خانه‌ها — فردوس
        group2, created = Group.objects.get_or_create(
            name="هم‌خانه‌ها — فردوس",
            defaults={
                "description": "شارژ ساختمان، قبوض آب و برق، نظافت و خرید خانه",
                "budget_limit": 6_000_000,
                "created_by": sara,
                "owner": sara,
            },
        )
        if not group2.invite_code:
            group2.generate_invite_code(validity_days=7)

        # Memberships for Group 2
        Membership.objects.get_or_create(group=group2, user=sara, defaults={"role": "admin"})
        Membership.objects.get_or_create(group=group2, user=ali, defaults={"role": "admin"})
        Membership.objects.get_or_create(group=group2, user=mohammad, defaults={"role": "member"})

        # Group 2 Expenses
        exp6, _ = Expense.objects.get_or_create(
            group=group2,
            description="شارژ ساختمان و نظافت راه‌پله",
            defaults={
                "paid_by": ali,
                "total_amount": 1_500_000,
                "split_type": "equal",
                "is_confirmed": True,
            },
        )
        for u in [sara, ali, mohammad]:
            ExpenseSplit.objects.get_or_create(
                expense=exp6, user=u, defaults={"amount": 500_000, "settled": False}
            )

        exp7, _ = Expense.objects.get_or_create(
            group=group2,
            description="قبض برق و گاز",
            defaults={
                "paid_by": sara,
                "total_amount": 600_000,
                "split_type": "equal",
                "is_confirmed": True,
            },
        )
        for u in [sara, ali, mohammad]:
            ExpenseSplit.objects.get_or_create(
                expense=exp7, user=u, defaults={"amount": 200_000, "settled": False}
            )

        # Activity Logs
        ActivityLog.objects.get_or_create(
            group=group1,
            user=ali,
            action="group_created",
            defaults={"description": "گروه سفر شمال ۱۴۰۳ توسط علی رضایی ایجاد شد."},
        )
        ActivityLog.objects.get_or_create(
            group=group1,
            user=ali,
            action="expense_created",
            defaults={"description": "هزینه اجاره ویلا چالوس به مبلغ ۳,۰۰۰,۰۰۰ تومان ثبت شد."},
        )
        ActivityLog.objects.get_or_create(
            group=group1,
            user=sara,
            action="settlement_confirmed",
            defaults={"description": "تسویه حساب ۵۰۰,۰۰۰ تومانی سارا کاظمی با علی رضایی تایید شد."},
        )

        # Recalculate balances for all users in both groups
        with transaction.atomic():
            for g in [group1, group2]:
                for m in g.memberships.all():
                    BalanceService.recalculate_balance_for_user(m.user, g)

        self.stdout.write(self.style.SUCCESS("✓ Successfully seeded demo data!"))
        self.stdout.write(self.style.SUCCESS("  Test User: 09121234567 | Password: Password123!"))
        self.stdout.write(self.style.SUCCESS("  Groups: سفر شمال ۱۴۰۳, هم‌خانه‌ها — فردوس"))
