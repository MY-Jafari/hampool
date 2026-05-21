from rest_framework.permissions import BasePermission
from .models import Membership


class IsGroupMember(BasePermission):
    """Allow access only to members of the group specified in the URL."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        group_id = view.kwargs.get("pk") or view.kwargs.get("group_pk")
        if not group_id:
            return False
        return Membership.objects.filter(user=request.user, group_id=group_id).exists()


class IsGroupAdmin(BasePermission):
    """Allow access only to admins of the group."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        group_id = view.kwargs.get("pk") or view.kwargs.get("group_pk")
        if not group_id:
            return False
        return Membership.objects.filter(
            user=request.user, group_id=group_id, role="admin"
        ).exists()


class IsOwnerOrAdmin(BasePermission):
    """
    For expense deletion/update: allow if user is the payer or group admin.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        # obj is an Expense instance
        if obj.paid_by == request.user:
            return True
        return Membership.objects.filter(user=request.user, group=obj.group, role="admin").exists()
