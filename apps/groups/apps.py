from django.apps import AppConfig


class GroupsConfig(AppConfig):
    """Application configuration for the Groups & Expenses module."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.groups"
    label = "groups"
    verbose_name = "Groups & Expenses"

    def ready(self):
        """
        Register all outbox event handlers once the application is ready.

        This method is called by Django after all apps are loaded.  It
        imports and registers **audit‑log handlers** and **WebSocket
        notification handlers** so that every relevant domain event is
        dispatched to the appropriate consumers.
        """
        from apps.outbox.handlers import register

        # ── Audit‑log handlers ─────────────────────────────────────
        from apps.groups.audit_handlers import (
            log_group_created,
            log_member_joined,
            log_member_left,
            log_expense_created,
            log_expense_confirmed,
            log_expense_deleted,
            log_settlement_created,
            log_settlement_confirmed,
            log_settlement_reversed,
        )

        register("GroupCreated", log_group_created)
        register("MemberJoined", log_member_joined)
        register("MemberLeft", log_member_left)
        register("ExpenseCreated", log_expense_created)
        register("ExpenseConfirmed", log_expense_confirmed)
        register("ExpenseDeleted", log_expense_deleted)
        register("SettlementCreated", log_settlement_created)
        register("SettlementConfirmed", log_settlement_confirmed)
        register("SettlementReversed", log_settlement_reversed)

        # ── WebSocket notification handlers ─────────────────────────
        from apps.groups.ws_handlers import (
            handle_group_created,
            handle_member_joined,
            handle_member_left,
            handle_expense_created,
            handle_expense_confirmed,
            handle_expense_deleted,
            handle_settlement_created,
            handle_settlement_confirmed,
            handle_settlement_reversed,
        )

        register("GroupCreated", handle_group_created)
        register("MemberJoined", handle_member_joined)
        register("MemberLeft", handle_member_left)
        register("ExpenseCreated", handle_expense_created)
        register("ExpenseConfirmed", handle_expense_confirmed)
        register("ExpenseDeleted", handle_expense_deleted)
        register("SettlementCreated", handle_settlement_created)
        register("SettlementConfirmed", handle_settlement_confirmed)
        register("SettlementReversed", handle_settlement_reversed)
