from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from django.utils.crypto import get_random_string


class Group(models.Model):
    """
    A shared group for managing collective expenses.

    Ownership:
        - 'owner' is the ultimate authority in the group.
        - Only the current owner can transfer ownership to another admin.
        - The owner cannot be removed or have their role changed by others.
        - When the owner leaves, ownership transfers to the earliest admin.

    Safe deletion is guaranteed by the overridden delete() method
    which removes related objects in the correct order before
    deleting the group itself.
    """

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    budget_limit = models.PositiveBigIntegerField(
        default=0, help_text="Total budget in Tomans (0 = no limit)"
    )
    invite_code = models.CharField(
        max_length=8,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="Short invitation code (8 characters), auto-generated.",
    )
    invite_code_expires_at = models.DateTimeField(
        null=True, blank=True, help_text="Invitation code validity (default 4 days)."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_groups"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_groups",
        help_text="Current owner of the group. Initially set to creator.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    # ── Financial helpers ──────────────────────────────────────────

    def total_expenses(self):
        """Return sum of all confirmed expenses in this group."""
        return (
            self.expenses.filter(is_confirmed=True).aggregate(total=Sum("total_amount"))["total"]
            or 0
        )

    def remaining_budget(self):
        """Return budget_limit - total_expenses (None if no limit)."""
        if self.budget_limit == 0:
            return None
        return self.budget_limit - self.total_expenses()

    # ── Invitation code management ─────────────────────────────────

    def generate_invite_code(self, validity_days=4):
        """
        Generate a new 8-character invitation code valid for `validity_days`.
        Saves the instance.
        """
        self.invite_code = get_random_string(8)
        self.invite_code_expires_at = timezone.now() + timedelta(days=validity_days)
        self.save(update_fields=["invite_code", "invite_code_expires_at"])

    def is_invite_code_valid(self):
        """Check if the current invite code is non-null and not expired."""
        if not self.invite_code or not self.invite_code_expires_at:
            return False
        return timezone.now() < self.invite_code_expires_at

    # ── Ownership helpers ──────────────────────────────────────────

    def get_earliest_admin(self):
        """
        Return the earliest admin membership (by joined_at) excluding the owner.
        Used to transfer ownership when the owner leaves.
        """
        return (
            self.memberships.filter(role="admin")
            .exclude(user=self.owner)
            .order_by("joined_at")
            .first()
        )

    # ── Safe deletion ──────────────────────────────────────────────

    def delete(self, *args, **kwargs):
        """
        Overridden to safely delete all related objects before deleting
        the group itself.

        This avoids SQLite FOREIGN KEY constraint errors by ensuring
        the correct deletion order in Python:
        1. Activity logs
        2. Expenses (cascades to items, shares, splits)
        3. Memberships
        4. The group itself
        """
        # 1. Delete all activity logs for this group explicitly
        ActivityLog.objects.filter(group=self).delete()
        # 2. Delete all expenses (this cascades to items, shares, splits)
        self.expenses.all().delete()
        # 3. Delete all memberships
        self.memberships.all().delete()
        # 4. Finally, delete the group itself
        super().delete(*args, **kwargs)


class Membership(models.Model):
    """
    Intermediate model linking User and Group with a role.
    """

    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("member", "Member"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "group")

    def __str__(self):
        return f"{self.user} in {self.group}"


class Expense(models.Model):
    """
    An expense record inside a group.

    Supports equal, exact, percentage, and itemized splits.
    """

    SPLIT_TYPES = [
        ("equal", "Equal"),
        ("exact", "Exact Amount"),
        ("percentage", "Percentage"),
        ("itemized", "Itemized"),
    ]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="expenses")
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="paid_expenses"
    )
    description = models.TextField()
    total_amount = models.PositiveBigIntegerField(help_text="Total amount in Tomans")
    split_type = models.CharField(max_length=10, choices=SPLIT_TYPES)
    is_confirmed = models.BooleanField(
        default=False, help_text="Confirmed by all involved users or admin"
    )
    receipt_image = models.ImageField(upload_to="receipts/", blank=True, null=True)
    receipt_expiry_date = models.DateTimeField(blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.description} ({self.total_amount} T)"


class ExpenseSplit(models.Model):
    """
    Share of one user in an expense (used for equal, exact, percentage).
    """

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="splits")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expense_splits"
    )
    amount = models.PositiveBigIntegerField()
    settled = models.BooleanField(default=False, help_text="True if this share has been settled")

    class Meta:
        unique_together = ("expense", "user")

    def __str__(self):
        return f"{self.user} owes {self.amount} for {self.expense}"


class ExpenseItem(models.Model):
    """
    A single item within an itemized expense.
    """

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=200)
    total_amount = models.PositiveBigIntegerField()

    def __str__(self):
        return f"{self.name} ({self.total_amount} T)"


class ExpenseItemShare(models.Model):
    """
    Share of one user for a specific item in an itemized expense.
    """

    item = models.ForeignKey(ExpenseItem, on_delete=models.CASCADE, related_name="shares")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="item_shares"
    )
    amount = models.PositiveBigIntegerField()
    is_confirmed = models.BooleanField(
        default=False, help_text="Confirmed by this user (future phase)"
    )

    class Meta:
        unique_together = ("item", "user")

    def __str__(self):
        return f"{self.user} share {self.amount} for {self.item}"


class ActivityLog(models.Model):
    """
    Records all group-related events for transparency.

    Uses standard CASCADE on the Group foreign key. Safe deletion is
    handled by Group.delete() which removes ActivityLog entries first.
    """

    ACTION_TYPES = [
        ("group_created", "Group Created"),
        ("member_joined", "Member Joined"),
        ("member_left", "Member Left"),
        ("member_role_changed", "Member Role Changed"),
        ("expense_created", "Expense Created"),
        ("expense_confirmed", "Expense Confirmed"),
        ("expense_deleted", "Expense Deleted"),
    ]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="activities")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    action = models.CharField(max_length=30, choices=ACTION_TYPES)
    description = models.CharField(max_length=500, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.group}"
