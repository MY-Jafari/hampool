"""Clear the rate-limit cache before each test so rate-limited endpoints
(report, registration) don't get blocked in the test suite."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_ratelimit_cache():
    cache.clear()
