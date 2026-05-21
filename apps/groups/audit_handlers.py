"""
Audit log handlers for group events.

These handlers subscribe to domain events via the EventBus
and create the corresponding ActivityLog records.
"""

from apps.groups.models import ActivityLog
from apps.groups.events import (
    GroupCreated,
    MemberJoined,
    MemberLeft,
    ExpenseCreated,
    ExpenseConfirmed,
    ExpenseDeleted,
)


def log_group_created(event: GroupCreated) -> None:
    """Create an audit log entry when a group is created."""
    ActivityLog.objects.create(
        group=event.group,
        user=event.group.created_by,
        action="group_created",
        description=f'Group "{event.group.name}" created',
    )


def log_member_joined(event: MemberJoined) -> None:
    """Create an audit log entry when a member joins."""
    ActivityLog.objects.create(
        group=event.membership.group,
        user=event.membership.user,
        action="member_joined",
        description=f"{event.membership.user.phone_number} joined as {event.membership.role}",
    )


def log_member_left(event: MemberLeft) -> None:
    """Create an audit log entry when a member leaves."""
    ActivityLog.objects.create(
        group=event.group,
        user=event.user,
        action="member_left",
        description=f"{event.user.phone_number} left the group",
    )


def log_expense_created(event: ExpenseCreated) -> None:
    """Create an audit log entry when an expense is created."""
    ActivityLog.objects.create(
        group=event.expense.group,
        user=event.expense.paid_by,
        action="expense_created",
        description=f'Expense "{event.expense.description}" created',
    )


def log_expense_confirmed(event: ExpenseConfirmed) -> None:
    """Create an audit log entry when an expense is confirmed."""
    ActivityLog.objects.create(
        group=event.expense.group,
        user=event.confirmed_by,
        action="expense_confirmed",
        description=f'Expense "{event.expense.description}" confirmed',
    )


def log_expense_deleted(event: ExpenseDeleted) -> None:
    """Create an audit log entry when an expense is deleted."""
    ActivityLog.objects.create(
        group=event.expense.group,
        user=event.deleted_by,
        action="expense_deleted",
        description=f'Expense "{event.expense.description}" deleted',
    )
