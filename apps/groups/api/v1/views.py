from django.shortcuts import get_object_or_404
from django.db.models import Sum
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from apps.groups.models import Group, Membership, Expense, ExpenseSplit, ActivityLog
from apps.groups.permissions import IsGroupMember, IsGroupAdmin, IsOwnerOrAdmin
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
        group = serializer.save(created_by=self.request.user, owner=self.request.user)
        Membership.objects.create(user=self.request.user, group=group, role="admin")
        group.generate_invite_code()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out_serializer = GroupSerializer(serializer.instance)
        headers = self.get_success_headers(serializer.data)
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

        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        phone = input_serializer.validated_data["phone_number"]
        user = get_object_or_404(User, phone_number=phone)

        membership, created = Membership.objects.get_or_create(
            user=user, group=group, defaults={"role": "member"}
        )
        if not created:
            return Response(
                {"error": "User is already a member."}, status=status.HTTP_400_BAD_REQUEST
            )

        output_serializer = MembershipResponseSerializer(membership)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


# ── Remove Member / Leave Group ─────────────────────────────────


class GroupMembershipRemoveView(generics.DestroyAPIView):
    """
    Remove a member from a group or leave the group.

    Rules:
        - Owner cannot be removed (must transfer ownership or delete group).
        - Owner can leave only if there is another admin; ownership transfers
          to the earliest admin.
        - Regular members can leave (self-removal).
        - Admins (non-owner) can remove other non-owner members.
    """

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        user_to_remove = get_object_or_404(User, pk=self.kwargs["user_id"])
        is_owner = user_to_remove == group.owner
        is_self = request.user == user_to_remove

        # Owner cannot be removed by anyone (including themselves directly)
        if is_owner:
            # If owner tries to leave and is the only member -> delete group
            if is_self and group.memberships.count() == 1:
                group.delete()
                return Response(
                    {"detail": "You were the only member. The group has been deleted."},
                    status=status.HTTP_200_OK,
                )
            # If owner tries to leave and there are other admins -> transfer ownership
            elif is_self:
                earliest_admin = group.get_earliest_admin()
                if earliest_admin:
                    group.owner = earliest_admin.user
                    group.save(update_fields=["owner"])
                    # Remove the old owner's membership
                    membership = get_object_or_404(Membership, group=group, user=request.user)
                    membership.delete()
                    return Response(
                        {"detail": "Ownership transferred. You have left the group."},
                        status=status.HTTP_200_OK,
                    )
                else:
                    return Response(
                        {"error": "Cannot leave without another admin. Delete the group instead."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                return Response(
                    {"error": "The group owner cannot be removed by others."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Non-owner removal
        is_admin = Membership.objects.filter(user=request.user, group=group, role="admin").exists()

        if not (is_admin or is_self):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        membership = get_object_or_404(Membership, group=group, user=user_to_remove)
        membership.delete()

        # If the removed user was admin and there are no admins left,
        # promote the earliest member to admin
        if not group.memberships.filter(role="admin").exists():
            first_member = group.memberships.order_by("joined_at").first()
            if first_member:
                first_member.role = "admin"
                first_member.save(update_fields=["role"])

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
    http_method_names = ["patch"]  # Block PUT requests

    def get_object(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        user = get_object_or_404(User, pk=self.kwargs["user_id"])
        return get_object_or_404(Membership, group=group, user=user)

    def patch(self, request, *args, **kwargs):
        membership = self.get_object()
        group = membership.group

        # Owner's role is immutable
        if membership.user == group.owner:
            return Response(
                {"error": "Cannot change the role of the group owner."},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_role = request.data.get("role")
        if new_role not in ["admin", "member"]:
            return Response({"error": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

        membership.role = new_role
        membership.save()

        # If the last admin was demoted, promote the earliest member
        if not group.memberships.filter(role="admin").exists():
            first_member = group.memberships.order_by("joined_at").first()
            if first_member:
                first_member.role = "admin"
                first_member.save(update_fields=["role"])

        serializer = self.get_serializer(membership)
        return Response(serializer.data)


# ── Transfer Ownership ──────────────────────────────────────────


class TransferOwnershipView(generics.GenericAPIView):
    """
    Transfer group ownership to another admin.

    Only the current owner can perform this action.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = serializers.Serializer  # Minimal serializer

    def post(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])

        # Only the current owner can transfer
        if request.user != group.owner:
            return Response(
                {"error": "Only the group owner can transfer ownership."},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_owner_id = request.data.get("user_id")
        new_owner = get_object_or_404(User, pk=new_owner_id)
        membership = get_object_or_404(Membership, group=group, user=new_owner)

        # Ensure the new owner is an admin
        if membership.role != "admin":
            membership.role = "admin"
            membership.save(update_fields=["role"])

        # Transfer ownership
        group.owner = new_owner
        group.save(update_fields=["owner"])

        return Response(
            {
                "detail": "Ownership transferred successfully.",
                "new_owner_id": new_owner.pk,
                "new_owner_phone": new_owner.phone_number,
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
        code = serializer.validated_data["invite_code"]
        group = get_object_or_404(Group, invite_code=code)
        if not group.is_invite_code_valid():
            return Response(
                {"error": "Invite code is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST
            )
        membership, created = Membership.objects.get_or_create(
            user=request.user, group=group, defaults={"role": "member"}
        )
        if not created:
            return Response({"detail": "You are already a member."}, status=status.HTTP_200_OK)
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
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        serializer.save(group=group, paid_by=self.request.user)


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete an expense."""

    permission_classes = [IsOwnerOrAdmin]
    serializer_class = ExpenseDetailSerializer

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
                ActivityLog.objects.create(
                    group=instance.group,
                    user=self.request.user,
                    action="expense_confirmed",
                    description=f'Expense "{instance.description}" confirmed',
                )
        serializer.save()


# ── Balances ────────────────────────────────────────────────────


class BalanceView(generics.GenericAPIView):
    """Calculate net balance for each group member."""

    permission_classes = [IsGroupMember]

    def get(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        members = group.memberships.select_related("user").all()
        balances = []
        for m in members:
            user = m.user
            paid = (
                Expense.objects.filter(group=group, paid_by=user, is_confirmed=True).aggregate(
                    total=Sum("total_amount")
                )["total"]
                or 0
            )
            owed = (
                ExpenseSplit.objects.filter(
                    expense__group=group, expense__is_confirmed=True, user=user, settled=False
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            )
            net = paid - owed
            balances.append(
                {
                    "phone_number": user.phone_number,
                    "full_name": user.full_name or user.phone_number,
                    "paid": paid,
                    "owed": owed,
                    "net": net,
                }
            )
        return Response(balances)


# ── Activity Log ────────────────────────────────────────────────


class ActivityLogView(generics.ListAPIView):
    """List activity logs for a group."""

    permission_classes = [IsGroupMember]
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        return group.activities.all()
