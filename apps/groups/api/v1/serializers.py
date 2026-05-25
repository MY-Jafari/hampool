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
    Settlement,
)

User = get_user_model()
logger = logging.getLogger("accounts")


# ═══════════════════════════════════════════════════════════════════
# 1. Membership Serializers
# ═══════════════════════════════════════════════════════════════════


class MembershipSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source="user.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_phone", "user_name", "role", "joined_at")
        read_only_fields = ("id", "joined_at")


class AddMemberSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)

    def validate_phone_number(self, value):
        if not User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("User with this phone number not found.")
        return value


class MembershipResponseSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = Group
        fields = ("name", "description", "budget_limit")


class GroupSerializer(serializers.ModelSerializer):
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
    percentage = serializers.IntegerField(required=False, min_value=0, max_value=100)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseSplit
        fields = ("user", "amount", "percentage", "settled")
        extra_kwargs = {"amount": {"required": False}}


class ExpenseItemShareSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ExpenseItemShare
        fields = ("user", "amount", "is_confirmed")


class ExpenseItemSerializer(serializers.ModelSerializer):
    shares = ExpenseItemShareSerializer(many=True)

    class Meta:
        model = ExpenseItem
        fields = ("name", "total_amount", "shares")


class ExpenseCreateSerializer(serializers.ModelSerializer):
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
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    items = ExpenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"


# ═══════════════════════════════════════════════════════════════════
# 4. Settlement Serializers
# ═══════════════════════════════════════════════════════════════════


class SettlementSerializer(serializers.ModelSerializer):
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
    to_user_id = serializers.IntegerField()
    amount = serializers.IntegerField(min_value=1)


# ═══════════════════════════════════════════════════════════════════
# 5. Activity, Balance, and Invite Serializers
# ═══════════════════════════════════════════════════════════════════


class ActivityLogSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source="user.phone_number", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ("id", "user", "user_phone", "action", "description", "timestamp")


class BalanceSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    full_name = serializers.CharField()
    paid = serializers.IntegerField()
    owed = serializers.IntegerField()
    net = serializers.IntegerField()


class InviteCodeSerializer(serializers.Serializer):
    pass


class JoinByInviteSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=8)
