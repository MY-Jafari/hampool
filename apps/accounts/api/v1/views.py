import logging

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.settings import api_settings
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework.permissions import BasePermission

from .serializers import (
    RegisterSerializer,
    VerifyOTPSerializer,
    UserSerializer,
)

logger = logging.getLogger("accounts")
User = get_user_model()


# ── Custom Authentication: Allows inactive users ───────────────


class AllowInactiveUserJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that allows inactive users to authenticate.
    Used for endpoints like OTP verification where the user is not yet active.
    """

    def get_user(self, validated_token):
        """
        Return the user associated with the token, even if inactive.
        """
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken(_("Token contained no recognizable user identification"))

        try:
            user = self.user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
        except self.user_model.DoesNotExist:
            raise AuthenticationFailed(_("User not found"), code="user_not_found")

        # Do NOT check user.is_active here; allow inactive users
        return user


# ── Custom Permission for temporary OTP tokens ─────────────────


class IsVerifyOTPToken(BasePermission):
    """
    Allow access only if the request's JWT token carries
    the custom claim 'purpose' with value 'verify_otp'.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.auth and request.auth.get("purpose") == "verify_otp"


# ── Registration View ──────────────────────────────────────────


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="post")
class RegisterView(generics.CreateAPIView):
    """
    Register a new user. Returns a temporary access token for OTP verification.
    Rate limited to 5 requests per minute per IP.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info(f"New user registered: {user.phone_number} (inactive)")
        return Response(
            {
                "detail": _(
                    "Registration successful. Please verify your phone number with the OTP."
                ),
                "temp_token": user._temp_token,
            },
            status=status.HTTP_201_CREATED,
        )


# ── OTP Verification View ──────────────────────────────────────


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="post")
class VerifyOTPView(generics.GenericAPIView):
    """
    Verify the OTP code using the temporary JWT token from registration.
    On success, activates the user and returns standard access/refresh tokens.
    The user is automatically logged in.
    """

    authentication_classes = [AllowInactiveUserJWTAuthentication]  # اجازه به کاربر غیرفعال
    permission_classes = [IsVerifyOTPToken]
    serializer_class = VerifyOTPSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()  # User is now active

        logger.info(f"User {request.user.phone_number} verified and activated.")

        # Issue standard JWT tokens so the user is immediately logged in
        refresh = RefreshToken.for_user(request.user)
        return Response(
            {
                "detail": _("Phone number verified successfully. You are now logged in."),
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


# ── Login View ─────────────────────────────────────────────────


class LoginView(TokenObtainPairView):
    """
    Takes phone_number and password and returns access and refresh tokens.
    Inherits from simplejwt's TokenObtainPairView.
    """

    pass


# ── Logout View ────────────────────────────────────────────────


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout request containing the refresh token."""

    refresh = serializers.CharField(required=True)


class LogoutView(generics.GenericAPIView):
    """
    Blacklist the refresh token to log out the user.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"error": _("Refresh token is required.")}, status=status.HTTP_400_BAD_REQUEST
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info(f"User {request.user.phone_number} logged out and token blacklisted.")
            return Response(
                {"detail": _("Successfully logged out.")}, status=status.HTTP_205_RESET_CONTENT
            )
        except Exception:
            return Response({"error": _("Invalid token.")}, status=status.HTTP_400_BAD_REQUEST)


# ── Profile View ───────────────────────────────────────────────


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated user's profile.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
