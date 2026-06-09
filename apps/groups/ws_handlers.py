"""
WebSocket notification handlers.

These handlers are called by the Outbox dispatcher whenever a financial
event occurs.  They extract the minimum necessary data from the database
and push a raw event to the Redis channel layer.  The consumer forwards
the data as‑is to the frontend, which is responsible for localising the
notification message.

Design notes (per architecture review):
  - Handlers are stateless and do **not** know the user's language.
  - They publish a ``group_state_changed`` event with an ``event_type``
    and a ``params`` dict.
  - The ``push_group_state_changed`` function ignores calls with an
    empty ``event_type`` to prevent broken notifications.
"""

from datetime import datetime, timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging

logger = logging.getLogger(__name__)


def push_group_state_changed(
    group_id: int,
    event_type: str = "",
    params: dict | None = None,
) -> None:
    """
    Send a ``group_state_changed`` event to the channel layer room.

    If ``event_type`` is empty the call is silently ignored — this
    prevents malformed events from reaching the frontend.
    """
    if not event_type:
        logger.warning("push_group_state_changed called without event_type; ignoring.")
        return

    channel_layer = get_channel_layer()
    payload = {
        "type": "group_state_changed",
        "group_id": group_id,
        "event_type": event_type,
        "params": params or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    async_to_sync(channel_layer.group_send)(
        f"group_{group_id}",
        payload,
    )


# ── Outbox payload handlers ───────────────────────────────────────


def handle_group_created(payload: dict) -> None:
    push_group_state_changed(
        payload["group_id"],
        event_type="group_created",
    )


def handle_member_joined(payload: dict) -> None:
    from apps.groups.models import Membership

    membership = Membership.objects.select_related("user").get(pk=payload["membership_id"])
    push_group_state_changed(
        membership.group_id,
        event_type="member_joined",
        params={"phone_number": membership.user.phone_number},
    )


def handle_member_left(payload: dict) -> None:
    push_group_state_changed(
        payload["group_id"],
        event_type="member_left",
        params={"phone_number": payload.get("user_phone", "")},
    )


def handle_expense_created(payload: dict) -> None:
    from apps.groups.models import Expense

    expense = Expense.objects.select_related("paid_by").get(pk=payload["expense_id"])
    push_group_state_changed(
        expense.group_id,
        event_type="expense_created",
        params={
            "description": expense.description,
            "amount": expense.total_amount,
            "payer": expense.paid_by.phone_number,
        },
    )


def handle_expense_confirmed(payload: dict) -> None:
    from apps.groups.models import Expense

    expense = Expense.objects.select_related("paid_by").get(pk=payload["expense_id"])
    push_group_state_changed(
        expense.group_id,
        event_type="expense_confirmed",
        params={
            "description": expense.description,
            "amount": expense.total_amount,
        },
    )


def handle_expense_deleted(payload: dict) -> None:
    from apps.groups.models import Expense

    expense = Expense.objects.select_related("paid_by").get(pk=payload["expense_id"])
    push_group_state_changed(
        expense.group_id,
        event_type="expense_deleted",
        params={
            "description": expense.description,
            "amount": expense.total_amount,
        },
    )


def handle_settlement_created(payload: dict) -> None:
    from apps.groups.models import Settlement

    settlement = Settlement.objects.select_related("from_user", "to_user").get(
        pk=payload["settlement_id"]
    )
    push_group_state_changed(
        settlement.group_id,
        event_type="settlement_created",
        params={
            "amount": settlement.amount,
            "from_phone": settlement.from_user.phone_number,
            "to_phone": settlement.to_user.phone_number,
        },
    )


def handle_settlement_confirmed(payload: dict) -> None:
    from apps.groups.models import Settlement

    settlement = Settlement.objects.select_related("from_user", "to_user").get(
        pk=payload["settlement_id"]
    )
    push_group_state_changed(
        settlement.group_id,
        event_type="settlement_confirmed",
        params={
            "amount": settlement.amount,
            "from_phone": settlement.from_user.phone_number,
            "to_phone": settlement.to_user.phone_number,
        },
    )


def handle_settlement_reversed(payload: dict) -> None:
    from apps.groups.models import Settlement

    settlement = Settlement.objects.select_related("from_user", "to_user").get(
        pk=payload["settlement_id"]
    )
    push_group_state_changed(
        settlement.group_id,
        event_type="settlement_reversed",
        params={
            "amount": settlement.amount,
            "from_phone": settlement.from_user.phone_number,
            "to_phone": settlement.to_user.phone_number,
        },
    )
