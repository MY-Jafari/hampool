from django.apps import AppConfig


class GroupsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.groups"
    label = "groups"
    verbose_name = "Groups & Expenses"

    def ready(self):
        # Register audit log handlers with the EventBus
        from core.events import EventBus
        from apps.groups.events import (
            GroupCreated,
            MemberJoined,
            MemberLeft,
            ExpenseCreated,
            ExpenseConfirmed,
            ExpenseDeleted,
        )
        from apps.groups.audit_handlers import (
            log_group_created,
            log_member_joined,
            log_member_left,
            log_expense_created,
            log_expense_confirmed,
            log_expense_deleted,
        )

        EventBus.subscribe(GroupCreated, log_group_created)
        EventBus.subscribe(MemberJoined, log_member_joined)
        EventBus.subscribe(MemberLeft, log_member_left)
        EventBus.subscribe(ExpenseCreated, log_expense_created)
        EventBus.subscribe(ExpenseConfirmed, log_expense_confirmed)
        EventBus.subscribe(ExpenseDeleted, log_expense_deleted)
