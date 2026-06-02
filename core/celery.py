import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("hampool")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# -----------------

app.conf.beat_schedule = {
    "dispatch-weekly-reports": {
        "task": "apps.reports.tasks.dispatch_weekly_report_jobs",
        "schedule": crontab(hour=20, minute=0, day_of_week=5),  # Friday 8 PM
    },
}
