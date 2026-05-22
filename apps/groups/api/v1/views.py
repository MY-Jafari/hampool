from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from apps.groups.models import Group, Membership
from apps.groups.permissions import IsGroupMember, IsGroupAdmin, IsOwnerOrAdmin
from apps.groups.services import GroupService, ExpenseService, BalanceService
from .serializers import (
    GroupCreateSerializer,
    GroupSerializer,
    MembershipSerializer,
    AddMemberSerializer,
    MembershipResponseSerializer,
    ExpenseCreateSerializer,
    ExpenseDetailSerializer,
    ActivityLogSerializer,
    InviteCodeSerializer,
    JoinByInviteSerializer,
)

User = get_user_model()

# ── Service Instances ────────────────────────────────────────────
group_service = GroupService()
expense_service = ExpenseService()
balance_service = BalanceService()


# ── Group List / Create ─────────────────────────────────────────


class GroupListCreateView(generics.ListCreateAPIView):
    """List user's groups or create a new group (creator becomes owner/admin)."""

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return GroupCreateSerializer
        return GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(memberships__user=self.request.user)

    def perform_create(self, serializer):
        group = group_service.create_group(
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get("description", ""),
            budget_limit=serializer.validated_data.get("budget_limit", 0),
            created_by=self.request.user,
        )
        # Store the group instance for the response
        self._created_group = group

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out_serializer = GroupSerializer(self._created_group)
        headers = {}
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a group (member/admin)."""

    permission_classes = [IsGroupMember]
    serializer_class = GroupSerializer
    queryset = Group.objects.all()


# ── Membership List ─────────────────────────────────────────────


class GroupMembershipListView(generics.ListAPIView):
    """List all members of a group."""

    permission_classes = [IsGroupMember]
    serializer_class = MembershipSerializer

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        return group.memberships.all()


# ── Add Member ──────────────────────────────────────────────────


class GroupMembershipAddView(generics.CreateAPIView):
    """Add a member by phone number (admin only)."""

    permission_classes = [IsGroupAdmin]
    serializer_class = AddMemberSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            membership = group_service.add_member(
                group_id=self.kwargs["pk"],
                phone_number=input_serializer.validated_data["phone_number"],
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        output_serializer = MembershipResponseSerializer(membership)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


# ── Remove Member / Leave Group ─────────────────────────────────


class GroupMembershipRemoveView(generics.DestroyAPIView):
    """
    Remove a member from a group or leave the group.

    Rules are enforced inside GroupService.remove_member().
    """

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        try:
            result = group_service.remove_member(
                group_id=self.kwargs["pk"],
                user_id=self.kwargs["user_id"],
                requested_by=request.user,
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # If the group was deleted because the owner was the only member,
        # return a 200 with a message instead of 204
        if "detail" in result and "deleted" in result["detail"].lower():
            return Response(result, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Change Role ─────────────────────────────────────────────────


class GroupMembershipChangeRoleView(generics.UpdateAPIView):
    """
    Change a member's role (admin only).

    Only PATCH is allowed. The owner's role cannot be changed.
    """

    permission_classes = [IsGroupAdmin]
    serializer_class = MembershipSerializer
    queryset = Membership.objects.all()
    http_method_names = ["patch"]

    def patch(self, request, *args, **kwargs):
        new_role = request.data.get("role")
        if not new_role:
            return Response(
                {"error": "role field is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            membership = group_service.change_role(
                group_id=self.kwargs["pk"],
                user_id=self.kwargs["user_id"],
                new_role=new_role,
                requested_by=request.user,
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(membership)
        return Response(serializer.data)


# ── Transfer Ownership ──────────────────────────────────────────


class TransferOwnershipView(generics.GenericAPIView):
    """
    Transfer group ownership to another admin.

    Only the current owner can perform this action.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = serializers.Serializer

    def post(self, request, *args, **kwargs):
        new_owner_id = request.data.get("user_id")
        if not new_owner_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = group_service.transfer_ownership(
                group_id=self.kwargs["pk"], new_owner_id=new_owner_id, current_owner=request.user
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "detail": "Ownership transferred successfully.",
                "new_owner_id": group.owner.pk,
                "new_owner_phone": group.owner.phone_number,
            },
            status=status.HTTP_200_OK,
        )


# ── Invitation ──────────────────────────────────────────────────


class GroupInviteGenerateView(generics.GenericAPIView):
    """Generate a new invitation code (admin only)."""

    permission_classes = [IsGroupAdmin]
    serializer_class = InviteCodeSerializer

    def post(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        group.generate_invite_code()
        return Response(
            {"invite_code": group.invite_code, "expires_at": group.invite_code_expires_at}
        )


class GroupJoinByInviteView(generics.GenericAPIView):
    """Join a group using an invite code."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = JoinByInviteSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_code = serializer.validated_data["invite_code"]

        try:
            group_service.join_by_invite_code(invite_code=invite_code, user=request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"detail": "Successfully joined the group."}, status=status.HTTP_201_CREATED
        )


# ── Expenses ────────────────────────────────────────────────────


class ExpenseListCreateView(generics.ListCreateAPIView):
    """List expenses of a group or create a new expense."""

    permission_classes = [IsGroupMember]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ExpenseCreateSerializer
        return ExpenseDetailSerializer

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        return group.expenses.all()

    def perform_create(self, serializer):
        self._created_expense = expense_service.create_expense(
            group_id=self.kwargs["pk"],
            paid_by=self.request.user,
            validated_data=serializer.validated_data,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out_serializer = ExpenseDetailSerializer(self._created_expense)
        headers = {}
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete an expense."""

    permission_classes = [IsOwnerOrAdmin]
    serializer_class = ExpenseDetailSerializer
    lookup_url_kwarg = "eid"

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        return group.expenses.all()

    def perform_update(self, serializer):
        instance = serializer.instance
        if (
            "is_confirmed" in serializer.validated_data
            and serializer.validated_data["is_confirmed"]
        ):
            if not instance.is_confirmed:
                expense_service.confirm_expense(
                    expense_id=instance.pk, confirmed_by=self.request.user
                )
                # Refresh instance to reflect changes
                instance.refresh_from_db()
                return
        serializer.save()

    def perform_destroy(self, instance):
        expense_service.delete_expense(expense_id=instance.pk, deleted_by=self.request.user)


# ── Balances ────────────────────────────────────────────────────


class BalanceView(generics.GenericAPIView):
    """Calculate net balance for each group member."""

    permission_classes = [IsGroupMember]

    def get(self, request, *args, **kwargs):
        balances = balance_service.get_balances(group_id=self.kwargs["pk"])
        return Response(balances)


# ── Activity Log ────────────────────────────────────────────────


class ActivityLogView(generics.ListAPIView):
    """List activity logs for a group."""

    permission_classes = [IsGroupMember]
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        return group.activities.all()
