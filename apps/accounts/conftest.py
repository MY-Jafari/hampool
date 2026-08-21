"""Clear the rate-limit cache before each test so registration/login
endpoints don't get blocked by django-ratelimit in the test suite."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
