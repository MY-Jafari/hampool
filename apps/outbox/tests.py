"""
Tests for the outbox app — OutboxEvent model, handler registry, service, and tasks.

Covers:
- OutboxEvent model: create, __str__, status transitions, ordering
- Handler registry: register, get_handlers, multiple handlers per event
- OutboxService.publish_event
- dispatch_outbox_event: success, handler failure, already dispatched, not found
- process_stale_outbox: picks up old pending events
"""

from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.outbox.models import OutboxEvent
from apps.outbox.handlers import register, get_handlers, _registry
from apps.outbox.services import OutboxService

User = get_user_model()


# ══════════════════════════════════════════════════════════════
# OUTBOX EVENT MODEL
# ══════════════════════════════════════════════════════════════


class TestOutboxEvent:
    def test_create_event(self, db):
        event = OutboxEvent.objects.create(
            event_type="ExpenseCreated",
            payload={"expense_id": 1, "group_id": 2},
        )
        assert event.event_type == "ExpenseCreated"
        assert event.payload == {"expense_id": 1, "group_id": 2}
        assert event.status == "pending"
        assert event.created_at is not None
        assert event.processed_at is None
        assert event.error_message == ""

    def test_status_choices(self, db):
        event = OutboxEvent.objects.create(event_type="Test", payload={})
        valid_statuses = ["pending", "processing", "dispatched", "failed"]
        for s in valid_statuses:
            event.status = s
            event.save(update_fields=["status"])
            assert event.status == s

    def test_ordering_by_created_at(self, db):
        e1 = OutboxEvent.objects.create(event_type="A", payload={})
        e2 = OutboxEvent.objects.create(event_type="B", payload={})
        events = list(OutboxEvent.objects.all())
        # Default ordering is ["created_at"], ascending
        assert events[0].pk == e1.pk
        assert events[1].pk == e2.pk

    def test_payload_jsonfield(self, db):
        """Payload can store complex nested JSON."""
        data = {"nested": {"key": [1, 2, 3]}, "flag": True}
        event = OutboxEvent.objects.create(event_type="Complex", payload=data)
        event.refresh_from_db()
        assert event.payload == data

    def test_created_at_auto_set(self, db):
        event = OutboxEvent.objects.create(event_type="Test", payload={})
        assert event.created_at is not None

    def test_error_message_blank_default(self, db):
        event = OutboxEvent.objects.create(event_type="Test", payload={})
        assert event.error_message == ""


# ══════════════════════════════════════════════════════════════
# HANDLER REGISTRY
# ══════════════════════════════════════════════════════════════


class TestHandlerRegistry:
    def setup_method(self):
        """Clear registry before each test."""
        _registry.clear()

    def test_register_and_get(self):
        def my_handler(payload):
            pass

        register("TestEvent", my_handler)
        handlers = get_handlers("TestEvent")
        assert len(handlers) == 1
        assert handlers[0] is my_handler

    def test_get_handlers_empty(self):
        handlers = get_handlers("NonexistentEvent")
        assert handlers == []

    def test_multiple_handlers_same_event(self):
        def h1(p):
            pass

        def h2(p):
            pass

        register("MultiEvent", h1)
        register("MultiEvent", h2)
        handlers = get_handlers("MultiEvent")
        assert len(handlers) == 2
        assert h1 in handlers
        assert h2 in handlers

    def test_different_event_types(self):
        def h1(p):
            pass

        def h2(p):
            pass

        register("EventA", h1)
        register("EventB", h2)
        assert get_handlers("EventA") == [h1]
        assert get_handlers("EventB") == [h2]


# ══════════════════════════════════════════════════════════════
# OUTBOX SERVICE
# ══════════════════════════════════════════════════════════════


class TestOutboxService:
    def test_publish_event(self, db):
        event = OutboxService.publish_event("MemberJoined", {"user_id": 5, "group_id": 3})
        assert event.pk is not None
        assert event.event_type == "MemberJoined"
        assert event.payload == {"user_id": 5, "group_id": 3}
        assert event.status == "pending"

    def test_publish_event_returns_outbox_event(self, db):
        event = OutboxService.publish_event("Test", {"key": "value"})
        assert isinstance(event, OutboxEvent)
        assert OutboxEvent.objects.filter(pk=event.pk).exists()

    def test_publish_multiple_events(self, db):
        e1 = OutboxService.publish_event("Event1", {"a": 1})
        e2 = OutboxService.publish_event("Event2", {"b": 2})
        assert e1.pk != e2.pk
        assert OutboxEvent.objects.count() == 2


# ══════════════════════════════════════════════════════════════
# DISPATCH OUTBOX EVENT TASK
# ══════════════════════════════════════════════════════════════


class TestDispatchOutboxEvent:
    def setup_method(self):
        _registry.clear()

    def test_dispatch_success(self, db):
        from apps.outbox.tasks import dispatch_outbox_event

        handler = MagicMock()
        register("DispatchTest", handler)
        event = OutboxService.publish_event("DispatchTest", {"msg": "hello"})

        dispatch_outbox_event(event.pk)

        handler.assert_called_once_with({"msg": "hello"})
        event.refresh_from_db()
        assert event.status == "dispatched"
        assert event.processed_at is not None

    def test_dispatch_handler_failure(self, db):
        from apps.outbox.tasks import dispatch_outbox_event

        def bad_handler(payload):
            raise ValueError("handler broke")

        register("FailEvent", bad_handler)
        event = OutboxService.publish_event("FailEvent", {"data": 1})

        dispatch_outbox_event(event.pk)

        event.refresh_from_db()
        assert event.status == "failed"
        assert "handler broke" in event.error_message

    def test_dispatch_already_dispatched(self, db):
        from apps.outbox.tasks import dispatch_outbox_event

        handler = MagicMock()
        register("AlreadyDispatched", handler)
        event = OutboxService.publish_event("AlreadyDispatched", {})
        event.status = "dispatched"
        event.save(update_fields=["status"])

        dispatch_outbox_event(event.pk)

        # Handler should NOT have been called
        handler.assert_not_called()

    def test_dispatch_not_found(self, db):
        from apps.outbox.tasks import dispatch_outbox_event

        # Should not raise — just logs and returns
        dispatch_outbox_event(99999)

    def test_dispatch_multiple_handlers(self, db):
        from apps.outbox.tasks import dispatch_outbox_event

        h1 = MagicMock()
        h2 = MagicMock()
        register("MultiHandler", h1)
        register("MultiHandler", h2)
        event = OutboxService.publish_event("MultiHandler", {"multi": True})

        dispatch_outbox_event(event.pk)

        h1.assert_called_once_with({"multi": True})
        h2.assert_called_once_with({"multi": True})
        event.refresh_from_db()
        assert event.status == "dispatched"


# ══════════════════════════════════════════════════════════════
# PROCESS STALE OUTBOX
# ══════════════════════════════════════════════════════════════


class TestProcessStaleOutbox:
    def test_picks_up_stale_pending_events(self, db):
        from apps.outbox.tasks import process_stale_outbox

        event = OutboxService.publish_event("StaleTest", {"old": True})
        # Make it old (more than 1 minute)
        OutboxEvent.objects.filter(pk=event.pk).update(
            created_at=timezone.now() - timedelta(minutes=5)
        )

        with patch("apps.outbox.tasks.dispatch_outbox_event.delay") as mock_delay:
            process_stale_outbox()
            mock_delay.assert_called_once_with(event.pk)

    def test_ignores_recent_pending_events(self, db):
        from apps.outbox.tasks import process_stale_outbox

        OutboxService.publish_event("RecentTest", {"new": True})

        with patch("apps.outbox.tasks.dispatch_outbox_event.delay") as mock_delay:
            process_stale_outbox()
            mock_delay.assert_not_called()

    def test_ignores_dispatched_events(self, db):
        from apps.outbox.tasks import process_stale_outbox

        event = OutboxService.publish_event("OldDispatched", {})
        event.status = "dispatched"
        event.save(update_fields=["status"])
        OutboxEvent.objects.filter(pk=event.pk).update(
            created_at=timezone.now() - timedelta(minutes=10)
        )

        with patch("apps.outbox.tasks.dispatch_outbox_event.delay") as mock_delay:
            process_stale_outbox()
            mock_delay.assert_not_called()
