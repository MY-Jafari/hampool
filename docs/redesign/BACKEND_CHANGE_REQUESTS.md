# Backend Change Requests

> Non-blocking backend enhancements requested by frontend redesign. Frontend must work cleanly without waiting for these.
> Format: one line per request (`[ID] <Endpoint/Component>: <Description>`).

1. [CR-01] `apps/groups/urls.py`: Route `TransferOwnershipView` (`POST /api/v1/groups/<pk>/transfer-ownership/`) is implemented in `apps/groups/api/v1/views.py` but not registered in `urls.py`.
