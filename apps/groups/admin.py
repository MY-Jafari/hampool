from django.contrib import admin
from django.contrib import messages

from .models import (
    Group,
    Membership,
    Expense,
    ExpenseSplit,
    ExpenseItem,
    ExpenseItemShare,
    ActivityLog,
)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    """
    Admin panel for Group.

    Safe deletion is guaranteed by the overridden delete() method in the
    Group model.  A custom admin action replaces the default 'delete_selected'
    to call obj.delete() individually, triggering the safe deletion order.
    """

    list_display = ("name", "created_by", "budget_limit", "invite_code", "created_at")
    search_fields = ("name",)
    actions = ["safely_delete_selected"]

    def safely_delete_selected(self, request, queryset):
        """
        Custom admin action to safely delete selected groups.

        Calls obj.delete() on each instance so that the overridden
        Group.delete() method controls the deletion order.
        """
        for group in queryset:
            group.delete()
        self.message_user(
            request,
            f"Successfully deleted {queryset.count()} group(s).",
            messages.SUCCESS,
        )

    safely_delete_selected.short_description = "Safely delete selected groups"

    def get_actions(self, request):
        """
        Remove the default 'delete_selected' action to prevent
        queryset.delete() which may bypass the overridden Group.delete().
        """
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    """Admin panel for Membership."""

    list_display = ("user", "group", "role", "joined_at")
    list_filter = ("role",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    """Admin panel for Expense."""

    list_display = (
        "description",
        "group",
        "paid_by",
        "total_amount",
        "split_type",
        "is_confirmed",
        "date",
    )
    list_filter = ("split_type", "is_confirmed")


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    """Admin panel for ExpenseSplit."""

    list_display = ("expense", "user", "amount", "settled")


@admin.register(ExpenseItem)
class ExpenseItemAdmin(admin.ModelAdmin):
    """Admin panel for ExpenseItem."""

    list_display = ("name", "expense", "total_amount")


@admin.register(ExpenseItemShare)
class ExpenseItemShareAdmin(admin.ModelAdmin):
    """Admin panel for ExpenseItemShare."""

    list_display = ("item", "user", "amount", "is_confirmed")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """Admin panel for ActivityLog."""

    list_display = ("group", "user", "action", "timestamp")
    list_filter = ("action",)
