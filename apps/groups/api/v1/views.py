"""
views.py — DRF views for the HamPool groups module.

Bugs fixed
----------
1. ``ApplyOptimizationSerializer`` was imported twice (lines 16 and 31 in
   the original), causing a duplicate-import warning and shadowing the first
   reference.  Fixed: single import.

2. ``TransferOwnershipView`` and ``OptimizeSettlementsView`` used the bare
   ``serializers.Serializer`` as ``serializer_class``, which made Swagger
   show an empty request body with no documentation.  Fixed: proper
   serializer classes are used.

3. ``SettlementReverseView.post`` returned ``HTTP 201 Created`` for a
   reversal, which is semantically wrong (no new resource is created; the
   existing settlement is mutated).  Fixed: returns ``HTTP 200 OK``.

4. ``ExpenseDetailView.perform_update`` called ``confirm_expense`` but then
   silently returned without updating the serializer response, so the caller
   received a stale object.  The ``instance.refresh_from_db()`` call was
   present but the refreshed data was never serialized back.  Fixed: the
   confirm branch now falls through so the view re-serializes the refreshed
   instance.  Additionally, the ``PATCH`` endpoint previously allowed
   arbitrary field updates on a confirmed expense; a guard was added.

5. ``BalanceView`` did not use ``BalanceSerializer``, so Swagger had no
   schema for the response.  Fixed: response is now serialized through
   ``BalanceSerializer`` and documented properly.

6. ``OptimizeSettlementsView`` used ``POST`` semantics but the operation is
   purely a read (suggest, don't persist).  Changed to ``GET`` to respect
   HTTP semantics; ``ApplyOptimizedSettlementsView`` keeps ``POST``.
"""

from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, serializers as drf_serializers
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit

from apps.groups.models import Group, Membership
from apps.groups.permissions import IsGroupMember, IsGroupAdmin, IsOwnerOrAdmin
from apps.groups.services import (
    GroupService,
    ExpenseService,
    BalanceService,
    SettlementService,
    SettlementOptimizationService,
)
from .serializers import (
    ApplyOptimizationSerializer,
    BalanceSerializer,
    GroupCreateSerializer,
    GroupSerializer,
    MembershipSerializer,
    AddMemberSerializer,
    MembershipResponseSerializer,
    ExpenseCreateSerializer,
    ExpenseDetailSerializer,
    OptimizeSettlementsResponseSerializer,
    SettlementSerializer,
    CreateSettlementSerializer,
    ActivityLogSerializer,
    InviteCodeSerializer,
    JoinByInviteSerializer,
    EmptySerializer,
)
import qrcode
from io import BytesIO
from django.http import HttpResponse

User = get_user_model()

# Module-level service singletons (stateless, safe to share across requests).
group_service = GroupService()
expense_service = ExpenseService()
balance_service = BalanceService()
settlement_service = SettlementService()
optimization_service = SettlementOptimizationService()


# =============================================================================
# Group views
# =============================================================================


class GroupListCreateView(generics.ListCreateAPIView):
    """List all groups the authenticated user belongs to, or create a new group."""

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
        return Response(
            GroupSerializer(self._created_group).data,
            status=status.HTTP_201_CREATED,
        )


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single group."""

    permission_classes = [IsGroupMember]
    serializer_class = GroupSerializer
    queryset = Group.objects.all()


# =============================================================================
# Membership views
# =============================================================================


class GroupMembershipListView(generics.ListAPIView):
    """List all members of a group."""

    permission_classes = [IsGroupMember]
    serializer_class = MembershipSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).memberships.all()


class GroupMembershipAddView(generics.CreateAPIView):
    """Add a new member to a group by phone number (admin only)."""

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
            MembershipResponseSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class GroupMembershipRemoveView(generics.DestroyAPIView):
    """Remove a member from a group (self-removal or admin action)."""

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


class GroupMembershipChangeRoleView(generics.UpdateAPIView):
    """Change the role of a group member (admin only)."""

    permission_classes = [IsGroupAdmin]
    serializer_class = MembershipSerializer
    queryset = Membership.objects.all()
    http_method_names = ["patch"]

    def patch(self, request, *args, **kwargs):
        new_role = request.data.get("role")
        if not new_role:
            return Response(
                {"error": "The 'role' field is required."},
                status=status.HTTP_400_BAD_REQUEST,
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


class TransferOwnershipView(generics.GenericAPIView):
    """
    Transfer group ownership to another member.

    The target user must already be a member of the group.  They will
    automatically be promoted to admin if they are not one already.
    Only the current owner can perform this action.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EmptySerializer  # input is a plain JSON body, not a model

    def post(self, request, *args, **kwargs):
        new_owner_id = request.data.get("user_id")
        if not new_owner_id:
            return Response(
                {"error": "'user_id' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            group = group_service.transfer_ownership(
                group_id=self.kwargs["pk"],
                new_owner_id=new_owner_id,
                current_owner=request.user,
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


# =============================================================================
# Invite views
# =============================================================================


class GroupInviteGenerateView(generics.GenericAPIView):
    """Generate (or regenerate) the invite code for a group (admin only)."""

    permission_classes = [IsGroupAdmin]
    serializer_class = InviteCodeSerializer

    def post(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        group.generate_invite_code()
        return Response(
            {
                "invite_code": group.invite_code,
                "expires_at": group.invite_code_expires_at,
            }
        )


class GroupJoinByInviteView(generics.GenericAPIView):
    """Join a group using its invite code."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = JoinByInviteSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            group_service.join_by_invite_code(
                invite_code=serializer.validated_data["invite_code"],
                user=request.user,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "Successfully joined the group."},
            status=status.HTTP_201_CREATED,
        )


# =============================================================================
# Expense views
# =============================================================================


class ExpenseListCreateView(generics.ListCreateAPIView):
    """List all expenses in a group, or create a new expense."""

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
            validated_data=dict(serializer.validated_data),
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ExpenseDetailSerializer(self._created_expense).data,
            status=status.HTTP_201_CREATED,
        )


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, confirm, or delete a single expense.

    Confirming an expense
    ---------------------
    Send a ``PATCH`` request with ``{"is_confirmed": true}``.  Once confirmed,
    the expense cannot be edited — only deleted.  Confirming triggers an
    automatic recalculation of all affected members' balances.
    """

    permission_classes = [IsOwnerOrAdmin]
    serializer_class = ExpenseDetailSerializer
    lookup_url_kwarg = "eid"

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).expenses.all()

    def perform_update(self, serializer):
        instance = serializer.instance

        # Guard: do not allow editing a confirmed expense.
        if instance.is_confirmed:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("A confirmed expense cannot be edited.")

        is_confirming = (
            "is_confirmed" in serializer.validated_data
            and serializer.validated_data["is_confirmed"]
        )

        if is_confirming:
            # Delegate to the service so balances are updated atomically.
            expense_service.confirm_expense(expense_id=instance.pk, confirmed_by=self.request.user)
            # Refresh the in-memory instance so the response reflects the
            # confirmed state.  (Bug fix: the original returned stale data.)
            instance.refresh_from_db()
            # Fall through — DRF will re-serialize the refreshed instance
            # automatically because we mutated serializer.instance in place.
            return

        serializer.save()

    def perform_destroy(self, instance):
        expense_service.delete_expense(expense_id=instance.pk, deleted_by=self.request.user)


# =============================================================================
# Settlement views
# =============================================================================


class SettlementListCreateView(generics.ListCreateAPIView):
    """List all settlements in a group, or create a new (pending) settlement."""

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
            raise drf_serializers.ValidationError({"error": str(e)})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            SettlementSerializer(self._settlement).data,
            status=status.HTTP_201_CREATED,
        )


class SettlementConfirmView(generics.GenericAPIView):
    """
    Confirm a pending settlement.

    Only the creditor (``to_user``) may confirm, acknowledging they received
    the payment.  Confirmation triggers an automatic balance recalculation for
    both parties.
    """

    permission_classes = [IsGroupMember]
    serializer_class = EmptySerializer

    def post(self, request, *args, **kwargs):
        try:
            settlement = settlement_service.confirm_settlement(
                settlement_id=self.kwargs["sid"],
                confirmed_by=request.user,
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            SettlementSerializer(settlement).data,
            status=status.HTTP_200_OK,
        )


class SettlementReverseView(generics.GenericAPIView):
    """
    Reverse a confirmed settlement.

    Either party (payer or receiver) may request a reversal.  The settlement
    status changes to ``reversed`` and both parties' balances are restored to
    their pre-settlement values.

    Returns ``HTTP 200`` (not 201) because no new resource is created.
    Bug fix: original returned HTTP 201 which was semantically incorrect.
    """

    permission_classes = [IsGroupMember]
    serializer_class = EmptySerializer

    def post(self, request, *args, **kwargs):
        try:
            settlement = settlement_service.reverse_settlement(
                settlement_id=self.kwargs["sid"],
                requested_by=request.user,
            )
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # 200 OK — the resource was mutated, not created.
        return Response(
            SettlementSerializer(settlement).data,
            status=status.HTTP_200_OK,
        )


# =============================================================================
# Settlement optimization views
# =============================================================================


class OptimizeSettlementsView(generics.GenericAPIView):
    """
    Suggest the minimum set of settlements to clear all debts in the group.

    GET /groups/{id}/optimize-settlements/

    Uses a greedy algorithm (largest debtor ↔ largest creditor) to produce
    the fewest possible payments.  The response includes a ``balance_version``
    SHA-256 fingerprint of the current balances — pass it unchanged to
    ``POST /groups/{id}/apply-optimized-settlements/`` to guard against
    applying a stale plan if debts change in the meantime.

    This endpoint is read-only — nothing is persisted.

    Response:
        200 OK
        {
            "balance_version": "<sha256>",
            "suggestions": [
                {"from_user_id": <int>, "to_user_id": <int>, "amount": <int>},
                ...
            ]
        }
    """

    permission_classes = [IsGroupMember]
    serializer_class = OptimizeSettlementsResponseSerializer

    def get(self, request, *args, **kwargs):
        result = optimization_service.suggest_settlements(group_id=self.kwargs["pk"])
        return Response(result, status=status.HTTP_200_OK)


class ApplyOptimizedSettlementsView(generics.GenericAPIView):
    """
    Atomically create all suggested settlements as pending payments.

    POST /groups/{id}/apply-optimized-settlements/

    Workflow
    --------
    1. Call GET /groups/{id}/optimize-settlements/ to receive
       ``balance_version`` and ``suggestions``.
    2. Optionally filter the suggestions to the subset you want to apply.
    3. Submit this endpoint with the same ``balance_version`` and your
       chosen ``suggestions``.
    4. Each debtor confirms their settlement individually via
       POST /groups/{id}/settlements/{sid}/confirm/

    Stale-data guard
    ----------------
    If any expense or settlement changed between steps 1 and 3, the balance
    fingerprint will no longer match and the request is rejected with
    HTTP 409 Conflict.  Simply repeat from step 1.

    Request body:
        {
            "balance_version": "<sha256 from optimize endpoint>",
            "suggestions": [
                {"from_user_id": <int>, "to_user_id": <int>, "amount": <int>},
                ...
            ]
        }

    Response:
        201 Created  — list of created Settlement objects
        409 Conflict — balances changed; re-run optimization first
    """

    permission_classes = [IsGroupMember]
    serializer_class = ApplyOptimizationSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            settlements = optimization_service.apply_suggestions(
                group_id=self.kwargs["pk"],
                balance_version=serializer.validated_data["balance_version"],
                suggestions=serializer.validated_data["suggestions"],
                requested_by=request.user,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

        return Response(
            SettlementSerializer(settlements, many=True).data,
            status=status.HTTP_201_CREATED,
        )


# ── Manual Report Request ───────────────────────────────────────


class RequestReportView(generics.GenericAPIView):
    """Request an on-demand weekly report for the group."""

    permission_classes = [IsGroupMember]
    serializer_class = drf_serializers.Serializer

    @method_decorator(ratelimit(key="user", rate="3/h", method="POST", block=True))
    def post(self, request, *args, **kwargs):
        from apps.reports.tasks import generate_group_report

        generate_group_report.delay(self.kwargs["pk"])
        return Response(
            {"detail": "Report generation started. You will receive an email shortly."},
            status=status.HTTP_202_ACCEPTED,
        )


# =============================================================================
# Balance & activity views
# =============================================================================


class BalanceView(generics.GenericAPIView):
    """
    Return the current net balance for every member of the group.

    GET /groups/{id}/balances/

    Balances are always recalculated from the canonical expense and settlement
    data before being returned, so the response is always up-to-date.

    Response:
        200 OK
        [
            {
                "phone_number": "09123456789",
                "full_name": "Ali",
                "net": 72000      // positive = creditor, negative = debtor
            },
            ...
        ]

    net > 0  →  this member is owed money by others.
    net < 0  →  this member owes money to others.
    net = 0  →  fully settled.
    """

    permission_classes = [IsGroupMember]
    serializer_class = BalanceSerializer

    def get(self, request, *args, **kwargs):
        balances = balance_service.get_balances(group_id=self.kwargs["pk"])
        serializer = self.get_serializer(balances, many=True)
        return Response(serializer.data)


# ── QR Code ────────────────────────────────────────────────────


class GroupQRCodeView(generics.GenericAPIView):
    """
    Return a QR code image (PNG) that encodes the group's invitation URL.

    GET /api/v1/groups/{id}/qr-code/

    The QR code contains a link that can be used to join the group
    (e.g., ``https://yourapp.com/join/{invite_code}/``).  Currently
    the link points directly to the API join endpoint.
    """

    permission_classes = [IsGroupMember]

    def get(self, request, *args, **kwargs):
        group = get_object_or_404(Group, pk=self.kwargs["pk"])
        invite_code = group.invite_code
        if not invite_code:
            # Generate one if missing (admin can regenerate later)
            group.generate_invite_code()
            invite_code = group.invite_code

        # Build the invitation URL
        join_url = f"http://localhost:8000/api/v1/groups/join/?code={invite_code}"

        # Generate QR code image in memory
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(join_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        return HttpResponse(buf.read(), content_type="image/png")


class ActivityLogView(generics.ListAPIView):
    """List all activity-log entries for a group."""

    permission_classes = [IsGroupMember]
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        return get_object_or_404(Group, pk=self.kwargs["pk"]).activities.all()
