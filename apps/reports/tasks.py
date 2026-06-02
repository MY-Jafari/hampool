"""
Celery tasks for generating weekly group reports.
"""

import base64
import logging
import os
import matplotlib.pyplot as plt
import matplotlib

from datetime import timedelta
from io import BytesIO

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML
from apps.groups.models import Group, Balance
from apps.outbox.services import OutboxService
from apps.outbox.tasks import dispatch_outbox_event

matplotlib.use("Agg")

logger = logging.getLogger("reports")
User = get_user_model()


@shared_task
def dispatch_weekly_report_jobs() -> None:
    """
    Celery Beat calls this every Friday evening.
    It fans out one task per active group.
    """
    week_ago = timezone.now() - timedelta(days=7)
    # Active groups: at least one expense or settlement in the past week
    active_group_ids = (
        Group.objects.filter(
            Q(expenses__date__gte=week_ago) | Q(settlements__created_at__gte=week_ago)
        )
        .distinct()
        .values_list("id", flat=True)
    )
    for gid in active_group_ids:
        generate_group_report.delay(gid)
    logger.info(f"Dispatched report jobs for {len(active_group_ids)} groups.")


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_group_report(self, group_id: int) -> None:
    """
    Generate a PDF report for a single group, optionally save it to disk
    for testing, and emit a ReportReady event for each member who has an
    email address.
    """
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        logger.error(f"Group {group_id} not found, skipping report.")
        return

    # ------------------------------------------------------------------
    # 1. Gather data for the report
    # ------------------------------------------------------------------
    now = timezone.now()
    week_ago = now - timedelta(days=7)

    # Expenses this week (confirmed)
    expenses = group.expenses.filter(is_confirmed=True, date__gte=week_ago)
    total_spent = expenses.aggregate(total=Sum("total_amount"))["total"] or 0
    budget = group.budget_limit
    remaining = budget - total_spent if budget else None
    percent_used = (total_spent / budget * 100) if budget else 0

    # Balances
    balances = Balance.objects.filter(group=group).select_related("user")

    # Category breakdown (pie chart)
    categories = {}
    for exp in expenses:
        cat = exp.split_type  # you could later add a real category field
        categories[cat] = categories.get(cat, 0) + exp.total_amount

    # Daily spending (bar chart)
    daily = {}
    for i in range(7):
        day = (now - timedelta(days=i)).date()
        daily[day] = 0
    for exp in expenses:
        day = exp.date.date()
        if day in daily:
            daily[day] += exp.total_amount

    # ------------------------------------------------------------------
    # 2. Generate charts in memory
    # ------------------------------------------------------------------

    # Pie chart
    pie_buf = None
    if categories:
        labels = list(categories.keys())
        values = list(categories.values())
        plt.figure(figsize=(4, 4))
        plt.pie(values, labels=labels, autopct="%1.1f%%")
        plt.title("Expense Categories")
        pie_buf = BytesIO()
        plt.savefig(pie_buf, format="png")
        pie_buf.seek(0)
        plt.close()

    # Bar chart
    bar_buf = None
    if daily:
        days = list(daily.keys())
        amounts = [daily[d] for d in days]
        plt.figure(figsize=(6, 3))
        plt.bar([d.strftime("%a") for d in days], amounts)
        plt.title("Daily Expenses")
        plt.xticks(rotation=45)
        bar_buf = BytesIO()
        plt.savefig(bar_buf, format="png")
        bar_buf.seek(0)
        plt.close()

    # ------------------------------------------------------------------
    # 3. Render HTML and generate PDF in memory
    # ------------------------------------------------------------------
    context = {
        "group": group,
        "now": now,
        "total_spent": total_spent,
        "budget": budget,
        "remaining": remaining,
        "percent_used": percent_used,
        "balances": balances,
        "pie_chart_base64": (base64.b64encode(pie_buf.read()).decode() if pie_buf else None),
        "bar_chart_base64": (base64.b64encode(bar_buf.read()).decode() if bar_buf else None),
    }
    html_string = render_to_string("reports/weekly.html", context)

    pdf_buf = BytesIO()
    HTML(string=html_string).write_pdf(pdf_buf)
    pdf_buf.seek(0)

    # ------------------------------------------------------------------
    # 4. Optional: save PDF to disk for easy viewing during development
    # ------------------------------------------------------------------
    if settings.DEBUG:
        test_dir = os.path.join(settings.MEDIA_ROOT, "test_reports")
        os.makedirs(test_dir, exist_ok=True)
        filepath = os.path.join(
            test_dir,
            f'report_{group.id}_{now.strftime("%Y%m%d_%H%M%S")}.pdf',
        )
        with open(filepath, "wb") as f:
            f.write(pdf_buf.read())
        logger.info(f"Test PDF saved to {filepath}")
        pdf_buf.seek(0)  # reset pointer for later use

    # ------------------------------------------------------------------
    # 5. Emit ReportReady events for each member with email
    # ------------------------------------------------------------------
    pdf_base64 = base64.b64encode(pdf_buf.read()).decode()

    for membership in group.memberships.select_related("user").all():
        user = membership.user
        if user.email:
            outbox_event = OutboxService.publish_event(
                "ReportReady",
                {
                    "user_id": user.id,
                    "group_id": group.id,
                    "pdf_content_base64": pdf_base64,
                    "report_date": now.strftime("%Y-%m-%d"),
                },
            )
            dispatch_outbox_event.delay(outbox_event.pk)

    logger.info(f"Generated report for group {group.name} ({group.id})")
