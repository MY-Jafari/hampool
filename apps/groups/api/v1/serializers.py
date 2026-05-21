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


# ── Group Create Serializer ────────────────────────────────────────


class GroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new group (POST)."""

    class Meta:
        model = Group
        fields = ("name", "description", "budget_limit")


# ── Membership Serializers ────────────────────────────────────────


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership responses."""

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


# ── Group Serializer ──────────────────────────────────────────────


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


# ── Expense Serializers ───────────────────────────────────────────


class ExpenseSplitSerializer(serializers.ModelSerializer):
    """
    Serializer for a user's split in an expense.

    For 'percentage' split_type, the client sends 'percentage' (int, 0-100)
    and the amount is calculated automatically.
    For other types, 'amount' is required.
    """

    percentage = serializers.IntegerField(required=False, min_value=0, max_value=100)

    class Meta:
        model = ExpenseSplit
        fields = ("user", "amount", "percentage", "settled")
        extra_kwargs = {
            "amount": {"required": False},
        }

    def validate(self, data):
        # For percentage, percentage field must be present; amount will be set later
        return data


class ExpenseItemShareSerializer(serializers.ModelSerializer):
    """Serializer for a user's share of a specific item."""

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

    Supports equal, exact, percentage, and itemized splits.
    - equal/exact: splits with 'amount'
    - percentage: splits with 'percentage' (sum must be 100)
    - itemized: items with shares (amount)
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
            # Ensure each split has 'amount'
            for split in splits_data:
                if "amount" not in split:
                    raise serializers.ValidationError(
                        "Each split must have an 'amount' for equal/exact."
                    )
            if split_type == "exact":
                # Optional: check sum of amounts == total_amount
                pass

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
            # Validation of item shares can be added if needed

        return data

    def create(self, validated_data):
        splits_data = self.initial_data.get("splits", [])
        items_data = self.initial_data.get("items", [])
        validated_data.pop("splits", None)
        validated_data.pop("items", None)

        expense = Expense.objects.create(**validated_data)

        if expense.split_type in ["equal", "exact"]:
            for split in splits_data:
                ExpenseSplit.objects.create(
                    expense=expense, user_id=split["user"], amount=split["amount"]
                )

        elif expense.split_type == "percentage":
            total_amount = expense.total_amount
            for split in splits_data:
                percent = split["percentage"]
                amount = int(total_amount * percent / 100)
                ExpenseSplit.objects.create(expense=expense, user_id=split["user"], amount=amount)

        elif expense.split_type == "itemized":
            for item_data in items_data:
                shares_data = item_data.pop("shares")
                item = ExpenseItem.objects.create(expense=expense, **item_data)
                for share in shares_data:
                    ExpenseItemShare.objects.create(
                        item=item, user_id=share["user"], amount=share["amount"]
                    )
        return expense


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """Serializer for expense details (GET/PATCH)."""

    splits = ExpenseSplitSerializer(many=True, read_only=True)
    items = ExpenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"


# ── Activity & Balance Serializers ────────────────────────────────


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
