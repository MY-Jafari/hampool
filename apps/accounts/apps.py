from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """
    Application configuration for the accounts app.

    This app handles custom user model, OTP verification,
    and JWT authentication endpoints.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    label = "accounts"
    verbose_name = "Accounts & Authentication"
