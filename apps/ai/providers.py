import time
import google.generativeai as genai
from google.api_core import exceptions
from django.conf import settings


class GeminiProvider:
    """
    Google Gemini AI provider.

    Uses the model defined in ``settings.GEMINI_AI_MODEL`` to allow
    switching between different Gemini versions without code changes.
    """

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = settings.GEMINI_AI_MODEL
        self.max_retries = 2
        self.retry_delay = 15  # seconds

    def generate(self, prompt: str) -> str:
        model = genai.GenerativeModel(self.model)
        for attempt in range(self.max_retries + 1):
            try:
                response = model.generate_content(prompt)
                return response.text.strip()
            except exceptions.ResourceExhausted:
                if attempt < self.max_retries:
                    time.sleep(self.retry_delay)
                else:
                    raise Exception(
                        "AI service is temporarily unavailable due to high demand. "
                        "Please try again in a few seconds."
                    )
