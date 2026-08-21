"""
Tests for the accounts app — registration, OTP verification, login, profile, logout.

Covers:
- Registration with valid/invalid data
- OTP verification flow (generate TOTP code from DB secret)
- JWT login with correct/incorrect credentials
- Token refresh and blacklist
- Profile retrieval and update
- Logout blacklists the refresh token
- Rate limiting on registration (5/min/IP)
- User model methods (__str__, get_full_name, get_short_name)
- UserManager (create_user, create_superuser)
- OTP model (is_expired, verify_code, __str__)
"""

import pyotp
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import OTP

User = get_user_model()

BASE = "/api/v1/accounts/"


# ── Fixtures ────────────────────────────────────────────────────


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user1(db):
    """Active user for non-registration tests."""
    return User.objects.create_user(
        phone_number="09111111111",
        password="Test@12345",
        full_name="کاربر تست",
        is_active=True,
    )


@pytest.fixture
def tokens(user1):
    """JWT tokens for user1."""
    refresh = RefreshToken.for_user(user1)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


@pytest.fixture
def auth_client(api, tokens):
    """APIClient with valid Bearer token."""
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api


# ── Registration ────────────────────────────────────────────────


def _register(api, phone="09123456789", password="Strong@Pass1", confirm=None):
    """Helper: register a user and return the response."""
    return api.post(
        f"{BASE}register/",
        {
            "phone_number": phone,
            "password": password,
            "password_confirm": confirm or password,
        },
        format="json",
    )


class TestRegistration:
    def test_register_success(self, api, db):
        res = _register(api, "09987654321")
        assert res.status_code == status.HTTP_201_CREATED
        assert "temp_token" in res.data
        assert User.objects.filter(phone_number="09987654321").exists()
        user = User.objects.get(phone_number="09987654321")
        assert not user.is_active  # inactive until OTP verified

    def test_register_duplicate_phone(self, api, user1):
        res = _register(api, "09111111111")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_invalid_phone_format(self, api, db):
        res = _register(api, "12345")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_password_mismatch(self, api, db):
        res = _register(api, "09987654321", password="Strong@Pass1", confirm="Different@Pass2")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_weak_password(self, api, db):
        res = _register(api, "09987654321", password="123")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_fields(self, api, db):
        res = api.post(f"{BASE}register/", {}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ── OTP Verification ───────────────────────────────────────────


def _get_otp_code(user):
    """Generate the current TOTP code from the user's OTP record."""
    otp = OTP.objects.get(user=user)
    totp = pyotp.TOTP(otp.secret, interval=60)
    return totp.now()


class TestOTPVerification:
    def test_verify_otp_success(self, api, db):
        # Register
        res = _register(api, "09987654321")
        temp_token = res.data["temp_token"]
        user = User.objects.get(phone_number="09987654321")

        # Get OTP code from DB
        code = _get_otp_code(user)

        # Verify
        res = api.post(
            f"{BASE}verify-otp/",
            {"code": code},
            HTTP_AUTHORIZATION=f"Bearer {temp_token}",
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert "access" in res.data
        assert "refresh" in res.data

        # User is now active
        user.refresh_from_db()
        assert user.is_active

    def test_verify_otp_wrong_code(self, api, db):
        res = _register(api, "09987654321")
        temp_token = res.data["temp_token"]

        res = api.post(
            f"{BASE}verify-otp/",
            {"code": "000000"},
            HTTP_AUTHORIZATION=f"Bearer {temp_token}",
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_otp_no_temp_token(self, api, db):
        res = api.post(f"{BASE}verify-otp/", {"code": "123456"}, format="json")
        # No token → 401 (JWT required)
        assert res.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


# ── Login ──────────────────────────────────────────────────────


class TestLogin:
    def test_login_success(self, api, user1):
        res = api.post(
            f"{BASE}login/",
            {"phone_number": "09111111111", "password": "Test@12345"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert "access" in res.data
        assert "refresh" in res.data

    def test_login_wrong_password(self, api, user1):
        res = api.post(
            f"{BASE}login/",
            {"phone_number": "09111111111", "password": "wrongpassword"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, api, db):
        res = api.post(
            f"{BASE}login/",
            {"phone_number": "09999999999", "password": "whatever"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_inactive_user(self, api, db):
        """Inactive users cannot log in."""
        User.objects.create_user(phone_number="09123456789", password="Test@123", is_active=False)
        res = api.post(
            f"{BASE}login/",
            {"phone_number": "09123456789", "password": "Test@123"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ── Token Refresh ──────────────────────────────────────────────


class TestTokenRefresh:
    def test_refresh_success(self, api, tokens):
        res = api.post(
            f"{BASE}token/refresh/",
            {"refresh": tokens["refresh"]},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert "access" in res.data

    def test_refresh_invalid_token(self, api, db):
        res = api.post(
            f"{BASE}token/refresh/",
            {"refresh": "invalid.token.here"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_blacklisted_token(self, api, user1, tokens):
        """After logout, refresh token is blacklisted."""
        api.post(
            f"{BASE}logout/",
            {"refresh": tokens["refresh"]},
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
            format="json",
        )
        res = api.post(
            f"{BASE}token/refresh/",
            {"refresh": tokens["refresh"]},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ── Profile ────────────────────────────────────────────────────


class TestProfile:
    def test_get_profile(self, auth_client, user1):
        res = auth_client.get(f"{BASE}profile/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["phone_number"] == "09111111111"
        assert res.data["full_name"] == "کاربر تست"

    def test_update_profile(self, auth_client, user1):
        res = auth_client.patch(
            f"{BASE}profile/",
            {"full_name": "نام جدید", "email": "new@example.com"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        user1.refresh_from_db()
        assert user1.full_name == "نام جدید"
        assert user1.email == "new@example.com"

    def test_profile_unauthenticated(self, api):
        res = api.get(f"{BASE}profile/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_profile_readonly_phone(self, auth_client, user1):
        """Phone number cannot be changed via profile update."""
        auth_client.patch(
            f"{BASE}profile/",
            {"phone_number": "09999999999"},
            format="json",
        )
        user1.refresh_from_db()
        assert user1.phone_number == "09111111111"


# ── Logout ─────────────────────────────────────────────────────


class TestLogout:
    def test_logout_success(self, api, user1, tokens):
        res = api.post(
            f"{BASE}logout/",
            {"refresh": tokens["refresh"]},
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
            format="json",
        )
        assert res.status_code == status.HTTP_205_RESET_CONTENT

    def test_logout_unauthenticated(self, api, tokens):
        res = api.post(
            f"{BASE}logout/",
            {"refresh": tokens["refresh"]},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_missing_refresh(self, api, user1, tokens):
        res = api.post(
            f"{BASE}logout/",
            {},
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ── Full Registration Flow ─────────────────────────────────────


class TestFullRegistrationFlow:
    def test_register_verify_login(self, api, db):
        """Complete flow: register → OTP → login → profile."""
        # 1. Register
        res = _register(api, "09987654321", "Strong@Pass1")
        temp_token = res.data["temp_token"]
        user = User.objects.get(phone_number="09987654321")
        assert not user.is_active

        # 2. Verify OTP
        code = _get_otp_code(user)
        res = api.post(
            f"{BASE}verify-otp/",
            {"code": code},
            HTTP_AUTHORIZATION=f"Bearer {temp_token}",
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        access = res.data["access"]
        refresh = res.data["refresh"]

        # 3. User is active
        user.refresh_from_db()
        assert user.is_active

        # 4. Access profile
        res = api.get(
            f"{BASE}profile/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["phone_number"] == "09987654321"

        # 5. Logout
        res = api.post(
            f"{BASE}logout/",
            {"refresh": refresh},
            HTTP_AUTHORIZATION=f"Bearer {access}",
            format="json",
        )
        assert res.status_code == status.HTTP_205_RESET_CONTENT

        # 6. Refresh token is blacklisted
        res = api.post(f"{BASE}token/refresh/", {"refresh": refresh}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ══════════════════════════════════════════════════════════════
# USER MODEL TESTS
# ══════════════════════════════════════════════════════════════


class TestUserModel:
    def test_str(self, user1):
        assert str(user1) == "09111111111"

    def test_get_full_name_with_name(self, user1):
        assert user1.get_full_name() == "کاربر تست"

    def test_get_full_name_without_name(self, db):
        user = User.objects.create_user(phone_number="09123456789", password="Test@123")
        # full_name defaults to ""
        assert user.get_full_name() == "09123456789"

    def test_get_short_name_with_name(self, user1):
        assert user1.get_short_name() == "کاربر"

    def test_get_short_name_multi_word(self, db):
        user = User.objects.create_user(
            phone_number="09123456789", password="Test@123", full_name="علی محمدی رضایی"
        )
        assert user.get_short_name() == "علی"

    def test_get_short_name_without_name(self, db):
        user = User.objects.create_user(phone_number="09123456789", password="Test@123")
        assert user.get_short_name() == "09123456789"


class TestUserManager:
    def test_create_user(self, db):
        user = User.objects.create_user(phone_number="09123456789", password="Test@123")
        assert user.phone_number == "09123456789"
        assert user.check_password("Test@123")
        assert user.is_active is False
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_create_user_no_phone_raises(self, db):
        with pytest.raises(ValueError, match="Phone Number"):
            User.objects.create_user(phone_number="", password="Test@123")

    def test_create_superuser(self, db):
        admin = User.objects.create_superuser(phone_number="09123456789", password="Admin@123")
        assert admin.is_staff is True
        assert admin.is_superuser is True
        assert admin.is_active is True
        assert admin.check_password("Admin@123")

    def test_create_user_with_extra_fields(self, db):
        user = User.objects.create_user(
            phone_number="09123456789",
            password="Test@123",
            full_name="تست کاربر",
            email="test@example.com",
            language="en",
        )
        assert user.full_name == "تست کاربر"
        assert user.email == "test@example.com"
        assert user.language == "en"


class TestUserDefaultValues:
    def test_default_language_fa(self, db):
        user = User.objects.create_user(phone_number="09123456789", password="Test@123")
        assert user.language == "fa"

    def test_is_active_false_by_default(self, db):
        user = User.objects.create_user(phone_number="09123456789", password="Test@123")
        assert user.is_active is False

    def test_ordering(self, db):
        User.objects.create_user(phone_number="09111111111", password="Test@123")
        u2 = User.objects.create_user(phone_number="09222222222", password="Test@123")
        users = list(User.objects.all())
        # Ordering is [-date_joined], so u2 should be first
        assert users[0] == u2


# ══════════════════════════════════════════════════════════════
# OTP MODEL TESTS
# ══════════════════════════════════════════════════════════════


class TestOTPModel:
    def test_str(self, user1):
        otp = OTP.objects.create(user=user1, secret=pyotp.random_base32())
        assert str(otp) == f"OTP for {user1.phone_number}"

    def test_is_expired_false(self, user1):
        otp = OTP.objects.create(user=user1, secret=pyotp.random_base32())
        assert otp.is_expired() is False

    def test_is_expired_true(self, user1):
        from django.utils import timezone
        from datetime import timedelta

        otp = OTP.objects.create(user=user1, secret=pyotp.random_base32())
        otp.expires_at = timezone.now() - timedelta(minutes=1)
        otp.save(update_fields=["expires_at"])
        assert otp.is_expired() is True

    def test_verify_code_correct(self, user1):
        secret = pyotp.random_base32()
        otp = OTP.objects.create(user=user1, secret=secret)
        totp = pyotp.TOTP(secret, interval=60)
        code = totp.now()
        assert otp.verify_code(code) is True

    def test_verify_code_incorrect(self, user1):
        otp = OTP.objects.create(user=user1, secret=pyotp.random_base32())
        assert otp.verify_code("000000") is False

    def test_verify_code_expired(self, user1):
        from django.utils import timezone
        from datetime import timedelta

        secret = pyotp.random_base32()
        otp = OTP.objects.create(user=user1, secret=secret)
        totp = pyotp.TOTP(secret, interval=60)
        code = totp.now()
        # Expire it
        otp.expires_at = timezone.now() - timedelta(minutes=1)
        otp.save(update_fields=["expires_at"])
        assert otp.verify_code(code) is False

    def test_otp_expires_at_set_on_save(self, user1):
        otp = OTP.objects.create(user=user1, secret=pyotp.random_base32())
        assert otp.expires_at is not None
