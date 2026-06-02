"""
Handler for sending report emails.
"""

import base64
import logging
from django.core.mail import EmailMessage
from django.conf import settings

logger = logging.getLogger("reports")


def send_report_email(payload: dict) -> None:
    """
    Build and send an email with the report PDF attached.

    The payload is expected to contain:
        - user_id
        - group_id
        - pdf_content_base64
        - report_date
    """
    from django.contrib.auth import get_user_model
    from apps.groups.models import Group

    User = get_user_model()
    user = User.objects.get(pk=payload["user_id"])
    group = Group.objects.get(pk=payload["group_id"])

    pdf_bytes = base64.b64decode(payload["pdf_content_base64"])

    subject = f'HamPool Weekly Report – {group.name} ({payload["report_date"]})'
    body = (
        f"Hello {user.full_name or user.phone_number},\n\n"
        f'Please find attached the weekly report for group "{group.name}".\n\n'
        f"Best,\nHamPool"
    )
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.attach(f'report_{group.name}_{payload["report_date"]}.pdf', pdf_bytes, "application/pdf")
    email.send(fail_silently=False)
    logger.info(f"Sent report email to {user.email} for group {group.name}")
