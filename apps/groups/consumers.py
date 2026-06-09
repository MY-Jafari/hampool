"""
WebSocket consumer for real‑time group notifications.

Architecture decisions (per design review):
- JWT is passed in the query string (``?token=...``) for MVP simplicity.
- The consumer verifies that the user is a member of the group before
  accepting the connection.
- Messages are *best‑effort*; the client must re‑fetch state after a
  reconnect.
- Only **server → client** communication is implemented (no chat).
- The consumer forwards the raw event data from the Outbox handlers
  directly to the client.  The frontend is responsible for building
  the human‑readable notification in the user's language.
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger("groups.consumer")


class GroupConsumer(AsyncWebsocketConsumer):
    """Handles WebSocket connections for a specific group."""

    async def connect(self) -> None:
        """Authenticate user via JWT and join group room."""
        try:
            self.group_id = self.scope["url_route"]["kwargs"]["group_id"]
            self.room_group_name = f"group_{self.group_id}"

            # Extract JWT from query string (e.g., ?token=eyJ...)
            query_string = self.scope.get("query_string", b"").decode()
            token = query_string.replace("token=", "") if "token=" in query_string else ""

            if not token:
                await self.close(code=4001)  # 4001: Unauthorized
                return

            user = await self.get_user_from_token(token)
            if not user:
                await self.close(code=4001)
                return

            is_member = await self.is_group_member(user, self.group_id)
            if not is_member:
                await self.close(code=4003)  # 4003: Forbidden
                return

            # Store the authenticated user in the scope for later use
            self.scope["user"] = user
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connected: user={user.phone_number}, group={self.group_id}")

        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            await self.close(code=4000)

    async def disconnect(self, close_code: int) -> None:
        """Leave group room."""
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def group_state_changed(self, event: dict) -> None:
        """
        Forward the raw event to the WebSocket client.

        The payload contains ``event_type`` and ``params`` so that the
        frontend can decide how to present the notification (including
        the user's preferred language).
        """
        await self.send(
            text_data=json.dumps(
                {
                    "type": "group_state_changed",
                    "group_id": event.get("group_id"),
                    "event_type": event.get("event_type", ""),
                    "params": event.get("params", {}),
                    "ts": event.get("ts"),
                }
            )
        )

    # ── database helpers (sync → async) ────────────────────────────

    @database_sync_to_async
    def get_user_from_token(self, token: str):
        """Validate JWT and return User or None."""
        # Import JWT tools only when needed to avoid early Django model import
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            access_token = AccessToken(token)
            user_id = access_token["user_id"]
            return User.objects.get(pk=user_id)
        except (TokenError, User.DoesNotExist) as e:
            logger.warning(f"Invalid token: {e}")
            return None

    @database_sync_to_async
    def is_group_member(self, user, group_id: int) -> bool:
        """Check membership."""
        from apps.groups.models import Membership

        return Membership.objects.filter(user=user, group_id=group_id).exists()
