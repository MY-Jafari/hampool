from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User, OTP


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin panel configuration for custom User model."""

    list_display = ("phone_number", "full_name", "is_staff", "is_active", "date_joined")
    list_filter = ("is_staff", "is_active", "language")
    ordering = ("phone_number",)
    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        (_("Personal info"), {"fields": ("full_name", "email", "avatar", "language")}),
        (
            _("Permissions"),
            {
                "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "password1", "password2", "full_name", "email"),
            },
        ),
    )
    search_fields = ("phone_number", "full_name")


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "is_expired")
    search_fields = ("user__phone_number",)
    readonly_fields = ("secret", "user", "created_at", "expires_at")

    def has_add_permission(self, request):
        """Prevent manual creation of OTP records. They are auto-generated."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow deletion only for cleanup, but add may stay False."""
        return True
