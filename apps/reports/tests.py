"""
Tests for the reports app — Celery tasks for generating PDF reports.

Covers:
- generate_group_report: data gathering, chart generation, PDF rendering
- dispatch_weekly_report_jobs: filtering active groups
- Edge cases: group not found, no expenses, no budget
"""

import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model

from apps.groups.models import Group, Membership, Balance, Expense, Settlement

User = get_user_model()


@pytest.fixture
def user1(db):
    return User.objects.create_user(
        phone_number="09111111111",
        password="Test@123",
        is_active=True,
        full_name="علی",
        email="ali@test.com",
    )


@pytest.fixture
def user2(db):
    return User.objects.create_user(
        phone_number="09222222222",
        password="Test@123",
        is_active=True,
        full_name="سارا",
        email="sara@test.com",
    )


@pytest.fixture
def group(user1):
    g = Group.objects.create(name="گروه تست", created_by=user1, owner=user1, budget_limit=500000)
    Membership.objects.create(user=user1, group=g, role="admin")
    Balance.objects.create(user=user1, group=g, amount=0)
    return g


@pytest.fixture
def group_with_expenses(group, user1, user2):
    Membership.objects.create(user=user2, group=group, role="member")
    Balance.objects.create(user=user2, group=group, amount=0)
    # Create some expenses this week
    Expense.objects.create(
        group=group,
        paid_by=user1,
        description="شام",
        total_amount=200000,
        split_type="equal",
        is_confirmed=True,
    )
    Expense.objects.create(
        group=group,
        paid_by=user2,
        description="ناهار",
        total_amount=100000,
        split_type="equal",
        is_confirmed=True,
    )
    return group


# ══════════════════════════════════════════════════════════════
# GENERATE GROUP REPORT
# ══════════════════════════════════════════════════════════════


class TestGenerateGroupReport:
    def test_report_generation(self, group_with_expenses, user1):
        """Full report generation with mocked PDF and charts."""
        from apps.reports.tasks import generate_group_report

        with (
            patch("apps.reports.tasks.render_to_string") as mock_render,
            patch("apps.reports.tasks.HTML") as MockHTML,
            patch("apps.reports.tasks.plt"),
            patch("apps.reports.tasks.OutboxService") as MockOutbox,
        ):

            mock_render.return_value = "<html>report</html>"
            mock_pdf = MagicMock()
            mock_pdf.read.return_value = b"fake-pdf-bytes"
            MockHTML.return_value.write_pdf.return_value = mock_pdf

            MockOutbox.publish_event.return_value = MagicMock(pk=1)

            # Run the task directly (not via Celery)
            generate_group_report(group_with_expenses.id)

            # render_to_string was called with report context
            mock_render.assert_called_once()
            context = mock_render.call_args[0][1]
            assert "group" in context
            assert "total_spent" in context
            assert "budget" in context
            assert context["total_spent"] == 300000  # 200K + 100K
            assert context["budget"] == 500000
            assert "remaining" in context

    def test_report_group_not_found(self, db):
        from apps.reports.tasks import generate_group_report

        # Should not raise — just logs and returns
        generate_group_report(99999)

    def test_report_no_expenses(self, group):
        from apps.reports.tasks import generate_group_report

        with (
            patch("apps.reports.tasks.render_to_string") as mock_render,
            patch("apps.reports.tasks.HTML") as MockHTML,
            patch("apps.reports.tasks.plt"),
            patch("apps.reports.tasks.OutboxService") as MockOutbox,
        ):

            mock_render.return_value = "<html></html>"
            mock_pdf = MagicMock()
            mock_pdf.read.return_value = b"pdf"
            MockHTML.return_value.write_pdf.return_value = mock_pdf
            MockOutbox.publish_event.return_value = MagicMock(pk=1)

            generate_group_report(group.id)

            context = mock_render.call_args[0][1]
            assert context["total_spent"] == 0
            assert context["remaining"] == 500000

    def test_report_no_budget(self, user1):
        """Group without budget limit should have remaining=None and percent_used=0."""
        from apps.reports.tasks import generate_group_report

        g = Group.objects.create(name="بدون بودجه", created_by=user1, owner=user1, budget_limit=0)
        Membership.objects.create(user=user1, group=g, role="admin")

        with (
            patch("apps.reports.tasks.render_to_string") as mock_render,
            patch("apps.reports.tasks.HTML") as MockHTML,
            patch("apps.reports.tasks.plt"),
            patch("apps.reports.tasks.OutboxService") as MockOutbox,
        ):

            mock_render.return_value = "<html></html>"
            mock_pdf = MagicMock()
            mock_pdf.read.return_value = b"pdf"
            MockHTML.return_value.write_pdf.return_value = mock_pdf
            MockOutbox.publish_event.return_value = MagicMock(pk=1)

            generate_group_report(g.id)

            context = mock_render.call_args[0][1]
            assert context["budget"] == 0
            assert context["remaining"] is None
            assert context["percent_used"] == 0

    def test_report_emits_outbox_event_per_member(self, group_with_expenses, user1, user2):
        """Each member with email gets a ReportReady outbox event."""
        from apps.reports.tasks import generate_group_report

        with (
            patch("apps.reports.tasks.render_to_string", return_value="<html></html>"),
            patch("apps.reports.tasks.HTML") as MockHTML,
            patch("apps.reports.tasks.plt"),
            patch("apps.reports.tasks.OutboxService") as MockOutbox,
        ):

            mock_pdf = MagicMock()
            mock_pdf.read.return_value = b"pdf"
            MockHTML.return_value.write_pdf.return_value = mock_pdf
            MockOutbox.publish_event.return_value = MagicMock(pk=1)

            generate_group_report(group_with_expenses.id)

            # 2 members with emails → 2 outbox events
            assert MockOutbox.publish_event.call_count == 2
            calls = MockOutbox.publish_event.call_args_list
            event_types = [c[0][0] for c in calls]
            assert all(t == "ReportReady" for t in event_types)

    def test_report_members_without_email_skipped(self, user1):
        """Members without email should not get outbox events."""
        from apps.reports.tasks import generate_group_report

        g = Group.objects.create(name="تست", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        # user1 has email "ali@test.com" — let's create one without
        user_no_email = User.objects.create_user(
            phone_number="09333333333",
            password="Test@123",
            is_active=True,
            email="",
        )
        Membership.objects.create(user=user_no_email, group=g, role="member")

        with (
            patch("apps.reports.tasks.render_to_string", return_value="<html></html>"),
            patch("apps.reports.tasks.HTML") as MockHTML,
            patch("apps.reports.tasks.plt"),
            patch("apps.reports.tasks.OutboxService") as MockOutbox,
        ):

            mock_pdf = MagicMock()
            mock_pdf.read.return_value = b"pdf"
            MockHTML.return_value.write_pdf.return_value = mock_pdf
            MockOutbox.publish_event.return_value = MagicMock(pk=1)

            generate_group_report(g.id)

            # Only user1 (with email) should get an event
            assert MockOutbox.publish_event.call_count == 1


# ══════════════════════════════════════════════════════════════
# DISPATCH WEEKLY REPORT JOBS
# ══════════════════════════════════════════════════════════════


class TestDispatchWeeklyReportJobs:
    def test_dispatches_for_active_groups(self, group_with_expenses):
        from apps.reports.tasks import dispatch_weekly_report_jobs

        with patch("apps.reports.tasks.generate_group_report.delay") as mock_delay:
            dispatch_weekly_report_jobs()
            mock_delay.assert_called_once_with(group_with_expenses.id)

    def test_no_active_groups(self, db):
        from apps.reports.tasks import dispatch_weekly_report_jobs

        with patch("apps.reports.tasks.generate_group_report.delay") as mock_delay:
            dispatch_weekly_report_jobs()
            mock_delay.assert_not_called()

    def test_ignores_inactive_groups(self, user1, db):
        """Group with no recent activity should not get a report."""
        from apps.reports.tasks import dispatch_weekly_report_jobs

        g = Group.objects.create(name="غیرفعال", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")

        with patch("apps.reports.tasks.generate_group_report.delay") as mock_delay:
            dispatch_weekly_report_jobs()
            mock_delay.assert_not_called()

    def test_dispatches_for_settlement_activity(self, user1, user2, db):
        """Group with recent settlement (no expenses) should still be active."""
        from apps.reports.tasks import dispatch_weekly_report_jobs

        g = Group.objects.create(name="تسویه", created_by=user1, owner=user1)
        Membership.objects.create(user=user1, group=g, role="admin")
        Membership.objects.create(user=user2, group=g, role="member")
        Balance.objects.create(user=user1, group=g, amount=0)
        Balance.objects.create(user=user2, group=g, amount=0)
        Settlement.objects.create(
            group=g,
            from_user=user2,
            to_user=user1,
            amount=50000,
            status="confirmed",
            created_by=user2,
        )

        with patch("apps.reports.tasks.generate_group_report.delay") as mock_delay:
            dispatch_weekly_report_jobs()
            mock_delay.assert_called_once_with(g.id)
