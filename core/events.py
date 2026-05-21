"""
Minimal in-process Event Bus.

Provides a simple publish/subscribe mechanism for decoupling side-effects
(audit logs, notifications, etc.) from core business logic.
"""

from collections import defaultdict
from typing import Any, Callable, Type

# Global registry: event_type -> list of handlers
_subscribers: dict[Type[Any], list[Callable[[Any], None]]] = defaultdict(list)


class EventBus:
    """
    A lightweight, synchronous, in-process event bus.

    Handlers are called immediately when an event is published.
    No external message broker is required.
    """

    @staticmethod
    def subscribe(event_type: Type[Any], handler: Callable[[Any], None]) -> None:
        """
        Register a handler for a specific event type.

        Args:
            event_type: The class of the event (e.g., ExpenseCreated).
            handler: A callable that accepts an instance of event_type.
        """
        _subscribers[event_type].append(handler)

    @staticmethod
    def publish(event: Any) -> None:
        """
        Publish an event to all registered handlers.

        Handlers are called synchronously in the order they were added.

        Args:
            event: An instance of an event class.
        """
        for handler in _subscribers[type(event)]:
            handler(event)

    @staticmethod
    def clear() -> None:
        """Remove all subscriptions (useful for testing)."""
        _subscribers.clear()
