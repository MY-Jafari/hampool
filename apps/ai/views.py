import logging
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.conf import settings
from apps.groups.models import Group
from apps.ai.providers import GeminiProvider
from apps.ai.prompts import GROUP_NAME_PROMPT

logger = logging.getLogger(__name__)


class SuggestGroupNameView(generics.GenericAPIView):
    """Return AI‑generated name suggestions in Persian and English."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            group = Group.objects.get(pk=self.kwargs["pk"])
            items = group.expenses.values_list("description", flat=True)[:10]
            prompt = GROUP_NAME_PROMPT.format(items=", ".join(items))

            provider = GeminiProvider(api_key=settings.GEMINI_API_KEY)
            result = provider.generate(prompt)

            persian_names = []
            english_names = []
            current_section = None

            for line in result.splitlines():
                line = line.strip()
                if line.startswith("Persian:"):
                    current_section = "persian"
                elif line.startswith("English:"):
                    current_section = "english"
                elif line and current_section:
                    name = line.split(". ", 1)[-1] if ". " in line else line
                    if current_section == "persian":
                        persian_names.append(name)
                    elif current_section == "english":
                        english_names.append(name)

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
