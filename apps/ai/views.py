import logging
import re
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.conf import settings
from apps.groups.models import Group
from apps.ai.providers import GeminiProvider
from apps.ai.prompts import GROUP_NAME_PROMPT

logger = logging.getLogger(__name__)


def clean_name(raw: str) -> str:
    """Clean markdown, numbering, bullets, quotes and extra spaces from suggested name."""
    # Remove leading numbering like "1. ", "1- ", "۱. ", "۱- ", "- ", "* "
    cleaned = re.sub(r"^[\s\d\u06F0-\u06F9]+[\.\-\)\s]+", "", raw)
    # Remove bullet markers
    cleaned = re.sub(r"^[\-\*\•\–]\s*", "", cleaned)
    # Remove surrounding quotes or markdown asterisks
    cleaned = cleaned.strip(" *\"'«»`")
    return cleaned.strip()


class SuggestGroupNameView(generics.GenericAPIView):
    """Return AI-generated name suggestions in Persian and English."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            group = Group.objects.get(pk=self.kwargs["pk"])

            # Collect rich contextual signals from the group
            expense_qs = group.expenses.order_by("-date")[:10]
            expense_items = []
            for exp in expense_qs:
                if exp.description:
                    expense_items.append(exp.description)

            # Build enriched context string that preserves raw descriptions for prompt inspection
            context_segments = []
            if group.name and group.name.strip():
                context_segments.append(f"نام گروه: {group.name.strip()}")
            if group.description and group.description.strip():
                context_segments.append(f"توضیحات: {group.description.strip()}")
            if expense_items:
                context_segments.append(f"هزینه‌ها: {', '.join(expense_items)}")
            else:
                context_segments.append("گروه مشترک دوستان و همکاران")

            context_str = " | ".join(context_segments)
            prompt = GROUP_NAME_PROMPT.format(items=context_str)

            provider = GeminiProvider(api_key=settings.GEMINI_API_KEY)
            result = provider.generate(prompt)

            persian_names = []
            english_names = []
            current_section = None

            for line in result.splitlines():
                line = line.strip()
                if not line:
                    continue

                lower_line = line.lower()
                if "persian:" in lower_line or "فارسی:" in lower_line:
                    current_section = "persian"
                    continue
                elif "english:" in lower_line or "انگلیسی:" in lower_line:
                    current_section = "english"
                    continue

                if current_section:
                    cleaned = clean_name(line)
                    if cleaned:
                        if current_section == "persian" and len(persian_names) < 3:
                            persian_names.append(cleaned)
                        elif current_section == "english" and len(english_names) < 3:
                            english_names.append(cleaned)

            # Fallback defaults if fewer than 3 names parsed from AI output
            fallback_persian = ["دونگ‌پارتی دوستان", "خرج‌و‌مخارج مشترک", "صندوق هم‌پول"]
            fallback_english = ["Split Squad", "Pool Pals", "HamPool Circle"]

            while len(persian_names) < 3:
                cand = fallback_persian[len(persian_names)]
                if cand not in persian_names:
                    persian_names.append(cand)
            while len(english_names) < 3:
                cand = fallback_english[len(english_names)]
                if cand not in english_names:
                    english_names.append(cand)

            return Response(
                {
                    "persian": persian_names[:3],
                    "english": english_names[:3],
                }
            )
        except Exception as e:
            logger.error(f"AI suggestion failed: {e}")
            return Response(
                {"error": "Could not generate name suggestions at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
