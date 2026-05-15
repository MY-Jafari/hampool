import re
import logging

import pyotp
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import OTP

User = get_user_model()
logger = logging.getLogger("accounts")


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for initial user registration.
    Accepts only phone_number, password, and password confirmation.
    Creates an inactive user and generates a TOTP secret for OTP verification.
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
        Create an inactive user, generate a TOTP secret,
        and log the current OTP code to the console.
        """
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        user.is_active = False
        user.save()

        # Generate TOTP secret and log the current code
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret, interval=60)
        code = totp.now()
        OTP.objects.update_or_create(
            user=user, defaults={"secret": secret, "expires_at": None}  # auto-set in save()
        )
        logger.info(f"OTP for {user.phone_number}: {code}")
        return user


class VerifyOTPSerializer(serializers.Serializer):
    """
    Serializer for OTP verification. Accepts phone_number and the 6-digit code.
    Activates the user if the TOTP code is valid.
    """

    phone_number = serializers.CharField(max_length=11)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs: dict) -> dict:
        try:
            user = User.objects.get(phone_number=attrs["phone_number"])
        except User.DoesNotExist:
            raise serializers.ValidationError(_("Invalid phone number."))

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
    Users can later add email, full_name, language, and avatar via this serializer.
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
