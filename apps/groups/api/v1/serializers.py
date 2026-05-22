import logging

from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.groups.models import (
    Group,
    Membership,
    Expense,
    ExpenseSplit,
    ExpenseItem,
    ExpenseItemShare,
    ActivityLog,
)

User = get_user_model()
logger = logging.getLogger("accounts")


# ═══════════════════════════════════════════════════════════════════
# 1. Membership Serializers (defined before GroupSerializer)
# ═══════════════════════════════════════════════════════════════════


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership responses (used inside GroupSerializer)."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_phone", "user_name", "role", "joined_at")
        read_only_fields = ("id", "joined_at")


class AddMemberSerializer(serializers.Serializer):
    """Serializer for adding a member by phone number."""

    phone_number = serializers.CharField(max_length=11)

    def validate_phone_number(self, value):
        """Validate that the phone number belongs to an existing user."""
        if not User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("User with this phone number not found.")
        return value


class MembershipResponseSerializer(serializers.ModelSerializer):
    """Serializer for membership creation response."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_phone", "user_name", "role", "joined_at")
        read_only_fields = ("id", "joined_at")


# ═══════════════════════════════════════════════════════════════════
# 2. Group Serializers
# ═══════════════════════════════════════════════════════════════════


class GroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new group (POST). Only validates input."""

    class Meta:
        model = Group
        fields = ("name", "description", "budget_limit")


class GroupSerializer(serializers.ModelSerializer):
    """Serializer for group details (GET/PATCH)."""

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

    def get_total_expenses(self, obj):
        return obj.total_expenses()

    def get_remaining_budget(self, obj):
        return obj.remaining_budget()


# ═══════════════════════════════════════════════════════════════════
# 3. Expense Serializers
# ═══════════════════════════════════════════════════════════════════


class ExpenseSplitSerializer(serializers.ModelSerializer):
    """
    Serializer for a user's split in an expense (equal/exact/percentage).

    The client may send a 'percentage' field for percentage-based splits.
    The 'user' field is a PrimaryKeyRelatedField that expects a user ID
    as input and serializes as the user's primary key.
    """

    percentage = serializers.IntegerField(required=False, min_value=0, max_value=100)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseSplit
        fields = ("user", "amount", "percentage", "settled")
        extra_kwargs = {
            "amount": {"required": False},
        }


class ExpenseItemShareSerializer(serializers.ModelSerializer):
    """Serializer for a user's share of a specific item."""

    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseItemShare
        fields = ("user", "amount", "is_confirmed")


class ExpenseItemSerializer(serializers.ModelSerializer):
    """Serializer for an item within an itemized expense."""

    shares = ExpenseItemShareSerializer(many=True)

    class Meta:
        model = ExpenseItem
        fields = ("name", "total_amount", "shares")


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new expense (POST).

    Only validates input. Creation is handled by ExpenseService.
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

    def validate(self, data):
        split_type = data.get("split_type")

        if split_type in ["equal", "exact"]:
            splits_data = self.initial_data.get("splits", [])
            if not splits_data:
                raise serializers.ValidationError("splits required for equal/exact")
            for split in splits_data:
                if "amount" not in split:
                    raise serializers.ValidationError(
                        "Each split must have an 'amount' for equal/exact."
                    )

        elif split_type == "percentage":
            splits_data = self.initial_data.get("splits", [])
            if not splits_data:
                raise serializers.ValidationError("splits required for percentage")
            total_percentage = 0
            for split in splits_data:
                if "percentage" not in split:
                    raise serializers.ValidationError(
                        "Each split must have a 'percentage' for percentage split."
                    )
                total_percentage += split["percentage"]
            if total_percentage != 100:
                raise serializers.ValidationError(
                    f"Sum of percentages must be 100, got {total_percentage}."
                )

        elif split_type == "itemized":
            items_data = self.initial_data.get("items", [])
            if not items_data:
                raise serializers.ValidationError("items required for itemized")

        return data


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """Serializer for expense details (GET/PATCH)."""

    splits = ExpenseSplitSerializer(many=True, read_only=True)
    items = ExpenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"


# ═══════════════════════════════════════════════════════════════════
# 4. Activity, Balance, and Invite Serializers
# ═══════════════════════════════════════════════════════════════════


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for activity log entries."""

    user_phone = serializers.CharField(source="user.phone_number", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ("id", "user", "user_phone", "action", "description", "timestamp")


class BalanceSerializer(serializers.Serializer):
    """Serializer for net balance information."""

    phone_number = serializers.CharField()
    full_name = serializers.CharField()
    paid = serializers.IntegerField()
    owed = serializers.IntegerField()
    net = serializers.IntegerField()


class InviteCodeSerializer(serializers.Serializer):
    """Serializer for generating a new invite code (no input)."""

    pass


class JoinByInviteSerializer(serializers.Serializer):
    """Serializer for joining a group via invitation code."""

    invite_code = serializers.CharField(max_length=8)
