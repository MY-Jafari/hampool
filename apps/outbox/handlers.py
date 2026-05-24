"""
Registry for outbox event handlers.

Handlers are callables that receive a payload dictionary.
They are registered by event type and dispatched by the Celery task.
"""

from collections import defaultdict
from typing import Callable, Dict, List

# Global registry: event_type -> list of handler functions
_registry: Dict[str, List[Callable[[dict], None]]] = defaultdict(list)


def register(event_type: str, handler: Callable[[dict], None]) -> None:
    """
    Register a handler for a specific event type.

    Args:
        event_type: The event type string (e.g., 'GroupCreated').
        handler: A callable that accepts a payload dictionary.
    """
    _registry[event_type].append(handler)


def get_handlers(event_type: str) -> List[Callable[[dict], None]]:
    """
    Return all handlers registered for the given event type.

    Args:
        event_type: The event type string.

    Returns:
        A list of handler callables (empty list if none registered).
    """
    return _registry.get(event_type, [])
