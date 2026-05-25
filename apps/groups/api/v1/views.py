from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from apps.groups.models import Group, Membership
from apps.groups.permissions import IsGroupMember, IsGroupAdmin, IsOwnerOrAdmin
from apps.groups.services import GroupService, ExpenseService, BalanceService, SettlementService
from .serializers import (
    GroupCreateSerializer,
    GroupSerializer,
    MembershipSerializer,
    AddMemberSerializer,
    MembershipResponseSerializer,
    ExpenseCreateSerializer,
    ExpenseDetailSerializer,
    SettlementSerializer,
    CreateSettlementSerializer,
    ActivityLogSerializer,
    InviteCodeSerializer,
    JoinByInviteSerializer,
)

User = get_user_model()

group_service = GroupService()
expense_service = ExpenseService()
balance_service = BalanceService()
settlement_service = SettlementService()


# ── Group List / Create ─────────────────────────────────────────


class GroupListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return GroupCreateSerializer
        return GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(memberships__user=self.request.user)

    def perform_create(self, serializer):
        self._created_group = group_service.create_group(
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get("description", ""),
            budget_limit=serializer.validated_data.get("budget_limit", 0),
            created_by=self.request.user,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out_serializer = GroupSerializer(self._created_group)
        headers = {}
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsGroupMember]
    serializer_class = GroupSerializer
    queryset = Group.objects.all()


# ── Membership List ─────────────────────────────────────────────


class GroupMembershipListView(generics.ListAPIView):
    permission_classes = [IsGroupMember]
    serializer_class = MembershipSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).memberships.all()


# ── Add Member ──────────────────────────────────────────────────


class GroupMembershipAddView(generics.CreateAPIView):
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
        return Response(
            MembershipResponseSerializer(membership).data, status=status.HTTP_201_CREATED
        )


# ── Remove Member / Leave Group ─────────────────────────────────


class GroupMembershipRemoveView(generics.DestroyAPIView):
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
        if "detail" in result and "deleted" in result["detail"].lower():
            return Response(result, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Change Role ─────────────────────────────────────────────────


class GroupMembershipChangeRoleView(generics.UpdateAPIView):
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
        return Response(self.get_serializer(membership).data)


# ── Transfer Ownership ──────────────────────────────────────────


class TransferOwnershipView(generics.GenericAPIView):
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
    permission_classes = [IsGroupAdmin]
    serializer_class = InviteCodeSerializer

    def post(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        group.generate_invite_code()
        return Response(
            {"invite_code": group.invite_code, "expires_at": group.invite_code_expires_at}
        )


class GroupJoinByInviteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = JoinByInviteSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            group_service.join_by_invite_code(
                invite_code=serializer.validated_data["invite_code"], user=request.user
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "Successfully joined the group."}, status=status.HTTP_201_CREATED
        )


# ── Expenses ────────────────────────────────────────────────────


class ExpenseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsGroupMember]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ExpenseCreateSerializer
        return ExpenseDetailSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).expenses.all()

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
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsOwnerOrAdmin]
    serializer_class = ExpenseDetailSerializer
    lookup_url_kwarg = "eid"

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).expenses.all()

    def perform_update(self, serializer):
        instance = serializer.instance
        if (
            "is_confirmed" in serializer.validated_data
            and serializer.validated_data["is_confirmed"]
            and not instance.is_confirmed
        ):
            expense_service.confirm_expense(expense_id=instance.pk, confirmed_by=self.request.user)
            instance.refresh_from_db()
            return
        serializer.save()

    def perform_destroy(self, instance):
        expense_service.delete_expense(expense_id=instance.pk, deleted_by=self.request.user)


# ── Settlements ─────────────────────────────────────────────────


class SettlementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsGroupMember]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateSettlementSerializer
        return SettlementSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).settlements.all()

    def perform_create(self, serializer):
        try:
            self._settlement = settlement_service.create_settlement(
                group_id=self.kwargs["pk"],
                from_user=self.request.user,
                to_user_id=serializer.validated_data["to_user_id"],
                amount=serializer.validated_data["amount"],
                created_by=self.request.user,
            )
        except ValueError as e:
            # Convert service error to DRF validation error
            raise serializers.ValidationError({"error": str(e)})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(SettlementSerializer(self._settlement).data, status=status.HTTP_201_CREATED)


class SettlementConfirmView(generics.GenericAPIView):
    permission_classes = [IsGroupMember]

    def post(self, request, *args, **kwargs):
        try:
            settlement = settlement_service.confirm_settlement(
                settlement_id=self.kwargs["sid"], confirmed_by=request.user
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SettlementSerializer(settlement).data, status=status.HTTP_200_OK)


class SettlementReverseView(generics.GenericAPIView):
    permission_classes = [IsGroupMember]

    def post(self, request, *args, **kwargs):
        try:
            reversal = settlement_service.reverse_settlement(
                settlement_id=self.kwargs["sid"], requested_by=request.user
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SettlementSerializer(reversal).data, status=status.HTTP_201_CREATED)


# ── Balances ────────────────────────────────────────────────────


class BalanceView(generics.GenericAPIView):
    permission_classes = [IsGroupMember]

    def get(self, request, *args, **kwargs):
        return Response(balance_service.get_balances(group_id=self.kwargs["pk"]))


# ── Activity Log ────────────────────────────────────────────────


class ActivityLogView(generics.ListAPIView):
    permission_classes = [IsGroupMember]
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).activities.all()
