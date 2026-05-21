import re
import logging
from datetime import timedelta

import pyotp
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import OTP

User = get_user_model()
logger = logging.getLogger("accounts")


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for initial user registration.

    Accepts phone_number, password, and password_confirmation.
    Creates an inactive user, generates a TOTP secret for OTP,
    and attaches a temporary JWT token (5 min) for the verification step.
    """

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        label=_("password"),
    )
    password_confirm = serializers.CharField(
        write_only=True,
        label=_("password confirmation"),
    )

    class Meta:
        model = User
        fields = ("phone_number", "password", "password_confirm")

    def validate_phone_number(self, value: str) -> str:
        """Validate that the phone number matches Iranian mobile pattern (09xxxxxxxxx)."""
        if not re.match(r"^09\d{9}$", value):
            raise serializers.ValidationError(
                _("Phone number must start with 09 and be exactly 11 digits.")
            )
        return value

    def validate(self, attrs: dict) -> dict:
        """Ensure the two password fields match."""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": _("Passwords do not match.")})
        return attrs

    def create(self, validated_data: dict) -> User:
        """
        Create an inactive user, generate a TOTP secret, log the OTP code,
        and build a temporary JWT token (5 min) for OTP verification.

        The token carries a custom claim 'purpose' = 'verify_otp'.
        """
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        user.is_active = False
        user.save()

        # Generate TOTP secret and log the current OTP code
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret, interval=60)
        code = totp.now()
        OTP.objects.update_or_create(
            user=user, defaults={"secret": secret, "expires_at": None}  # auto-set in save()
        )
        logger.info(f"OTP for {user.phone_number}: {code}")

        # Build a temporary access token (5 min) with a custom claim
        token = AccessToken.for_user(user)
        token["purpose"] = "verify_otp"
        token.set_exp(lifetime=timedelta(minutes=5))

        # Attach the token string to the user object so the view can return it
        user._temp_token = str(token)
        return user


class VerifyOTPSerializer(serializers.Serializer):
    """
    Serializer for OTP verification.

    The user is extracted from the temporary JWT token in the request.
    Only the OTP code is required in the request body.
    """

    code = serializers.CharField(max_length=6)

    def validate(self, attrs: dict) -> dict:
        # User is already authenticated by the temporary token
        user = self.context["request"].user
        if not user.is_authenticated:
            raise serializers.ValidationError(_("Authentication required."))

        try:
            otp = user.otp
        except OTP.DoesNotExist:
            raise serializers.ValidationError(_("No OTP found for this user."))

        if not otp.verify_code(attrs["code"]):
            raise serializers.ValidationError(_("Invalid or expired OTP code."))

        self.context["user"] = user
        return attrs

    def save(self):
        """Activate the user and delete the used OTP record."""
        user = self.context["user"]
        user.is_active = True
        user.save()
        user.otp.delete()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model. Used for profile retrieval and update.
    """

    class Meta:
        model = User
        fields = (
            "id",
            "phone_number",
            "email",
            "full_name",
            "language",
            "avatar",
            "date_joined",
        )
        read_only_fields = ("id", "phone_number", "date_joined")
