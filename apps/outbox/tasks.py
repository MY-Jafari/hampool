import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .models import OutboxEvent
from .handlers import get_handlers

logger = logging.getLogger("outbox")


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_outbox_event(self, outbox_id: int) -> None:
    """
    Dispatch a single outbox event by calling all registered handlers.

    If an exception occurs, the status is set to 'failed' and the error
    is logged.  No retry is attempted for the same event – the periodic
    stale task will pick up any remaining pending events.
    """
    try:
        event = OutboxEvent.objects.get(pk=outbox_id)
    except OutboxEvent.DoesNotExist:
        logger.error(f"OutboxEvent {outbox_id} not found.")
        return

    if event.status != "pending":
        return  # already dispatched or being processed

    event.status = "processing"
    event.save(update_fields=["status"])

    try:
        handlers = get_handlers(event.event_type)
        for handler in handlers:
            handler(event.payload)  # handler receives the payload dict
        event.status = "dispatched"
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "processed_at"])
    except Exception as exc:
        event.status = "failed"
        event.error_message = str(exc)
        event.save(update_fields=["status", "error_message"])
        logger.exception(f"Failed to dispatch outbox event {outbox_id}")


@shared_task
def process_stale_outbox() -> None:
    """
    Safety net: dispatch any outbox events that are still pending
    after more than 1 minute.
    """
    stale_threshold = timezone.now() - timedelta(minutes=1)
    stale_events = OutboxEvent.objects.filter(
        status="pending",
        created_at__lt=stale_threshold,
    )
    for event in stale_events:
        dispatch_outbox_event.delay(event.pk)
