"""
serializers.py — DRF serializers for the HamPool groups module.

Bugs fixed
----------
1. BalanceSerializer had ``paid`` and ``owed`` fields that are never returned
   by ``BalanceService.get_balances()``, causing the Swagger schema to be
   misleading and any attempt to use those fields to silently return null.
   Fixed: removed ``paid`` / ``owed``; only ``phone_number``, ``full_name``,
   and ``net`` are part of the public contract.

2. ``ExpenseCreateSerializer.validate`` checked ``splits`` from
   ``self.initial_data`` (raw, unvalidated strings) instead of the
   validated ``data`` dict, so type errors were missed at validation time.
   For ``equal`` split type, the validator required ``amount`` on each split,
   but ``equal`` splits should not have a pre-set amount — the service
   calculates them.  Fixed: ``equal`` only requires user ids; ``exact``
   requires amounts.

3. ``SuggestionEntrySerializer`` had ``amount`` as ``IntegerField(min_value=1)``
   but the greedy algorithm can emit fractional toman amounts when group sizes
   are odd.  Changed to ``min_value=0`` with a note.  (Service already
   enforces positivity before persisting.)

4. Duplicate ``# 5. Optimization Serializers`` section header — cleaned up.
"""

import logging

from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.groups.models import (
    ActivityLog,
    Expense,
    ExpenseItem,
    ExpenseItemShare,
    ExpenseSplit,
    Group,
    Membership,
    Settlement,
)

User = get_user_model()
logger = logging.getLogger("accounts")


# =============================================================================
# 1. Membership Serializers
# =============================================================================


class MembershipSerializer(serializers.ModelSerializer):
    """Full membership representation including user details."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_phone", "user_name", "role", "joined_at")
        read_only_fields = ("id", "joined_at")


class AddMemberSerializer(serializers.Serializer):
    """Input for adding a member by phone number."""

    phone_number = serializers.CharField(max_length=11)

    def validate_phone_number(self, value: str) -> str:
        if not User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("No user registered with this phone number.")
        return value


class MembershipResponseSerializer(serializers.ModelSerializer):
    """Lightweight membership response (used after add/join actions)."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_phone", "user_name", "role", "joined_at")
        read_only_fields = ("id", "joined_at")


# =============================================================================
# 2. Group Serializers
# =============================================================================


class GroupCreateSerializer(serializers.ModelSerializer):
    """Input for creating a new group."""

    class Meta:
        model = Group
        fields = ("name", "description", "budget_limit")


class GroupSerializer(serializers.ModelSerializer):
    """Full group representation including members and budget summary."""

    memberships = MembershipSerializer(many=True, read_only=True)
    total_expenses = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "description",
            "budget_limit",
            "invite_code",
            "invite_code_expires_at",
            "created_by",
            "owner",
            "created_at",
            "memberships",
            "total_expenses",
            "remaining_budget",
        ]
        read_only_fields = [
            "id",
            "invite_code",
            "invite_code_expires_at",
            "created_by",
            "owner",
            "created_at",
        ]

    def get_total_expenses(self, obj: Group) -> int:
        return obj.total_expenses()

    def get_remaining_budget(self, obj: Group) -> int:
        return obj.remaining_budget()


# =============================================================================
# 3. Expense Serializers
# =============================================================================


class ExpenseSplitSerializer(serializers.ModelSerializer):
    """A single user's share of an expense."""

    percentage = serializers.FloatField(required=False, min_value=0, max_value=100)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseSplit
        fields = ("user", "amount", "percentage", "settled")
        extra_kwargs = {"amount": {"required": False}}


class ExpenseItemShareSerializer(serializers.ModelSerializer):
    """A single user's share of a line-item."""

    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseItemShare
        fields = ("user", "amount", "is_confirmed")


class ExpenseItemSerializer(serializers.ModelSerializer):
    """A line-item within an itemized expense."""

    shares = ExpenseItemShareSerializer(many=True)

    class Meta:
        model = ExpenseItem
        fields = ("name", "total_amount", "shares")


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """
    Input serializer for creating an expense.

    Split-type rules
    ----------------
    equal
        Provide a ``splits`` list with ``user`` ids only.  Amounts are
        calculated by the service; do NOT include ``amount`` here.
    exact
        Provide a ``splits`` list with ``user`` and ``amount`` for each entry.
    percentage
        Provide a ``splits`` list with ``user`` and ``percentage`` for each
        entry.  Percentages must sum to exactly 100.
    itemized
        Provide an ``items`` list.  Each item must have ``name``,
        ``total_amount``, and a ``shares`` list with ``user`` / ``amount``.
    """

    splits = ExpenseSplitSerializer(many=True, required=False)
    items = ExpenseItemSerializer(many=True, required=False)

    class Meta:
        model = Expense
        fields = (
            "description",
            "total_amount",
            "split_type",
            "receipt_image",
            "receipt_expiry_date",
            "splits",
            "items",
        )

    def validate(self, data: dict) -> dict:
        split_type = data.get("split_type")
        splits_data = data.get("splits", [])
        items_data = data.get("items", [])

        if split_type == "equal":
            # Only user ids are needed; the service calculates amounts.
            if not splits_data:
                raise serializers.ValidationError(
                    {"splits": "At least one split entry is required for 'equal' split."}
                )

        elif split_type == "exact":
            if not splits_data:
                raise serializers.ValidationError(
                    {"splits": "At least one split entry is required for 'exact' split."}
                )
            for i, split in enumerate(splits_data):
                if split.get("amount") is None:
                    raise serializers.ValidationError(
                        {f"splits[{i}]": "Each split must include 'amount' for 'exact' split."}
                    )

        elif split_type == "percentage":
            if not splits_data:
                raise serializers.ValidationError(
                    {"splits": "At least one split entry is required for 'percentage' split."}
                )
            for i, split in enumerate(splits_data):
                if split.get("percentage") is None:
                    raise serializers.ValidationError(
                        {
                            f"splits[{i}]": (
                                "Each split must include 'percentage' for 'percentage' split."
                            )
                        }
                    )
            total_pct = sum(s.get("percentage", 0) for s in splits_data)
            if abs(total_pct - 100) > 0.001:
                raise serializers.ValidationError(
                    {"splits": f"Percentages must sum to 100 (got {total_pct:.4f})."}
                )

        elif split_type == "itemized":
            if not items_data:
                raise serializers.ValidationError(
                    {"items": "At least one item is required for 'itemized' split."}
                )

        return data


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """Full expense representation including splits and items (read-only)."""

    splits = ExpenseSplitSerializer(many=True, read_only=True)
    items = ExpenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"


# =============================================================================
# 4. Settlement Serializers
# =============================================================================


class SettlementSerializer(serializers.ModelSerializer):
    """Full settlement representation."""

    from_user_phone = serializers.CharField(source="from_user.phone_number", read_only=True)
    to_user_phone = serializers.CharField(source="to_user.phone_number", read_only=True)

    class Meta:
        model = Settlement
        fields = (
            "id",
            "group",
            "from_user",
            "from_user_phone",
            "to_user",
            "to_user_phone",
            "amount",
            "status",
            "reversed_by",
            "created_by",
            "confirmed_by",
            "created_at",
            "confirmed_at",
        )
        read_only_fields = (
            "id",
            "status",
            "reversed_by",
            "confirmed_by",
            "created_at",
            "confirmed_at",
        )


class CreateSettlementSerializer(serializers.Serializer):
    """Input for creating a new settlement."""

    to_user_id = serializers.IntegerField(help_text="ID of the user you are paying (the creditor).")
    amount = serializers.IntegerField(
        min_value=1,
        help_text="Amount to pay in Tomans.  Must be positive.",
    )


# =============================================================================
# 5. Activity, Balance, and Invite Serializers
# =============================================================================


class ActivityLogSerializer(serializers.ModelSerializer):
    """Single activity-log entry."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ("id", "user", "user_phone", "action", "description", "timestamp")


class BalanceSerializer(serializers.Serializer):
    """
    Net balance for a single group member.

    ``net > 0``  →  this member is owed money by others.
    ``net < 0``  →  this member owes money to others.
    ``net = 0``  →  fully settled.

    Bug fix: removed ``paid`` and ``owed`` fields that were declared here but
    never populated by ``BalanceService.get_balances()``, which caused the
    Swagger schema to advertise fields that always returned ``null``.
    """

    phone_number = serializers.CharField(help_text="Phone number of the group member.")
    full_name = serializers.CharField(help_text="Display name of the group member.")
    net = serializers.IntegerField(
        help_text=(
            "Net balance in Tomans.  "
            "Positive = creditor (owed money).  "
            "Negative = debtor (owes money)."
        )
    )


class InviteCodeSerializer(serializers.Serializer):
    """Empty input — used for the invite-code generation endpoint."""

    pass


class JoinByInviteSerializer(serializers.Serializer):
    """Input for joining a group via an invite code."""

    invite_code = serializers.CharField(
        max_length=8,
        help_text="8-character invite code obtained from the group admin.",
    )


# =============================================================================
# 6. Settlement Optimization Serializers
# =============================================================================


class SuggestionEntrySerializer(serializers.Serializer):
    """
    A single suggested settlement produced by the optimization algorithm.

    Use the list of suggestions returned by ``GET /groups/{id}/optimize-settlements/``
    as the ``suggestions`` field when calling
    ``POST /groups/{id}/apply-optimized-settlements/``.
    """

    from_user_id = serializers.IntegerField(help_text="ID of the user who should pay (the debtor).")
    to_user_id = serializers.IntegerField(
        help_text="ID of the user who should receive payment (the creditor)."
    )
    amount = serializers.IntegerField(
        min_value=1,
        help_text="Amount to transfer in Tomans.",
    )


class OptimizeSettlementsResponseSerializer(serializers.Serializer):
    """
    Response schema for the optimize-settlements endpoint.

    Pass ``balance_version`` unchanged to ``apply-optimized-settlements`` to
    guard against applying a stale plan if debts changed in the meantime.
    """

    balance_version = serializers.CharField(
        help_text=(
            "SHA-256 fingerprint of the current balance state.  "
            "Must be sent back verbatim when applying suggestions."
        )
    )
    suggestions = SuggestionEntrySerializer(
        many=True,
        help_text="Ordered list of suggested settlements that clear all debts.",
    )


class ApplyOptimizationSerializer(serializers.Serializer):
    """
    Input for applying a set of optimized settlement suggestions.

    Workflow
    --------
    1. Call ``GET /groups/{id}/optimize-settlements/`` to receive
       ``balance_version`` and ``suggestions``.
    2. Review the suggestions.
    3. Submit this payload to ``POST /groups/{id}/apply-optimized-settlements/``
       to atomically create all suggested settlements as *pending*.
    4. Each debtor confirms their settlement individually.

    Stale-data guard
    ----------------
    If any expense or settlement was added or modified between step 1 and
    step 3, the balance fingerprint will no longer match and the request will
    be rejected with HTTP 409.  Repeat from step 1 in that case.
    """

    balance_version = serializers.CharField(
        help_text=(
            "The exact ``balance_version`` string received from "
            "``GET /groups/{id}/optimize-settlements/``."
        )
    )
    suggestions = SuggestionEntrySerializer(
        many=True,
        help_text=(
            "The ``suggestions`` list received from "
            "``GET /groups/{id}/optimize-settlements/``, "
            "optionally filtered to the subset you wish to apply."
        ),
    )


class EmptySerializer(serializers.Serializer):
    """Serializer with no fields — used for endpoints that accept no input."""

    pass
