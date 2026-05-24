from django.db import models


class OutboxEvent(models.Model):
    """
    Stores domain events that must be reliably delivered to handlers.

    Events are written in the same atomic transaction as the business
    data.  A Celery task dispatches them after commit, and a periodic
    task picks up any stale events that were missed.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("dispatched", "Dispatched"),
        ("failed", "Failed"),
    ]

    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at"]
