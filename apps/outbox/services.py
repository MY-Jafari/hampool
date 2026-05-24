"""
Outbox service for creating transactional outbox events.

This service provides a simple interface to persist an event
inside the current database transaction.  The actual dispatch
is handled by a Celery task.
"""

from .models import OutboxEvent


class OutboxService:
    """Create outbox events within a transaction."""

    @staticmethod
    def publish_event(event_type: str, payload: dict) -> OutboxEvent:
        """
        Create an OutboxEvent inside the current transaction.

        Args:
            event_type: A string identifying the event (e.g. 'ExpenseCreated').
            payload: A JSON‑serializable dictionary with event data.

        Returns:
            The newly created OutboxEvent instance.
        """
        return OutboxEvent.objects.create(
            event_type=event_type,
            payload=payload,
        )
