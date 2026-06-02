from django.apps import AppConfig


class ReportsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.reports"
    label = "reports"

    def ready(self):
        from apps.outbox.handlers import register
        from .handlers import send_report_email

        register("ReportReady", send_report_email)
