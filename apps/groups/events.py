"""
Domain events for the groups module.

Each event is a plain Python object carrying the data relevant to
that event. Handlers subscribe to these events via the EventBus.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from apps.groups.models import Group, Membership, Expense

if TYPE_CHECKING:
    from apps.accounts.models import User


@dataclass
class GroupCreated:
    """Published when a new group is created."""

    group: Group


@dataclass
class MemberJoined:
    """Published when a user joins a group."""

    membership: Membership


@dataclass
class MemberLeft:
    """Published when a user leaves a group."""

    group: Group
    user: User


@dataclass
class ExpenseCreated:
    """Published when a new expense is created."""

    expense: Expense


@dataclass
class ExpenseConfirmed:
    """Published when an expense is confirmed."""

    expense: Expense
    confirmed_by: User


@dataclass
class ExpenseDeleted:
    """Published when an expense is deleted."""

    expense: Expense
    deleted_by: User
