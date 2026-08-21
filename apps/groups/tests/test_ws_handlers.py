"""
Tests for WebSocket notification handlers (ws_handlers.py).

Covers:
- push_group_state_changed: success, empty event_type ignored
- handle_group_created
- handle_member_joined
- handle_member_left
- handle_expense_created / confirmed / deleted
- handle_settlement_created / confirmed / reversed
"""

import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model

from apps.groups.models import (
    Expense,
    Membership,
    Settlement,
)

User = get_user_model()


@pytest.fixture
def user1(db):
    return User.objects.create_user(phone_number="09111111111", password="Test@123", is_active=True)


@pytest.fixture
def user2(db):
    return User.objects.create_user(phone_number="09222222222", password="Test@123", is_active=True)


@pytest.fixture
def group_with_users(user1, user2):
    from apps.groups.models import Group

    g = Group.objects.create(name="تست", created_by=user1, owner=user1)
    m1 = Membership.objects.create(user=user1, group=g, role="admin")
    m2 = Membership.objects.create(user=user2, group=g, role="member")
    return g, m1, m2


# ══════════════════════════════════════════════════════════════
# PUSH GROUP STATE CHANGED
# ══════════════════════════════════════════════════════════════


class TestPushGroupStateChanged:
    @patch("apps.groups.ws_handlers.get_channel_layer")
    @patch("apps.groups.ws_handlers.async_to_sync")
    def test_push_event(self, mock_async_to_sync, mock_get_layer):
        from apps.groups.ws_handlers import push_group_state_changed

        mock_layer = MagicMock()
        mock_get_layer.return_value = mock_layer
        # Make async_to_sync return the underlying callable directly
        mock_async_to_sync.side_effect = lambda fn: fn

        push_group_state_changed(
            group_id=1,
            event_type="expense_created",
            params={"description": "test", "amount": 50000},
        )

        mock_layer.group_send.assert_called_once()
        call_args = mock_layer.group_send.call_args[0]
        assert call_args[0] == "group_1"
        payload = call_args[1]
        assert payload["type"] == "group_state_changed"
        assert payload["event_type"] == "expense_created"
        assert payload["params"] == {"description": "test", "amount": 50000}
        assert payload["group_id"] == 1
        assert "ts" in payload

    @patch("apps.groups.ws_handlers.get_channel_layer")
    def test_empty_event_type_ignored(self, mock_get_layer):
        from apps.groups.ws_handlers import push_group_state_changed

        mock_layer = MagicMock()
        mock_get_layer.return_value = mock_layer

        push_group_state_changed(group_id=1, event_type="")
        mock_layer.group_send.assert_not_called()

    @patch("apps.groups.ws_handlers.get_channel_layer")
    @patch("apps.groups.ws_handlers.async_to_sync")
    def test_default_params_empty_dict(self, mock_async_to_sync, mock_get_layer):
        from apps.groups.ws_handlers import push_group_state_changed

        mock_layer = MagicMock()
        mock_get_layer.return_value = mock_layer
        mock_async_to_sync.side_effect = lambda fn: fn

        push_group_state_changed(group_id=5, event_type="group_created")
        payload = mock_layer.group_send.call_args[0][1]
        assert payload["params"] == {}

    @patch("apps.groups.ws_handlers.get_channel_layer")
    @patch("apps.groups.ws_handlers.async_to_sync")
    def test_ts_is_iso_format(self, mock_async_to_sync, mock_get_layer):
        from apps.groups.ws_handlers import push_group_state_changed

        mock_layer = MagicMock()
        mock_get_layer.return_value = mock_layer
        mock_async_to_sync.side_effect = lambda fn: fn

        push_group_state_changed(group_id=1, event_type="test")
        payload = mock_layer.group_send.call_args[0][1]
        # Should be parseable as ISO format
        ts = payload["ts"]
        assert "T" in ts  # ISO format contains T


# ══════════════════════════════════════════════════════════════
# HANDLER FUNCTIONS
# ══════════════════════════════════════════════════════════════


class TestHandleGroupCreated:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push):
        from apps.groups.ws_handlers import handle_group_created

        handle_group_created({"group_id": 42})
        mock_push.assert_called_once_with(42, event_type="group_created")


class TestHandleMemberJoined:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1, user2):
        from apps.groups.ws_handlers import handle_member_joined

        g, m1, m2 = group_with_users
        handle_member_joined({"membership_id": m2.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="member_joined",
            params={"phone_number": "09222222222"},
        )


class TestHandleMemberLeft:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push):
        from apps.groups.ws_handlers import handle_member_left

        handle_member_left({"group_id": 10, "user_phone": "09123456789"})
        mock_push.assert_called_once_with(
            10,
            event_type="member_left",
            params={"phone_number": "09123456789"},
        )


class TestHandleExpenseCreated:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1):
        from apps.groups.ws_handlers import handle_expense_created

        g, _, _ = group_with_users
        exp = Expense.objects.create(
            group=g,
            paid_by=user1,
            description="شام",
            total_amount=100000,
            split_type="equal",
        )
        handle_expense_created({"expense_id": exp.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="expense_created",
            params={
                "description": "شام",
                "amount": 100000,
                "payer": "09111111111",
            },
        )


class TestHandleExpenseConfirmed:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1):
        from apps.groups.ws_handlers import handle_expense_confirmed

        g, _, _ = group_with_users
        exp = Expense.objects.create(
            group=g,
            paid_by=user1,
            description="ناهار",
            total_amount=80000,
            split_type="equal",
        )
        handle_expense_confirmed({"expense_id": exp.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="expense_confirmed",
            params={"description": "ناهار", "amount": 80000},
        )


class TestHandleExpenseDeleted:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1):
        from apps.groups.ws_handlers import handle_expense_deleted

        g, _, _ = group_with_users
        exp = Expense.objects.create(
            group=g,
            paid_by=user1,
            description="حذف",
            total_amount=50000,
            split_type="equal",
        )
        handle_expense_deleted({"expense_id": exp.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="expense_deleted",
            params={"description": "حذف", "amount": 50000},
        )


class TestHandleSettlementCreated:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1, user2):
        from apps.groups.ws_handlers import handle_settlement_created

        g, _, _ = group_with_users
        s = Settlement.objects.create(
            group=g,
            from_user=user2,
            to_user=user1,
            amount=30000,
            created_by=user2,
        )
        handle_settlement_created({"settlement_id": s.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="settlement_created",
            params={
                "amount": 30000,
                "from_phone": "09222222222",
                "to_phone": "09111111111",
            },
        )


class TestHandleSettlementConfirmed:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1, user2):
        from apps.groups.ws_handlers import handle_settlement_confirmed

        g, _, _ = group_with_users
        s = Settlement.objects.create(
            group=g,
            from_user=user2,
            to_user=user1,
            amount=30000,
            status="confirmed",
            created_by=user2,
            confirmed_by=user1,
        )
        handle_settlement_confirmed({"settlement_id": s.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="settlement_confirmed",
            params={
                "amount": 30000,
                "from_phone": "09222222222",
                "to_phone": "09111111111",
            },
        )


class TestHandleSettlementReversed:
    @patch("apps.groups.ws_handlers.push_group_state_changed")
    def test_handler(self, mock_push, group_with_users, user1, user2):
        from apps.groups.ws_handlers import handle_settlement_reversed

        g, _, _ = group_with_users
        s = Settlement.objects.create(
            group=g,
            from_user=user2,
            to_user=user1,
            amount=30000,
            status="reversed",
            created_by=user2,
        )
        handle_settlement_reversed({"settlement_id": s.pk})
        mock_push.assert_called_once_with(
            g.id,
            event_type="settlement_reversed",
            params={
                "amount": 30000,
                "from_phone": "09222222222",
                "to_phone": "09111111111",
            },
        )
