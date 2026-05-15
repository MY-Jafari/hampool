import logging

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

from .serializers import (
    RegisterSerializer,
    VerifyOTPSerializer,
    UserSerializer,
)

logger = logging.getLogger("accounts")
User = get_user_model()


# helper class for swagger
class LogoutSerializer(serializers.Serializer):
    """Serializer for logout request containing the refresh token."""

    refresh = serializers.CharField(required=True)


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="post")
class RegisterView(generics.CreateAPIView):
    """
    Register a new user. Sends an OTP (logged to console) for verification.
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
                "phone_number": user.phone_number,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="post")
class VerifyOTPView(generics.GenericAPIView):
    """
    Verify the OTP sent to the user's phone number.
    Activates the user account.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = VerifyOTPSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f'User {serializer.validated_data["phone_number"]} verified and activated.')
        return Response(
            {"detail": _("Phone number verified successfully. You can now login.")},
            status=status.HTTP_200_OK,
        )


class LoginView(TokenObtainPairView):
    """
    Takes phone_number and password and returns access and refresh tokens.
    Inherits from simplejwt's TokenObtainPairView.
    """

    pass  # Custom logic (e.g., logging failed attempts) can be added via signal


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


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated user's profile.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
