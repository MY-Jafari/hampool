"""
Service layer for the groups module.

This module contains all core business logic for managing groups, members,
expenses, and balances.  Every critical write operation is wrapped in an
atomic database transaction to guarantee that the database never ends up
in an inconsistent state.  Events are published **only after** a
transaction commits successfully, ensuring side‑effects (audit logs,
notifications, etc.) reflect what was actually persisted.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Sum
from django.contrib.auth import get_user_model

from apps.groups.models import (
    Group,
    Membership,
    Expense,
    ExpenseSplit,
    ExpenseItem,
    ExpenseItemShare,
)
from apps.groups.events import (
    GroupCreated as GroupCreatedEvent,
    MemberJoined as MemberJoinedEvent,
    MemberLeft as MemberLeftEvent,
    ExpenseCreated as ExpenseCreatedEvent,
    ExpenseConfirmed as ExpenseConfirmedEvent,
    ExpenseDeleted as ExpenseDeletedEvent,
)
from core.events import EventBus

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

        EventBus.publish(GroupCreatedEvent(group=group))
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

        EventBus.publish(MemberJoinedEvent(membership=membership))
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

        EventBus.publish(MemberJoinedEvent(membership=membership))
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

            # ── Owner logic ─────────────────────────────────────
            if is_owner:
                if is_self and group.memberships.count() == 1:
                    group.delete()
                    return {"detail": ("You were the only member. " "The group has been deleted.")}
                elif is_self:
                    earliest_admin = group.get_earliest_admin()
                    if earliest_admin:
                        group.owner = earliest_admin.user
                        group.save(update_fields=["owner"])
                        Membership.objects.get(group=group, user=requested_by).delete()
                        EventBus.publish(MemberLeftEvent(group=group, user=requested_by))
                        return {"detail": ("Ownership transferred. " "You have left the group.")}
                    else:
                        raise ValueError(
                            "Cannot leave without another admin. " "Delete the group instead."
                        )
                else:
                    raise PermissionError("The group owner cannot be removed by others.")

            # ── Non‑owner removal ──────────────────────────────
            is_admin = Membership.objects.filter(
                user=requested_by, group=group, role="admin"
            ).exists()
            if not (is_admin or is_self):
                raise PermissionError("Permission denied.")

            Membership.objects.get(group=group, user=user_to_remove).delete()
            EventBus.publish(MemberLeftEvent(group=group, user=user_to_remove))

            # Promote the earliest member if no admins remain
            if not group.memberships.filter(role="admin").exists():
                first_member = group.memberships.order_by("joined_at").first()
                if first_member:
                    first_member.role = "admin"
                    first_member.save(update_fields=["role"])

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

            # Promote if no admins left
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
    """

    def create_expense(self, *, group_id: int, paid_by: User, validated_data: dict) -> Expense:
        """
        Create an expense together with its splits or items.

        ``validated_data`` is the output of
        :class:`ExpenseCreateSerializer`.  User references are
        expected to be resolved to :class:`User` instances by the
        serializer.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            splits_data = validated_data.pop("splits", [])
            items_data = validated_data.pop("items", [])

            expense = Expense.objects.create(group=group, paid_by=paid_by, **validated_data)

            split_type = expense.split_type
            if split_type in ("equal", "exact"):
                for s in splits_data:
                    ExpenseSplit.objects.create(
                        expense=expense, user_id=s["user"].pk, amount=s["amount"]
                    )
            elif split_type == "percentage":
                total = expense.total_amount
                for s in splits_data:
                    user = s["user"]
                    amount = int(total * s["percentage"] / 100)
                    ExpenseSplit.objects.create(expense=expense, user_id=user.pk, amount=amount)
            elif split_type == "itemized":
                for item_data in items_data:
                    shares = item_data.pop("shares")
                    item = ExpenseItem.objects.create(expense=expense, **item_data)
                    for share in shares:
                        ExpenseItemShare.objects.create(
                            item=item, user_id=share["user"].pk, amount=share["amount"]
                        )

        EventBus.publish(ExpenseCreatedEvent(expense=expense))
        return expense

    def confirm_expense(self, *, expense_id: int, confirmed_by: User) -> Expense:
        """
        Mark an expense as confirmed.

        Raises ``ValueError`` if the expense is already confirmed.
        """
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            if expense.is_confirmed:
                raise ValueError("Expense already confirmed.")
            expense.is_confirmed = True
            expense.save()

        EventBus.publish(ExpenseConfirmedEvent(expense=expense, confirmed_by=confirmed_by))
        return expense

    def delete_expense(self, *, expense_id: int, deleted_by: User) -> None:
        """Delete an expense (and its splits/items via CASCADE)."""
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            expense.delete()

        EventBus.publish(ExpenseDeletedEvent(expense=expense, deleted_by=deleted_by))


class BalanceService:
    """
    Read‑only balance calculations.

    These methods do not modify data and therefore do not run inside
    explicit transactions.
    """

    def get_balances(self, group_id: int) -> list[dict]:
        """
        Return a list of net balances for every member of the group.

        Each dictionary contains the user's phone number, full name,
        total paid, total owed, and net balance (positive = creditor).
        """
        group = get_object_or_404(Group, pk=group_id)
        members = group.memberships.select_related("user").all()
        balances = []

        for m in members:
            user = m.user
            paid = (
                Expense.objects.filter(group=group, paid_by=user, is_confirmed=True).aggregate(
                    total=Sum("total_amount")
                )["total"]
                or 0
            )
            owed = (
                ExpenseSplit.objects.filter(
                    expense__group=group, expense__is_confirmed=True, user=user, settled=False
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            )
            balances.append(
                {
                    "phone_number": user.phone_number,
                    "full_name": user.full_name or user.phone_number,
                    "paid": paid,
                    "owed": owed,
                    "net": paid - owed,
                }
            )

        return balances
