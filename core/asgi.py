"""
ASGI configuration for the HamPool project.

Uses the ``ProtocolTypeRouter`` to dispatch HTTP requests to the
standard Django ASGI application and WebSocket connections to the
Channels URL router defined in ``apps.groups.routing``.

This is the entry point for both the Uvicorn and Daphne ASGI servers.
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from apps.groups.routing import websocket_urlpatterns

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django_application = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_application,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
