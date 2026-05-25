"""
Service layer for the groups module.

This module contains all core business logic for managing groups, members,
expenses, and balances.  Every critical write operation is wrapped in an
atomic database transaction to guarantee that the database never ends up
in an inconsistent state.  Events are published **inside** the transaction
via the Outbox pattern and dispatched asynchronously after commit,
ensuring side‑effects (audit logs, notifications, etc.) reflect what
was actually persisted.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Sum
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.groups.models import (
    Group,
    Membership,
    Expense,
    ExpenseSplit,
    ExpenseItem,
    ExpenseItemShare,
    Balance,
    Settlement,
)
from apps.outbox.services import OutboxService
from apps.outbox.tasks import dispatch_outbox_event

User = get_user_model()


class GroupService:
    """
    Business logic for groups, memberships and ownership.

    All methods that modify the database use atomic transactions.
    Permission checks are performed inside the service; errors are
    raised as ``ValueError`` or ``PermissionError`` so that views
    can translate them into appropriate HTTP responses.
    """

    def create_group(
        self, *, name: str, description: str, budget_limit: int, created_by: User
    ) -> Group:
        """
        Create a new group and add *created_by* as its owner/admin.

        Returns the newly created :class:`Group` instance.
        """
        with transaction.atomic():
            group = Group.objects.create(
                name=name,
                description=description,
                budget_limit=budget_limit,
                created_by=created_by,
                owner=created_by,
            )
            Membership.objects.create(user=created_by, group=group, role="admin")
            group.generate_invite_code()
            outbox_event = OutboxService.publish_event("GroupCreated", {"group_id": group.id})
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return group

    def add_member(self, *, group_id: int, phone_number: str) -> Membership:
        """
        Add an existing user to a group by phone number.

        The caller must already be a group admin (enforced by the view).
        Returns the new :class:`Membership`.
        Raises ``ValueError`` if the user is already a member.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user = get_object_or_404(User, phone_number=phone_number)

            membership, created = Membership.objects.get_or_create(
                user=user, group=group, defaults={"role": "member"}
            )
            if not created:
                raise ValueError("User is already a member.")
            outbox_event = OutboxService.publish_event(
                "MemberJoined", {"membership_id": membership.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return membership

    def join_by_invite_code(self, *, invite_code: str, user: User) -> Membership:
        """
        Join a group using a valid invitation code.

        Raises ``ValueError`` if the code is invalid, expired, or the
        user is already a member.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, invite_code=invite_code)
            if not group.is_invite_code_valid():
                raise ValueError("Invite code is invalid or expired.")

            membership, created = Membership.objects.get_or_create(
                user=user, group=group, defaults={"role": "member"}
            )
            if not created:
                raise ValueError("You are already a member of this group.")
            outbox_event = OutboxService.publish_event(
                "MemberJoined", {"membership_id": membership.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return membership

    def remove_member(self, *, group_id: int, user_id: int, requested_by: User) -> dict:
        """
        Remove a member (or let a member leave) with ownership rules.

        Returns a dictionary containing a detail message.
        Raises ``PermissionError`` when the action is forbidden,
        ``ValueError`` when the operation cannot be completed
        (e.g. owner tries to leave without another admin).
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user_to_remove = get_object_or_404(User, pk=user_id)
            is_owner = user_to_remove == group.owner
            is_self = requested_by == user_to_remove

            if is_owner:
                if is_self and group.memberships.count() == 1:
                    group.delete()
                    return {"detail": "You were the only member. The group has been deleted."}
                elif is_self:
                    earliest_admin = group.get_earliest_admin()
                    if earliest_admin:
                        group.owner = earliest_admin.user
                        group.save(update_fields=["owner"])
                        Membership.objects.get(group=group, user=requested_by).delete()
                        outbox_event = OutboxService.publish_event(
                            "MemberLeft",
                            {"group_id": group.id, "user_id": requested_by.id},
                        )
                        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
                        return {"detail": "Ownership transferred. You have left the group."}
                    else:
                        raise ValueError(
                            "Cannot leave without another admin. Delete the group instead."
                        )
                else:
                    raise PermissionError("The group owner cannot be removed by others.")

            is_admin = Membership.objects.filter(
                user=requested_by, group=group, role="admin"
            ).exists()
            if not (is_admin or is_self):
                raise PermissionError("Permission denied.")

            Membership.objects.get(group=group, user=user_to_remove).delete()
            outbox_event = OutboxService.publish_event(
                "MemberLeft",
                {"group_id": group.id, "user_id": user_to_remove.id},
            )
            if not group.memberships.filter(role="admin").exists():
                first_member = group.memberships.order_by("joined_at").first()
                if first_member:
                    first_member.role = "admin"
                    first_member.save(update_fields=["role"])
            transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))

        return {"detail": "Member removed."}

    def change_role(
        self, *, group_id: int, user_id: int, new_role: str, requested_by: User
    ) -> Membership:
        """
        Change a member's role (admin ↔ member).

        The owner's role cannot be changed.
        Raises ``PermissionError`` if the target is the owner,
        ``ValueError`` if the role is invalid.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user = get_object_or_404(User, pk=user_id)
            membership = get_object_or_404(Membership, group=group, user=user)

            if user == group.owner:
                raise PermissionError("Cannot change the role of the group owner.")
            if new_role not in ("admin", "member"):
                raise ValueError("Invalid role.")

            membership.role = new_role
            membership.save()

            if not group.memberships.filter(role="admin").exists():
                first_member = group.memberships.order_by("joined_at").first()
                if first_member:
                    first_member.role = "admin"
                    first_member.save(update_fields=["role"])

        return membership

    def transfer_ownership(self, *, group_id: int, new_owner_id: int, current_owner: User) -> Group:
        """
        Transfer group ownership to another admin.

        Only the current owner may call this.
        Raises ``PermissionError`` if *current_owner* is not the owner.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            if current_owner != group.owner:
                raise PermissionError("Only the group owner can transfer ownership.")

            new_owner = get_object_or_404(User, pk=new_owner_id)
            membership = get_object_or_404(Membership, group=group, user=new_owner)

            if membership.role != "admin":
                membership.role = "admin"
                membership.save(update_fields=["role"])

            group.owner = new_owner
            group.save(update_fields=["owner"])

        return group


class ExpenseService:
    """
    Business logic for expenses.

    All write operations are atomic.  Events are fired after the
    transaction commits, ensuring side‑effects see the final state.
    Balance projections are updated synchronously inside the same
    atomic block with row‑level locking to prevent race conditions.
    """

    def create_expense(self, *, group_id: int, paid_by: User, validated_data: dict) -> Expense:
        """
        Create an expense together with its splits or items and update
        the balance projections for all affected users.

        ``validated_data`` is the output of
        :class:`ExpenseCreateSerializer`.  User references are
        expected to be resolved to :class:`User` instances by the
        serializer.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            splits_data = validated_data.pop("splits", [])
            items_data = validated_data.pop("items", [])
            total_amount = validated_data.get("total_amount", 0)

            expense = Expense.objects.create(group=group, paid_by=paid_by, **validated_data)

            split_type = expense.split_type
            if split_type == "equal":
                users = [s["user"] for s in splits_data]
                num = len(users)
                if num == 0:
                    raise ValueError("Equal split requires at least one user.")
                base = total_amount // num
                rem = total_amount % num
                splits = []
                for i, u in enumerate(users):
                    # Only add the remainder to the last user when rem > 0
                    amt = base + (1 if (rem > 0 and i == num - 1) else 0)
                    splits.append(ExpenseSplit(expense=expense, user=u, amount=amt))
                ExpenseSplit.objects.bulk_create(splits)
                # Keep total_amount as originally entered by the user — do NOT
                # overwrite it with sum(splits), because that can introduce a
                # rounding discrepancy when rem == 0.
                # total_amount is already set correctly on the expense.
            elif split_type == "exact":
                for s in splits_data:
                    ExpenseSplit.objects.create(
                        expense=expense,
                        user_id=s["user"].pk,
                        amount=s["amount"],
                    )
                # Recompute total from splits
                total = expense.splits.aggregate(Sum("amount"))["amount__sum"] or 0
                expense.total_amount = total
                expense.save(update_fields=["total_amount"])
            elif split_type == "percentage":
                for s in splits_data:
                    user = s["user"]
                    amount = int(total_amount * s["percentage"] / 100)
                    ExpenseSplit.objects.create(expense=expense, user_id=user.pk, amount=amount)
                total = expense.splits.aggregate(Sum("amount"))["amount__sum"] or 0
                expense.total_amount = total
                expense.save(update_fields=["total_amount"])
            elif split_type == "itemized":
                for item_data in items_data:
                    shares = item_data.pop("shares")
                    item = ExpenseItem.objects.create(expense=expense, **item_data)
                    for share in shares:
                        ExpenseItemShare.objects.create(
                            item=item,
                            user_id=share["user"].pk,
                            amount=share["amount"],
                        )
                # total_amount for itemized can be sum of items if not provided
                if not total_amount:
                    total = sum(item.total_amount for item in expense.items.all())
                    expense.total_amount = total
                    expense.save(update_fields=["total_amount"])

            BalanceService.update_balance_for_expense(expense)

            outbox_event = OutboxService.publish_event("ExpenseCreated", {"expense_id": expense.id})
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return expense

    def confirm_expense(self, *, expense_id: int, confirmed_by: User) -> Expense:
        """
        Mark an expense as confirmed and refresh balance projections.

        Raises ``ValueError`` if the expense is already confirmed.
        """
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            if expense.is_confirmed:
                raise ValueError("Expense already confirmed.")
            expense.is_confirmed = True
            expense.save()

            BalanceService.update_balance_for_expense(expense)

            outbox_event = OutboxService.publish_event(
                "ExpenseConfirmed",
                {"expense_id": expense.id, "confirmed_by_id": confirmed_by.id},
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return expense

    def delete_expense(self, *, expense_id: int, deleted_by: User) -> None:
        """Delete an expense (and its splits/items via CASCADE) and update balances."""
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            event_data = {"expense_id": expense.id, "deleted_by_id": deleted_by.id}
            affected_users = set()
            affected_users.add(expense.paid_by)
            for split in expense.splits.all():
                affected_users.add(split.user)
            expense.delete()

            for user in affected_users:
                BalanceService.recalculate_balance_for_user(user, expense.group)

            outbox_event = OutboxService.publish_event("ExpenseDeleted", event_data)
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))


class BalanceService:
    """
    Balance projection management.

    Balances are materialized views of net amounts.  Writes to them
    use ``select_for_update()`` to serialise concurrent operations and
    prevent race conditions.
    """

    def get_balances(self, group_id: int) -> list[dict]:
        """
        Return a list of net balances for every member of the group
        directly from the Balance projection table.

        The Balance table is the source of truth for net amounts
        after considering all confirmed expenses and settlements.
        """
        group = get_object_or_404(Group, pk=group_id)
        balance_qs = Balance.objects.filter(group=group).select_related("user")
        return [
            {
                "phone_number": b.user.phone_number,
                "full_name": b.user.full_name or b.user.phone_number,
                "net": b.amount,
            }
            for b in balance_qs
        ]

    @staticmethod
    def update_balance_for_expense(expense: Expense) -> None:
        """
        Recalculate and persist the net balance for every user affected
        by the given expense.  Must be called inside an atomic block.
        Uses ``select_for_update()`` to lock the balance rows.
        """
        group = expense.group
        users = set()
        users.add(expense.paid_by)
        for split in expense.splits.all():
            users.add(split.user)
        for user in users:
            BalanceService.recalculate_balance_for_user(user, group)

    @staticmethod
    def recalculate_balance_for_user(user: User, group: Group) -> None:
        """
        Recalculate user's net balance from confirmed expenses
        and confirmed settlements.

        Formula:
            balance = (amount_paid_for_others - own_share_owed)
                    + (settlements_received - settlements_sent)

        Notes:
        - `paid` uses Expense.total_amount directly (the user-entered value),
          NOT re-summed from splits, to avoid rounding drift.
        - `owed` counts ALL split rows for the user (settled or not) so that
          settling a split row (settled=True) removes it from owed and the
          ExpenseSplit.settled flag correctly reduces the debt.
        - Settlements affect balance directly: sent reduces debt, received
          increases credit.
        """

        balance, _ = Balance.objects.select_for_update().get_or_create(
            user=user,
            group=group,
            defaults={"amount": 0},
        )

        # Total amount this user paid on behalf of the group
        paid = (
            Expense.objects.filter(
                group=group,
                paid_by=user,
                is_confirmed=True,
            ).aggregate(
                total=Sum("total_amount")
            )["total"]
            or 0
        )

        # This user's share of group expenses (only unsettled rows count as debt)
        owed = (
            ExpenseSplit.objects.filter(
                expense__group=group,
                expense__is_confirmed=True,
                user=user,
                settled=False,
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )

        # Settlements this user sent (they paid someone → reduces their debt)
        sent = (
            Settlement.objects.filter(
                group=group,
                from_user=user,
                status="confirmed",
            ).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        # Settlements this user received (someone paid them → reduces their credit)
        received = (
            Settlement.objects.filter(
                group=group,
                to_user=user,
                status="confirmed",
            ).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        # Net balance:
        #   positive → user is owed money (creditor)
        #   negative → user owes money  (debtor)
        #
        # paid:     user fronted this much for the group      (+)
        # owed:     user's own share still outstanding        (-)
        # sent:     user has already paid back this much      (+) reduces debt
        # received: user has already received back this much  (-) reduces credit
        balance.amount = (paid - owed) + (sent - received)

        balance.save(update_fields=["amount"])


class SettlementService:
    """
    Handles settlement creation, confirmation, and reversal.

    All operations are atomic and use the Outbox pattern for event
    delivery.  Balances are updated synchronously with row‑level locking.
    """

    def create_settlement(
        self, *, group_id: int, from_user: User, to_user_id: int, amount: int, created_by: User
    ) -> Settlement:
        """
        Create a new pending settlement.

        Only a debtor (user with negative net balance) can create a
        settlement to pay off their debt.  The receiving user must
        be a creditor (positive net balance).
        """
        if from_user.pk == to_user_id:
            raise ValueError("You cannot create a settlement with yourself.")
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            to_user = get_object_or_404(User, pk=to_user_id)

            # from_user must be a debtor (owes money)
            from_balance, _ = Balance.objects.select_for_update().get_or_create(
                user=from_user, group=group, defaults={"amount": 0}
            )
            if from_balance.amount >= 0:
                raise ValueError(
                    "You can only create a settlement if you owe money (net negative)."
                )

            # to_user should be a creditor (is owed money)
            to_balance, _ = Balance.objects.select_for_update().get_or_create(
                user=to_user, group=group, defaults={"amount": 0}
            )
            if to_balance.amount <= 0:
                raise ValueError("The receiving user is not owed any money.")

            settlement = Settlement.objects.create(
                group=group,
                from_user=from_user,
                to_user=to_user,
                amount=amount,
                created_by=created_by,
            )
            outbox_event = OutboxService.publish_event(
                "SettlementCreated", {"settlement_id": settlement.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return settlement

    def confirm_settlement(self, *, settlement_id: int, confirmed_by: User) -> Settlement:
        """
        Confirm a pending settlement (only the receiving user can confirm).
        Updates balances accordingly.
        """
        with transaction.atomic():
            settlement = get_object_or_404(Settlement, pk=settlement_id, status="pending")
            if confirmed_by != settlement.to_user:
                raise PermissionError("Only the receiving user can confirm.")

            settlement.status = "confirmed"
            settlement.confirmed_by = confirmed_by
            settlement.confirmed_at = timezone.now()
            settlement.save()

            # Update balances for both involved users
            BalanceService.recalculate_balance_for_user(settlement.from_user, settlement.group)
            BalanceService.recalculate_balance_for_user(settlement.to_user, settlement.group)

            outbox_event = OutboxService.publish_event(
                "SettlementConfirmed",
                {"settlement_id": settlement.id, "confirmed_by_id": confirmed_by.id},
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return settlement

    def reverse_settlement(self, *, settlement_id: int, requested_by: User) -> Settlement:
        """
        Reverse a confirmed settlement. Only the payer can reverse.
        Creates a reversal settlement (auto‑confirmed).
        """
        with transaction.atomic():
            original = get_object_or_404(Settlement, pk=settlement_id, status="confirmed")
            if requested_by != original.from_user:
                raise PermissionError("Only the payer can reverse a settlement.")

            original.status = "reversed"
            original.save()

            # Create reversal (auto‑confirmed)
            reversal = Settlement.objects.create(
                group=original.group,
                from_user=original.from_user,
                to_user=original.to_user,
                amount=original.amount,
                status="confirmed",
                reversed_by=original,
                created_by=requested_by,
                confirmed_by=requested_by,
                confirmed_at=timezone.now(),
            )

            # Update balances for both involved users
            BalanceService.recalculate_balance_for_user(original.from_user, original.group)
            BalanceService.recalculate_balance_for_user(original.to_user, original.group)

            outbox_rev = OutboxService.publish_event(
                "SettlementReversed",
                {"settlement_id": original.id, "reversed_by_id": requested_by.id},
            )
            outbox_new = OutboxService.publish_event(
                "SettlementConfirmed",
                {"settlement_id": reversal.id, "confirmed_by_id": requested_by.id},
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_rev.pk))
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_new.pk))
        return reversal
