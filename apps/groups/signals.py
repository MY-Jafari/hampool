from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Membership, Expense, ActivityLog


@receiver(post_save, sender=Membership)
def log_membership_created(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            group=instance.group,
            user=instance.user,
            action="member_joined",
            description=f"{instance.user} joined as {instance.role}",
        )


@receiver(post_delete, sender=Membership)
def log_membership_deleted(sender, instance, **kwargs):
    ActivityLog.objects.create(
        group=instance.group,
        user=instance.user,
        action="member_left",
        description=f"{instance.user} left the group",
    )


@receiver(post_save, sender=Expense)
def log_expense_created(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            group=instance.group,
            user=instance.paid_by,
            action="expense_created",
            description=f'Expense "{instance.description}" created',
        )
    # Expense confirmation logged manually in view to avoid false positives
