from django.urls import path
from .api.v1 import views

urlpatterns = [
    path("", views.GroupListCreateView.as_view(), name="group-list-create"),
    path("join/", views.GroupJoinByInviteView.as_view(), name="group-join"),
    path("<int:pk>/", views.GroupDetailView.as_view(), name="group-detail"),
    path("<int:pk>/members/", views.GroupMembershipListView.as_view(), name="membership-list"),
    path("<int:pk>/members/add/", views.GroupMembershipAddView.as_view(), name="membership-add"),
    path(
        "<int:pk>/members/<int:user_id>/remove/",
        views.GroupMembershipRemoveView.as_view(),
        name="membership-remove",
    ),
    path(
        "<int:pk>/members/<int:user_id>/role/",
        views.GroupMembershipChangeRoleView.as_view(),
        name="membership-change-role",
    ),
    path("<int:pk>/invite/", views.GroupInviteGenerateView.as_view(), name="group-invite-generate"),
    path("<int:pk>/expenses/", views.ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("<int:pk>/expenses/<int:eid>/", views.ExpenseDetailView.as_view(), name="expense-detail"),
    path(
        "<int:pk>/settlements/",
        views.SettlementListCreateView.as_view(),
        name="settlement-list-create",
    ),
    path(
        "<int:pk>/settlements/<int:sid>/confirm/",
        views.SettlementConfirmView.as_view(),
        name="settlement-confirm",
    ),
    path(
        "<int:pk>/settlements/<int:sid>/reverse/",
        views.SettlementReverseView.as_view(),
        name="settlement-reverse",
    ),
    path(
        "<int:pk>/optimize-settlements/",
        views.OptimizeSettlementsView.as_view(),
        name="optimize-settlements",
    ),
    path(
        "<int:pk>/settlements/apply-optimization/",
        views.ApplyOptimizedSettlementsView.as_view(),
        name="apply-optimized-settlements",
    ),
    path("<int:pk>/balances/", views.BalanceView.as_view(), name="group-balances"),
    path("<int:pk>/activities/", views.ActivityLogView.as_view(), name="group-activities"),
    path("<int:pk>/report/", views.RequestReportView.as_view(), name="group-report"),
]
