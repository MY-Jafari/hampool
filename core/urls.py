from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions


def health_check(request):
    return JsonResponse({"status": "ok", "message": "HamPool is running!"})


schema_view = get_schema_view(
    openapi.Info(
        title="HamPool API",
        default_version="v1",
        description="Manage shared expenses",
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check, name="health_check"),
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/groups/", include("apps.groups.urls")),
    path("swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="swagger-ui"),
    path("redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="redoc"),
]
