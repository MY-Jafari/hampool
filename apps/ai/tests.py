"""
Tests for the AI app — suggest-name endpoint and GeminiProvider.

Covers:
- SuggestGroupNameView: authenticated, unauthenticated, group not found, AI failure
- GeminiProvider: generate success, retry on ResourceExhausted, final failure
- Prompt formatting
"""

import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.groups.models import Group, Membership, Expense

User = get_user_model()

BASE = "/api/v1/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user1(db):
    return User.objects.create_user(phone_number="09111111111", password="Test@123", is_active=True)


@pytest.fixture
def auth(api, user1):
    token = str(RefreshToken.for_user(user1).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def group(user1):
    g = Group.objects.create(name="تست", created_by=user1, owner=user1)
    Membership.objects.create(user=user1, group=g, role="admin")
    return g


# ══════════════════════════════════════════════════════════════
# SUGGEST GROUP NAME VIEW
# ══════════════════════════════════════════════════════════════


class TestSuggestGroupName:
    def test_suggest_name_authenticated(self, auth, group):
        """Authenticated user gets name suggestions."""
        mock_response = MagicMock()
        mock_response.text = (
            "Persian:\n1. گروه سفر\n2. گروه دوستان\n3. گروه خانواده\n\n"
            "English:\n1. Travel Group\n2. Friends Group\n3. Family Group"
        )
        with patch("apps.ai.views.GeminiProvider") as MockProvider:
            MockProvider.return_value.generate.return_value = mock_response.text
            res = auth.post(f"{BASE}groups/{group.id}/suggest-name/", format="json")
            assert res.status_code == 200
            assert "persian" in res.data
            assert "english" in res.data
            assert len(res.data["persian"]) == 3
            assert len(res.data["english"]) == 3
            assert "گروه سفر" in res.data["persian"]
            assert "Travel Group" in res.data["english"]

    def test_suggest_name_unauthenticated(self, api, group):
        res = api.post(f"{BASE}groups/{group.id}/suggest-name/", format="json")
        assert res.status_code == 401

    def test_suggest_name_group_not_found(self, auth, db):
        res = auth.post(f"{BASE}groups/99999/suggest-name/", format="json")
        # Group.DoesNotExist is caught → 503
        assert res.status_code == 503

    def test_suggest_name_ai_failure_returns_503(self, auth, group):
        """When AI provider raises an exception, endpoint returns 503."""
        with patch("apps.ai.views.GeminiProvider") as MockProvider:
            MockProvider.return_value.generate.side_effect = Exception("AI down")
            res = auth.post(f"{BASE}groups/{group.id}/suggest-name/", format="json")
            assert res.status_code == 503
            assert "error" in res.data

    def test_suggest_name_truncates_to_three(self, auth, group):
        """If AI returns more than 3 names, only first 3 are returned."""
        mock_response = MagicMock()
        mock_response.text = (
            "Persian:\n1. نام۱\n2. نام۲\n3. نام۳\n4. نام۴\n5. نام۵\n\n"
            "English:\n1. Name1\n2. Name2\n3. Name3\n4. Name4\n5. Name5"
        )
        with patch("apps.ai.views.GeminiProvider") as MockProvider:
            MockProvider.return_value.generate.return_value = mock_response.text
            res = auth.post(f"{BASE}groups/{group.id}/suggest-name/", format="json")
            assert res.status_code == 200
            assert len(res.data["persian"]) == 3
            assert len(res.data["english"]) == 3

    def test_suggest_name_uses_expense_descriptions(self, auth, group, user1):
        """The prompt should include group expense descriptions."""
        Expense.objects.create(
            group=group,
            paid_by=user1,
            description="تاکسی فرودگاه",
            total_amount=120000,
            split_type="equal",
            is_confirmed=True,
        )
        with patch("apps.ai.views.GeminiProvider") as MockProvider:
            MockProvider.return_value.generate.return_value = (
                "Persian:\n1. x\n2. y\n3. z\n\nEnglish:\n1. a\n2. b\n3. c"
            )
            res = auth.post(f"{BASE}groups/{group.id}/suggest-name/", format="json")
            assert res.status_code == 200
            # The generate method was called with a prompt containing the description
            call_args = MockProvider.return_value.generate.call_args[0][0]
            assert "تاکسی فرودگاه" in call_args


# ══════════════════════════════════════════════════════════════
# GEMINI PROVIDER
# ══════════════════════════════════════════════════════════════


class TestGeminiProvider:
    def test_generate_success(self, settings):
        settings.GEMINI_AI_MODEL = "gemini-2.0-flash"
        from apps.ai.providers import GeminiProvider

        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "  hello world  "
        mock_model.generate_content.return_value = mock_response

        with patch("apps.ai.providers.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model
            provider = GeminiProvider(api_key="fake-key")
            result = provider.generate("test prompt")
            assert result == "hello world"  # stripped

    def test_generate_retries_on_resource_exhausted(self, settings):
        settings.GEMINI_AI_MODEL = "gemini-2.0-flash"
        from apps.ai.providers import GeminiProvider
        from google.api_core import exceptions as g_exceptions

        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "success"

        call_count = 0

        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise g_exceptions.ResourceExhausted("quota")
            return mock_response

        mock_model.generate_content.side_effect = side_effect

        with (
            patch("apps.ai.providers.genai") as mock_genai,
            patch("apps.ai.providers.time.sleep"),
        ):  # skip actual sleep
            mock_genai.GenerativeModel.return_value = mock_model
            provider = GeminiProvider(api_key="fake-key")
            provider.retry_delay = 0  # no actual delay in tests
            result = provider.generate("prompt")
            assert result == "success"
            assert call_count == 2  # retried once

    def test_generate_fails_after_max_retries(self, settings):
        settings.GEMINI_AI_MODEL = "gemini-2.0-flash"
        from apps.ai.providers import GeminiProvider
        from google.api_core import exceptions as g_exceptions

        mock_model = MagicMock()
        mock_model.generate_content.side_effect = g_exceptions.ResourceExhausted("quota")

        with patch("apps.ai.providers.genai") as mock_genai, patch("apps.ai.providers.time.sleep"):
            mock_genai.GenerativeModel.return_value = mock_model
            provider = GeminiProvider(api_key="fake-key")
            provider.retry_delay = 0
            with pytest.raises(Exception, match="temporarily unavailable"):
                provider.generate("prompt")


# ══════════════════════════════════════════════════════════════
# PROMPTS
# ══════════════════════════════════════════════════════════════


class TestPrompt:
    def test_prompt_contains_items_placeholder(self):
        from apps.ai.prompts import GROUP_NAME_PROMPT

        assert "{items}" in GROUP_NAME_PROMPT

    def test_prompt_has_persian_and_english_sections(self):
        from apps.ai.prompts import GROUP_NAME_PROMPT

        assert "Persian:" in GROUP_NAME_PROMPT
        assert "English:" in GROUP_NAME_PROMPT
