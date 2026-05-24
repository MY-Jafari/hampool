from django.apps import AppConfig


class GroupsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.groups"
    label = "groups"
    verbose_name = "Groups & Expenses"

    def ready(self):
        # Register audit log handlers with the Outbox dispatcher
        from apps.outbox.handlers import register
        from apps.groups.audit_handlers import (
            log_group_created,
            log_member_joined,
            log_member_left,
            log_expense_created,
            log_expense_confirmed,
            log_expense_deleted,
        )

        register("GroupCreated", log_group_created)
        register("MemberJoined", log_member_joined)
        register("MemberLeft", log_member_left)
        register("ExpenseCreated", log_expense_created)
        register("ExpenseConfirmed", log_expense_confirmed)
        register("ExpenseDeleted", log_expense_deleted)
