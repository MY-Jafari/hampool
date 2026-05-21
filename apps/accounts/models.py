import pyotp
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """
    Custom manager for the User model where phone_number is the unique identifier
    instead of username.
    """

    def create_user(self, phone_number: str, password: str = None, **extra_fields):
        """Create and save a regular user with the given phone_number and password."""
        if not phone_number:
            raise ValueError(_("The Phone Number field must be set"))
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number: str, password: str = None, **extra_fields):
        """Create and save a superuser with the given phone_number and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Fully custom User model that uses phone_number for authentication.

    Attributes:
        phone_number (str): Unique 11-digit Iranian mobile number (e.g. 09123456789).
        email (str): Optional email address, required later for report generation.
        full_name (str): Display name of the user.
        language (str): Preferred language ('fa' or 'en').
        avatar (ImageField): Profile picture; falls back to default avatar.
        is_active (bool): Inactive until OTP verification after registration.
        is_staff (bool): Permission to access admin panel.
        date_joined (datetime): Account creation timestamp.
    """

    phone_number = models.CharField(
        max_length=11,
        unique=True,
        verbose_name=_("phone number"),
        help_text=_("11-digit Iranian mobile number starting with 09"),
    )
    email = models.EmailField(
        _("email address"),
        blank=True,
        null=True,
        help_text=_("Optional. Will be required when generating reports."),
    )
    full_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name=_("full name"),
    )
    language = models.CharField(
        max_length=10,
        choices=[("fa", _("Persian")), ("en", _("English"))],
        default="fa",
        verbose_name=_("language"),
    )
    avatar = models.ImageField(
        upload_to="avatars/",
        default="avatars/default.png",
        blank=True,
        verbose_name=_("avatar"),
        help_text=_("Profile picture. Default avatar is provided."),
    )
    is_active = models.BooleanField(
        default=False,  # inactive until OTP verified
        verbose_name=_("active"),
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    is_staff = models.BooleanField(
        default=False,
        verbose_name=_("staff status"),
        help_text=_("Designates whether the user can log into this admin site."),
    )
    date_joined = models.DateTimeField(
        default=timezone.now,
        verbose_name=_("date joined"),
    )

    objects = UserManager()

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["-date_joined"]

    def __str__(self):
        return self.phone_number

    def get_full_name(self):
        """Return the full name of the user, or phone_number if not set."""
        return self.full_name or self.phone_number

    def get_short_name(self):
        """Return the short name (first part of full name) or phone_number."""
        return self.full_name.split(" ", 1)[0] if self.full_name else self.phone_number


class OTP(models.Model):
    """
    One-Time Password model using TOTP (pyotp) for phone verification.
    The secret is stored temporarily and used to verify the user-entered code.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="otp",
        verbose_name=_("user"),
    )
    secret = models.CharField(
        max_length=32,  # pyotp.random_base32() generates 32-character string
        verbose_name=_("TOTP secret"),
        help_text=_("Random base32 secret used to generate TOTP codes."),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("created at"),
    )
    expires_at = models.DateTimeField(
        verbose_name=_("expires at"),
        help_text=_("OTP is valid only until this timestamp (1 minute after creation)."),
    )

    class Meta:
        verbose_name = _("OTP")
        verbose_name_plural = _("OTPs")

    def __str__(self):
        return f"OTP for {self.user.phone_number}"

    def is_expired(self) -> bool:
        """Return True if the OTP has passed its expiration time."""
        return timezone.now() > self.expires_at

    def verify_code(self, code: str) -> bool:
        """Verify the given code using the TOTP secret and a 60-second interval."""
        if self.is_expired():
            return False
        totp = pyotp.TOTP(self.secret, interval=60)
        # Increase valid_window to 2 to be more tolerant of clock skew
        return totp.verify(code, valid_window=2)

    def save(self, *args, **kwargs):
        """Set expiration to 2 minutes from creation (matches valid_window)."""
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=2)
        super().save(*args, **kwargs)
