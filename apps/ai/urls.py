from django.urls import path
from . import views

urlpatterns = [
    path(
        "groups/<int:pk>/suggest-name/",
        views.SuggestGroupNameView.as_view(),
        name="suggest-group-name",
    ),
]
