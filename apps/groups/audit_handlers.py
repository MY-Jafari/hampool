"""
Audit log handlers for group events.

These handlers are invoked by the Outbox dispatcher.  They receive a
plain dictionary (payload) containing the identifiers needed to
reconstruct the original objects from the database.  Each handler
creates an ActivityLog record to keep a permanent audit trail.
"""

from django.contrib.auth import get_user_model
from apps.groups.models import Group, Membership, Expense, Settlement, ActivityLog

User = get_user_model()


def log_group_created(payload: dict) -> None:
    group = Group.objects.get(pk=payload["group_id"])
    ActivityLog.objects.create(
        group=group,
        user=group.created_by,
        action="group_created",
        description=f'Group "{group.name}" created',
    )


def log_member_joined(payload: dict) -> None:
    membership = Membership.objects.select_related("user", "group").get(pk=payload["membership_id"])
    ActivityLog.objects.create(
        group=membership.group,
        user=membership.user,
        action="member_joined",
        description=f"{membership.user.phone_number} joined as {membership.role}",
    )


def log_member_left(payload: dict) -> None:
    group = Group.objects.get(pk=payload["group_id"])
    user = User.objects.get(pk=payload["user_id"])
    ActivityLog.objects.create(
        group=group,
        user=user,
        action="member_left",
        description=f"{user.phone_number} left the group",
    )


def log_expense_created(payload: dict) -> None:
    expense = Expense.objects.select_related("group", "paid_by").get(pk=payload["expense_id"])
    ActivityLog.objects.create(
        group=expense.group,
        user=expense.paid_by,
        action="expense_created",
        description=f'Expense "{expense.description}" created',
    )


def log_expense_confirmed(payload: dict) -> None:
    expense = Expense.objects.select_related("group").get(pk=payload["expense_id"])
    confirmed_by = User.objects.get(pk=payload["confirmed_by_id"])
    ActivityLog.objects.create(
        group=expense.group,
        user=confirmed_by,
        action="expense_confirmed",
        description=f'Expense "{expense.description}" confirmed',
    )


def log_expense_deleted(payload: dict) -> None:
    expense = Expense.objects.select_related("group").get(pk=payload["expense_id"])
    deleted_by = User.objects.get(pk=payload["deleted_by_id"])
    ActivityLog.objects.create(
        group=expense.group,
        user=deleted_by,
        action="expense_deleted",
        description=f'Expense "{expense.description}" deleted',
    )


def log_settlement_created(payload: dict) -> None:
    settlement = Settlement.objects.select_related("from_user", "to_user", "group").get(
        pk=payload["settlement_id"]
    )
    ActivityLog.objects.create(
        group=settlement.group,
        user=settlement.created_by,
        action="settlement_created",
        description=(
            f"{settlement.from_user.phone_number} → "
            f"{settlement.to_user.phone_number}: {settlement.amount} T"
        ),
    )


def log_settlement_confirmed(payload: dict) -> None:
    settlement = Settlement.objects.select_related("from_user", "to_user", "group").get(
        pk=payload["settlement_id"]
    )
    confirmed_by = User.objects.get(pk=payload["confirmed_by_id"])
    ActivityLog.objects.create(
        group=settlement.group,
        user=confirmed_by,
        action="settlement_confirmed",
        description=f"Settlement {settlement.id} confirmed",
    )


def log_settlement_reversed(payload: dict) -> None:
    settlement = Settlement.objects.select_related("from_user", "to_user", "group").get(
        pk=payload["settlement_id"]
    )
    reversed_by = User.objects.get(pk=payload["reversed_by_id"])
    ActivityLog.objects.create(
        group=settlement.group,
        user=reversed_by,
        action="settlement_reversed",
        description=f"Settlement {settlement.id} reversed",
    )
