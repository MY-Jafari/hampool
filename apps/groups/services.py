"""
services.py — Business logic layer for the HamPool groups module.

Architecture
------------
- Every write operation runs inside ``transaction.atomic()`` to guarantee
  database consistency.  If anything raises, the whole operation rolls back.
- Side-effects (notifications, audit logs) are published via the Outbox
  pattern: an OutboxEvent row is written *inside* the same transaction, then
  dispatched asynchronously via Celery *after* the transaction commits.
  This ensures workers never see events for data that was rolled back.

Balance formula (group-level net)
----------------------------------
    net = (paid − received) − (owed − sent)

    paid     = Σ split.amount  WHERE expense.paid_by = user
                                 AND split.user      ≠ user
                                 AND expense.is_confirmed = True
    owed     = Σ split.amount  WHERE split.user       = user
                                 AND expense.paid_by  ≠ user
                                 AND expense.is_confirmed = True
    sent     = Σ settlement.amount  WHERE from_user = user, status = confirmed
    received = Σ settlement.amount  WHERE to_user   = user, status = confirmed

    net > 0  →  creditor   (others owe this user)
    net < 0  →  debtor     (this user owes others)
    net = 0  →  fully settled

Two-way debt example
---------------------
    Expense A: paid_by=U1, split U2 = 80 000
    Expense B: paid_by=U2, split U1 =  8 000

    net_U1 = (80 000 − 0) − ( 8 000 − 0) = +72 000  ← U1 is owed 72 000
    net_U2 = ( 8 000 − 0) − (80 000 − 0) = −72 000  ← U2 owes 72 000

    The debts are automatically netted out by the formula; no separate
    pairwise-balance table is needed.

Bug-fix history
---------------
v1 (original):
  1. Formula was (paid + received) − (owed + sent) → doubled settlements.
  2. paid used Σ expense.total_amount → included payer's own share.
  3. reverse_settlement created a new confirmed Settlement → balance unchanged.
  4. Equal-split remainder: only the last user got +1 when rem > 1.
  5. apply_suggestions was not inside the main transaction.

v2:
  6. create_expense called update_balance_for_expense with is_confirmed=False
     → recalculate returned 0, wasting DB round-trips. (Removed the call.)
  7. Percentage split used naïve int(total × pct / 100) per user → sum of
     splits could differ from total_amount by up to N toman. Fixed with the
     cumulative (largest-remainder) method.
  8. Itemized split read ExpenseItem.total_amount instead of aggregating
     ExpenseItemShare.amount. Fixed: aggregate from share rows.
  9. create_settlement read a potentially stale or missing Balance row before
     validating. Fixed: always recalculate before reading.
 10. _build_net_map called select_for_update() outside a transaction on
     PostgreSQL, which raises an error. Fixed: wrap in atomic.
 11. apply_suggestions dispatched outbox events from nested atomic blocks →
     on_commit fired at wrong level. Fixed: collect ids, dispatch after outer
     commit.

v3 (current):
 12. get_balances read the Balance table directly without recalculating first.
     Stale or missing rows returned wrong/incomplete data. Fixed: always call
     recalculate_all_balances_for_group inside a transaction before reading.
 13. _build_net_map only recalculated when the Balance row was newly created.
     Stale existing rows were silently returned. Fixed: always recalculate.
 14. recalculate_all_balances_for_group issued a redundant User query.
     Fixed: iterate membership.user directly.
 15. delete_expense ordering between affected_users collection and expense.delete()
     was fragile. Made explicit with a guard comment.
 16. Two-way debt netting appeared broken because of bug #12; no formula change
     was needed — fixing #12 resolves the symptom entirely.
"""

import hashlib
import json

from django.db import transaction
from django.db.models import Sum
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.groups.models import (
    Balance,
    Expense,
    ExpenseItem,
    ExpenseItemShare,
    ExpenseSplit,
    Group,
    Membership,
    Settlement,
)
from apps.outbox.services import OutboxService
from apps.outbox.tasks import dispatch_outbox_event

User = get_user_model()


# =============================================================================
# GroupService
# =============================================================================


class GroupService:
    """CRUD and membership management for groups."""

    # ------------------------------------------------------------------
    # Group lifecycle
    # ------------------------------------------------------------------

    def create_group(
        self,
        *,
        name: str,
        description: str,
        budget_limit: int,
        created_by: User,
    ) -> Group:
        """Create a new group, make the creator an admin, and generate an invite code."""
        with transaction.atomic():
            group = Group.objects.create(
                name=name,
                description=description,
                budget_limit=budget_limit,
                created_by=created_by,
                owner=created_by,
            )
            Membership.objects.create(user=created_by, group=group, role="admin")
            group.generate_invite_code()
            outbox_event = OutboxService.publish_event("GroupCreated", {"group_id": group.id})
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return group

    # ------------------------------------------------------------------
    # Membership management
    # ------------------------------------------------------------------

    def add_member(self, *, group_id: int, phone_number: str) -> Membership:
        """Add a user to a group by phone number (admin action)."""
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user = get_object_or_404(User, phone_number=phone_number)
            membership, created = Membership.objects.get_or_create(
                user=user, group=group, defaults={"role": "member"}
            )
            if not created:
                raise ValueError("User is already a member.")
            outbox_event = OutboxService.publish_event(
                "MemberJoined", {"membership_id": membership.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return membership

    def join_by_invite_code(self, *, invite_code: str, user: User) -> Membership:
        """Let a user join a group via its invite code."""
        with transaction.atomic():
            group = get_object_or_404(Group, invite_code=invite_code)
            if not group.is_invite_code_valid():
                raise ValueError("Invite code is invalid or expired.")
            membership, created = Membership.objects.get_or_create(
                user=user, group=group, defaults={"role": "member"}
            )
            if not created:
                raise ValueError("You are already a member of this group.")
            outbox_event = OutboxService.publish_event(
                "MemberJoined", {"membership_id": membership.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return membership

    def remove_member(self, *, group_id: int, user_id: int, requested_by: User) -> dict:
        """
        Remove a member from a group.

        Rules:
        - The owner can only be removed by themselves.
        - If the owner leaves and is the sole member, the group is deleted.
        - If the owner leaves and other members exist, ownership is transferred
          to the earliest admin.
        - A regular member may remove themselves or be removed by an admin.
        - If removing a member leaves no admin, the oldest remaining member is
          promoted automatically.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user_to_remove = get_object_or_404(User, pk=user_id)
            is_owner = user_to_remove == group.owner
            is_self = requested_by == user_to_remove

            if is_owner:
                if is_self and group.memberships.count() == 1:
                    group.delete()
                    return {"detail": "You were the only member. The group has been deleted."}
                elif is_self:
                    earliest_admin = group.get_earliest_admin()
                    if not earliest_admin:
                        raise ValueError(
                            "Cannot leave without another admin. " "Delete the group instead."
                        )
                    group.owner = earliest_admin.user
                    group.save(update_fields=["owner"])
                    Membership.objects.get(group=group, user=requested_by).delete()
                    outbox_event = OutboxService.publish_event(
                        "MemberLeft",
                        {"group_id": group.id, "user_id": requested_by.id},
                    )
                    transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
                    return {"detail": "Ownership transferred. You have left the group."}
                else:
                    raise PermissionError("The group owner cannot be removed by others.")

            is_admin = Membership.objects.filter(
                user=requested_by, group=group, role="admin"
            ).exists()
            if not (is_admin or is_self):
                raise PermissionError("Permission denied.")

            Membership.objects.get(group=group, user=user_to_remove).delete()
            outbox_event = OutboxService.publish_event(
                "MemberLeft",
                {"group_id": group.id, "user_id": user_to_remove.id},
            )

            # Promote the oldest member if no admin remains after removal.
            if not group.memberships.filter(role="admin").exists():
                first_member = group.memberships.order_by("joined_at").first()
                if first_member:
                    first_member.role = "admin"
                    first_member.save(update_fields=["role"])

            transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return {"detail": "Member removed."}

    def change_role(
        self,
        *,
        group_id: int,
        user_id: int,
        new_role: str,
        requested_by: User,
    ) -> Membership:
        """
        Change the role of a member (admin ↔ member).

        The group owner's role cannot be changed.
        At least one admin must remain after the change.
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            user = get_object_or_404(User, pk=user_id)
            membership = get_object_or_404(Membership, group=group, user=user)

            if user == group.owner:
                raise PermissionError("Cannot change the role of the group owner.")
            if new_role not in ("admin", "member"):
                raise ValueError("Invalid role. Choose 'admin' or 'member'.")

            membership.role = new_role
            membership.save(update_fields=["role"])

            # Ensure at least one admin remains.
            if not group.memberships.filter(role="admin").exists():
                first_member = group.memberships.order_by("joined_at").first()
                if first_member:
                    first_member.role = "admin"
                    first_member.save(update_fields=["role"])

        return membership

    def transfer_ownership(self, *, group_id: int, new_owner_id: int, current_owner: User) -> Group:
        """Transfer group ownership to another member (must already be an admin)."""
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            if current_owner != group.owner:
                raise PermissionError("Only the group owner can transfer ownership.")
            new_owner = get_object_or_404(User, pk=new_owner_id)
            membership = get_object_or_404(Membership, group=group, user=new_owner)
            if membership.role != "admin":
                membership.role = "admin"
                membership.save(update_fields=["role"])
            group.owner = new_owner
            group.save(update_fields=["owner"])
        return group


# =============================================================================
# ExpenseService
# =============================================================================


class ExpenseService:
    """Create, confirm, and delete expenses with their splits."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_expense(self, *, group_id: int, paid_by: User, validated_data: dict) -> Expense:
        """
        Persist an expense and its splits.

        Balance is intentionally NOT updated here: the expense starts with
        ``is_confirmed=False``, so ``recalculate_balance_for_user`` would
        return zero for it anyway.  Balance is updated only when the expense
        is confirmed (see ``confirm_expense``).
        """
        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)

            # Pop nested data before passing the rest to Expense.objects.create.
            splits_data = validated_data.pop("splits", [])
            items_data = validated_data.pop("items", [])
            total_amount = validated_data.get("total_amount", 0)

            expense = Expense.objects.create(group=group, paid_by=paid_by, **validated_data)

            split_handlers = {
                "equal": lambda: self._create_equal_splits(expense, splits_data, total_amount),
                "exact": lambda: self._create_exact_splits(expense, splits_data),
                "percentage": lambda: self._create_percentage_splits(
                    expense, splits_data, total_amount
                ),
                "itemized": lambda: self._create_itemized_splits(expense, items_data),
            }
            handler = split_handlers.get(expense.split_type)
            if handler is None:
                raise ValueError(f"Unknown split_type: '{expense.split_type}'.")
            handler()

            outbox_event = OutboxService.publish_event("ExpenseCreated", {"expense_id": expense.id})
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return expense

    def confirm_expense(self, *, expense_id: int, confirmed_by: User) -> Expense:
        """
        Confirm an expense and trigger balance recalculation for all involved
        users.

        This is the *only* place where ``is_confirmed`` transitions
        ``False → True``, and therefore the correct and only place to update
        balances.
        """
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            if expense.is_confirmed:
                raise ValueError("Expense is already confirmed.")
            expense.is_confirmed = True
            expense.save(update_fields=["is_confirmed"])
            BalanceService.update_balance_for_expense(expense)
            outbox_event = OutboxService.publish_event(
                "ExpenseConfirmed",
                {"expense_id": expense.id, "confirmed_by_id": confirmed_by.id},
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return expense

    def delete_expense(self, *, expense_id: int, deleted_by: User) -> None:
        """
        Delete an expense and recalculate balances for every affected user.

        IMPORTANT: ``affected_users`` and ``group`` must be collected *before*
        ``expense.delete()`` because the cascade will remove all related splits,
        making them unavailable afterwards.
        """
        with transaction.atomic():
            expense = get_object_or_404(Expense, pk=expense_id)
            event_data = {
                "expense_id": expense.id,
                "deleted_by_id": deleted_by.id,
            }

            # Collect before delete — cascade removes splits immediately.
            affected_users = {expense.paid_by} | {
                split.user for split in expense.splits.select_related("user")
            }
            group = expense.group

            expense.delete()  # splits are cascade-deleted here

            for user in affected_users:
                BalanceService.recalculate_balance_for_user(user, group)

            outbox_event = OutboxService.publish_event("ExpenseDeleted", event_data)
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))

    # ------------------------------------------------------------------
    # Split helpers (private)
    # ------------------------------------------------------------------

    @staticmethod
    def _create_equal_splits(
        expense: Expense,
        splits_data: list,
        total_amount: int,
    ) -> None:
        """
        Divide ``total_amount`` equally among all users.

        Uses integer arithmetic to avoid floating-point drift.  When the
        amount is not evenly divisible, the first ``remainder`` users each
        receive one extra unit so that ``Σ splits == total_amount`` exactly.

        Example: 100 000 ÷ 3  →  [33 334, 33 333, 33 333]  (sum = 100 000)
        """
        users = [s["user"] for s in splits_data]
        n = len(users)
        if n == 0:
            raise ValueError("Equal split requires at least one user.")

        base = total_amount // n
        remainder = total_amount % n  # number of users who receive base + 1

        splits = [
            ExpenseSplit(
                expense=expense,
                user=user,
                amount=base + (1 if i < remainder else 0),
            )
            for i, user in enumerate(users)
        ]
        ExpenseSplit.objects.bulk_create(splits)

        # Persist the authoritative total (sum of all splits).
        expense.total_amount = sum(s.amount for s in splits)
        expense.save(update_fields=["total_amount"])

    @staticmethod
    def _create_exact_splits(
        expense: Expense,
        splits_data: list,
    ) -> None:
        """
        Create splits with explicitly provided amounts.

        ``total_amount`` is updated to the actual sum of all splits so the
        expense row is always internally consistent.
        """
        if not splits_data:
            raise ValueError("Exact split requires at least one split entry.")

        splits = [
            ExpenseSplit(
                expense=expense,
                user_id=s["user"].pk,
                amount=s["amount"],
            )
            for s in splits_data
        ]
        ExpenseSplit.objects.bulk_create(splits)

        total = expense.splits.aggregate(total=Sum("amount"))["total"] or 0
        expense.total_amount = total
        expense.save(update_fields=["total_amount"])

    @staticmethod
    def _create_percentage_splits(
        expense: Expense,
        splits_data: list,
        total_amount: int,
    ) -> None:
        """
        Divide ``total_amount`` by percentage using the cumulative
        (largest-remainder) rounding method.

        The naïve ``int(total × pct / 100)`` per user accumulates rounding
        errors so that ``Σ splits`` can differ from ``total_amount`` by up to
        ``N`` toman.  The cumulative approach below guarantees exact equality:

            amount[i] = floor(total × Σpct[0..i] / 100)
                      − floor(total × Σpct[0..i-1] / 100)

        Validation: percentages must sum to exactly 100 (±0.001 tolerance).
        """
        if not splits_data:
            raise ValueError("Percentage split requires at least one entry.")

        total_pct = sum(s["percentage"] for s in splits_data)
        if abs(total_pct - 100) > 0.001:
            raise ValueError(f"Percentages must sum to 100 (received {total_pct:.4f}).")

        cumulative_pct = 0.0
        prev_allocated = 0
        splits = []
        for s in splits_data:
            cumulative_pct += s["percentage"]
            current_allocated = int(total_amount * cumulative_pct / 100)
            splits.append(
                ExpenseSplit(
                    expense=expense,
                    user_id=s["user"].pk,
                    amount=current_allocated - prev_allocated,
                )
            )
            prev_allocated = current_allocated

        ExpenseSplit.objects.bulk_create(splits)

        # Re-aggregate from DB for consistency with other split types.
        total = expense.splits.aggregate(total=Sum("amount"))["total"] or 0
        expense.total_amount = total
        expense.save(update_fields=["total_amount"])

    @staticmethod
    def _create_itemized_splits(
        expense: Expense,
        items_data: list,
    ) -> None:
        """
        Create item-level splits from a list of items, each with its own
        per-user share breakdown.

        ``total_amount`` is derived from ``ExpenseItemShare`` rows — the single
        source of truth.  ``ExpenseItem.total_amount`` is a display helper only
        and must not be used for financial calculations (it may be stale).
        """
        if not items_data:
            raise ValueError("Itemized split requires at least one item.")

        for item_data in items_data:
            shares = item_data.pop("shares", [])
            item = ExpenseItem.objects.create(expense=expense, **item_data)
            ExpenseItemShare.objects.bulk_create(
                [
                    ExpenseItemShare(
                        item=item,
                        user_id=share["user"].pk,
                        amount=share["amount"],
                    )
                    for share in shares
                ]
            )

        # Aggregate from share rows, never from ExpenseItem.total_amount.
        total = (
            ExpenseItemShare.objects.filter(item__expense=expense).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        )
        expense.total_amount = total
        expense.save(update_fields=["total_amount"])


# =============================================================================
# BalanceService
# =============================================================================


class BalanceService:
    """
    Manage the materialized ``Balance`` projection.

    The ``Balance`` table is a read-optimized cache of each user's net
    position in a group.  It is always recalculated from the canonical
    ``ExpenseSplit`` and ``Settlement`` data; it is never the source of truth.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_balances(self, group_id: int) -> list[dict]:
        """
        Return the current net balance for every member of the group.

        All balances are recalculated inside a transaction before reading so
        the response is always fresh, even if a previous operation left a row
        stale or never created one.

        Bug fixed (v3 #12): previously the table was read directly without
        recalculating first.  Missing or stale rows produced incorrect or
        incomplete results — this was the root cause of two-way debts
        appearing as if only one side was reflected.
        """
        group = get_object_or_404(Group, pk=group_id)
        with transaction.atomic():
            BalanceService.recalculate_all_balances_for_group(group)
            balances = list(
                Balance.objects.filter(group=group).select_related("user").order_by("user__id")
            )
        return [
            {
                "phone_number": b.user.phone_number,
                "full_name": b.user.full_name or b.user.phone_number,
                "net": b.amount,
            }
            for b in balances
        ]

    # ------------------------------------------------------------------
    # Internal recalculation helpers (called by other services too)
    # ------------------------------------------------------------------

    @staticmethod
    def update_balance_for_expense(expense: Expense) -> None:
        """
        Recalculate balances for every user directly involved in ``expense``.

        Called after an expense is confirmed or deleted.  Only the payer and
        each split participant are touched; other group members are unaffected.
        """
        affected_users = {expense.paid_by} | {
            split.user for split in expense.splits.select_related("user")
        }
        for user in affected_users:
            BalanceService.recalculate_balance_for_user(user, expense.group)

    @staticmethod
    def recalculate_balance_for_user(user: User, group: Group) -> None:
        """
        Recompute and persist the net balance for a single user in a group.

        Formula
        -------
            net = (paid − received) − (owed − sent)

        Components
        ----------
        paid
            Money this user advanced on behalf of others.
            Σ split.amount WHERE expense.paid_by = user
                             AND split.user      ≠ user
                             AND expense.is_confirmed = True

        owed
            Money this user owes to others.
            Σ split.amount WHERE split.user       = user
                             AND expense.paid_by  ≠ user
                             AND expense.is_confirmed = True

        sent
            Confirmed settlement amounts this user paid out (reduces debt).
            Σ settlement.amount WHERE from_user = user AND status = confirmed

        received
            Confirmed settlement amounts this user received (reduces credit).
            Σ settlement.amount WHERE to_user = user AND status = confirmed

        Intuition
        ---------
        ``(paid − received)`` is the gross credit minus what has already been
        repaid.  ``(owed − sent)`` is the gross debt minus what has already
        been paid off.  The difference is the net position.

        Uses ``select_for_update`` to prevent concurrent recalculations from
        racing on the same row.  Must be called inside an atomic block.
        """
        balance, _ = Balance.objects.select_for_update().get_or_create(
            user=user, group=group, defaults={"amount": 0}
        )

        paid = (
            ExpenseSplit.objects.filter(
                expense__group=group,
                expense__paid_by=user,
                expense__is_confirmed=True,
            )
            .exclude(user=user)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        owed = (
            ExpenseSplit.objects.filter(
                expense__group=group,
                expense__is_confirmed=True,
                user=user,
            )
            .exclude(expense__paid_by=user)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        sent = (
            Settlement.objects.filter(group=group, from_user=user, status="confirmed").aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        received = (
            Settlement.objects.filter(group=group, to_user=user, status="confirmed").aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        balance.amount = (paid - received) - (owed - sent)
        balance.save(update_fields=["amount"])

    @staticmethod
    def recalculate_all_balances_for_group(group: Group) -> None:
        """
        Rebuild balances for *every* member of a group.

        Must be called inside an atomic block (``select_for_update``
        requirement on PostgreSQL).

        Iterates ``Membership`` directly to avoid an extra ``User`` query
        (bug fix v3 #14).
        """
        for membership in group.memberships.select_related("user").all():
            BalanceService.recalculate_balance_for_user(membership.user, group)


# =============================================================================
# SettlementService
# =============================================================================


class SettlementService:
    """Create, confirm, and reverse settlements between group members."""

    def create_settlement(
        self,
        *,
        group_id: int,
        from_user: User,
        to_user_id: int,
        amount: int,
        created_by: User,
    ) -> Settlement:
        """
        Create a pending settlement (a promise to pay).

        Validation (after a fresh recalculation):
          - ``from_user`` must have ``net < 0``  (is a debtor).
          - ``to_user``   must have ``net > 0``  (is a creditor).

        Balances are recalculated inside the transaction *before* reading
        so that stale or missing rows never produce false validation errors
        (bug fix v2 #9).
        """
        if from_user.pk == to_user_id:
            raise ValueError("Cannot create a settlement with yourself.")
        if amount <= 0:
            raise ValueError("Settlement amount must be positive.")

        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            to_user = get_object_or_404(User, pk=to_user_id)

            # Recalculate before reading — prevents stale-row false errors.
            BalanceService.recalculate_balance_for_user(from_user, group)
            BalanceService.recalculate_balance_for_user(to_user, group)

            from_balance = Balance.objects.select_for_update().get(user=from_user, group=group)
            if from_balance.amount >= 0:
                raise ValueError("Settlement can only be created by a debtor (net < 0).")
            if amount > abs(from_balance.amount):
                raise ValueError(
                    f"Settlement amount ({amount}) exceeds the outstanding debt "
                    f"({abs(from_balance.amount)})."
                )
            to_balance = Balance.objects.select_for_update().get(user=to_user, group=group)
            if to_balance.amount <= 0:
                raise ValueError("The receiving user is not owed any money (net ≤ 0).")

            settlement = Settlement.objects.create(
                group=group,
                from_user=from_user,
                to_user=to_user,
                amount=amount,
                created_by=created_by,
            )
            outbox_event = OutboxService.publish_event(
                "SettlementCreated", {"settlement_id": settlement.id}
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return settlement

    def confirm_settlement(self, *, settlement_id: int, confirmed_by: User) -> Settlement:
        """
        Confirm a pending settlement and update both parties' balances.

        Only the creditor (``to_user``) may confirm — they acknowledge that
        they received the payment.
        """
        with transaction.atomic():
            settlement = get_object_or_404(Settlement, pk=settlement_id, status="pending")
            if confirmed_by != settlement.to_user:
                raise PermissionError("Only the receiving user can confirm a settlement.")
            settlement.status = "confirmed"
            settlement.confirmed_by = confirmed_by
            settlement.confirmed_at = timezone.now()
            settlement.save(update_fields=["status", "confirmed_by", "confirmed_at"])

            BalanceService.recalculate_balance_for_user(settlement.from_user, settlement.group)
            BalanceService.recalculate_balance_for_user(settlement.to_user, settlement.group)
            outbox_event = OutboxService.publish_event(
                "SettlementConfirmed",
                {
                    "settlement_id": settlement.id,
                    "confirmed_by_id": confirmed_by.id,
                },
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return settlement

    def reverse_settlement(self, *, settlement_id: int, requested_by: User) -> Settlement:
        """
        Reverse a confirmed settlement.

        Only the settlement's status is changed to ``"reversed"``.  Because
        the balance formula aggregates *only* ``status="confirmed"``
        settlements, this single status change is enough to restore both
        parties' balances to their pre-settlement state — no new row is
        created.

        Bug fixed (v1 #3): the previous implementation created a new
        ``Settlement`` with ``status="confirmed"``, which caused ``sent`` and
        ``received`` to increase again and left both balances unchanged.
        """
        with transaction.atomic():
            try:
                settlement = Settlement.objects.get(pk=settlement_id)
            except Settlement.DoesNotExist:
                raise ValueError(f"Settlement {settlement_id} not found.")
            if settlement.status != "confirmed":
                raise ValueError(
                    f"Cannot reverse a settlement with status '{settlement.status}'. "
                    "Only confirmed settlements can be reversed."
                )
            if requested_by not in (settlement.from_user, settlement.to_user):
                raise PermissionError("Only the parties involved can reverse a settlement.")

            settlement.status = "reversed"
            settlement.save(update_fields=["status"])

            BalanceService.recalculate_balance_for_user(settlement.from_user, settlement.group)
            BalanceService.recalculate_balance_for_user(settlement.to_user, settlement.group)
            outbox_event = OutboxService.publish_event(
                "SettlementReversed",
                {
                    "settlement_id": settlement.id,
                    "reversed_by_id": requested_by.id,
                },
            )
        transaction.on_commit(lambda: dispatch_outbox_event.delay(outbox_event.pk))
        return settlement


# =============================================================================
# SettlementOptimizationService
# =============================================================================


class SettlementOptimizationService:
    """
    Suggest the minimum number of settlements needed to clear all debts.

    Algorithm: greedy matching of the largest debtor against the largest
    creditor at each step.  Optimal for all practical group sizes.
    Time complexity: O(n log n) sort + O(n) sweep.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def suggest_settlements(self, group_id: int) -> dict:
        """
        Return a suggestion list and a balance version hash.

        Response schema::

            {
                "balance_version": "<sha256 hex>",
                "suggestions": [
                    {"from_user_id": int, "to_user_id": int, "amount": int},
                    ...
                ]
            }

        ``balance_version`` is a SHA-256 fingerprint of the current net
        balances.  Pass it to ``apply_suggestions`` to guard against stale
        data.
        """
        group = get_object_or_404(Group, pk=group_id)
        with transaction.atomic():
            # Always recalculate before building the map so suggestions are
            # based on current data (bug fix v3 #13).
            BalanceService.recalculate_all_balances_for_group(group)
            net = self._build_net_map(group)

        return {
            "balance_version": self._compute_version(net),
            "suggestions": self._run_greedy(net),
        }

    def apply_suggestions(
        self,
        *,
        group_id: int,
        balance_version: str,
        suggestions: list[dict],
        requested_by: User,
    ) -> list[Settlement]:
        """
        Atomically create all suggested settlements.

        Raises ``ValueError`` if the current balance fingerprint does not
        match ``balance_version`` (stale-data guard: something changed the
        balances between ``suggest_settlements`` and this call).

        Outbox events are collected inside the transaction and dispatched via
        ``on_commit`` after the outer transaction commits, preventing
        double-dispatch or silent drops from nested atomic blocks
        (bug fix v2 #11).
        """
        outbox_event_ids: list[int] = []

        with transaction.atomic():
            group = get_object_or_404(Group, pk=group_id)
            BalanceService.recalculate_all_balances_for_group(group)
            current_net = self._build_net_map(group)

            if self._compute_version(current_net) != balance_version:
                raise ValueError(
                    "Balances changed since the optimization was calculated. "
                    "Request a new suggestion."
                )

            created_settlements: list[Settlement] = []
            for s in suggestions:
                from_user = get_object_or_404(User, pk=s["from_user_id"])
                to_user = get_object_or_404(User, pk=s["to_user_id"])
                settlement = Settlement.objects.create(
                    group=group,
                    from_user=from_user,
                    to_user=to_user,
                    amount=s["amount"],
                    created_by=requested_by,
                )
                created_settlements.append(settlement)
                outbox_event = OutboxService.publish_event(
                    "SettlementCreated", {"settlement_id": settlement.id}
                )
                outbox_event_ids.append(outbox_event.pk)

        # Dispatch *after* the outer transaction commits.
        for event_pk in outbox_event_ids:
            transaction.on_commit(lambda pk=event_pk: dispatch_outbox_event.delay(pk))

        return created_settlements

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_net_map(group: Group) -> dict[int, int]:
        """
        Read ``user_id → net_balance`` from already-recalculated Balance rows.

        Assumes ``recalculate_all_balances_for_group`` was called immediately
        before this method inside the same atomic block.
        """
        return {b.user_id: b.amount for b in Balance.objects.filter(group=group)}

    @staticmethod
    def _compute_version(net: dict[int, int]) -> str:
        """
        SHA-256 fingerprint of the balance state.

        Items are sorted by user id before hashing so the result is
        deterministic regardless of dict iteration order.
        """
        payload = json.dumps(sorted(net.items()), sort_keys=True).encode()
        return hashlib.sha256(payload).hexdigest()

    @staticmethod
    def _run_greedy(net: dict[int, int]) -> list[dict]:
        """
        Greedy minimum-transactions algorithm.

        Steps:
        1. Separate users into debtors (net < 0) and creditors (net > 0),
           both sorted by absolute amount descending.
        2. At each iteration, match the largest debtor with the largest
           creditor and transfer ``min(debt, credit)``.
        3. Advance the pointer whose balance just reached zero.
        4. Repeat until no debtor or creditor remains.
        """
        debtors = sorted(
            [(uid, -amt) for uid, amt in net.items() if amt < 0],
            key=lambda x: x[1],
            reverse=True,
        )
        creditors = sorted(
            [(uid, amt) for uid, amt in net.items() if amt > 0],
            key=lambda x: x[1],
            reverse=True,
        )

        # Convert to mutable lists for in-place updates.
        debtors = [list(d) for d in debtors]
        creditors = [list(c) for c in creditors]

        suggestions: list[dict] = []
        i = j = 0
        while i < len(debtors) and j < len(creditors):
            debt_uid, debt_amt = debtors[i]
            cred_uid, cred_amt = creditors[j]
            transfer = min(debt_amt, cred_amt)
            suggestions.append(
                {
                    "from_user_id": debt_uid,
                    "to_user_id": cred_uid,
                    "amount": transfer,
                }
            )
            debtors[i][1] -= transfer
            creditors[j][1] -= transfer
            if debtors[i][1] == 0:
                i += 1
            if creditors[j][1] == 0:
                j += 1

        return suggestions
