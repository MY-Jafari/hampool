from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .api.v1.views import (
    RegisterView,
    VerifyOTPView,
    LoginView,
    LogoutView,
    ProfileView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("profile/", ProfileView.as_view(), name="profile"),
]
