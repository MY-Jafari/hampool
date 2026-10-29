# HamPool — Backend Contract Analysis (Single Source of Truth)

> Generated during Phase 0. Backend code analysis is locked into this document. No further backend code reads needed after Phase 0.

---

## 1. Endpoint Table

| Method | Path | Auth | Request Body / Query Params | Response Shape (2xx) | Error Formats | Permissions | Pagination |
|---|---|---|---|---|---|---|---|
| `GET` | `/health/` | Public | None | `{"status": "ok", "message": "HamPool is running!"}` | None | AllowAny | None |
| `POST` | `/api/v1/accounts/register/` | Public | JSON: `phone_number` (str, `09\d{9}`), `password` (str), `password_confirm` (str) | `201` → `{"detail": str, "temp_token": str}` | `400` → `{"phone_number": [str], "password": [str], "password_confirm": [str]}` · `403` → rate limit | Public (5 req/min/IP) | None |
| `POST` | `/api/v1/accounts/verify-otp/` | Bearer `<temp_token>` | JSON: `code` (str, 6 digits) | `200` → `{"detail": str, "access": str, "refresh": str}` | `400` → `{"code": [str]}`, `{"non_field_errors": [str]}` · `403` → rate limit or invalid purpose | `IsVerifyOTPToken` (purpose=`verify_otp`, allows inactive user; 5 req/min/IP) | None |
| `POST` | `/api/v1/accounts/login/` | Public | JSON: `phone_number` (str), `password` (str) | `200` → `{"access": str, "refresh": str}` | `401` → `{"detail": "No active account found with the given credentials"}` | Public (DRF AnonThrottle 10/min) | None |
| `POST` | `/api/v1/accounts/token/refresh/` | Public | JSON: `refresh` (str) | `200` → `{"access": str, "refresh": str}` (rotates refresh token) | `401` → `{"detail": "Token is invalid or expired", "code": "token_not_valid"}` | Public | None |
| `POST` | `/api/v1/accounts/token/verify/` | Public | JSON: `token` (str) | `200` → `{}` | `401` → `{"detail": "Token is invalid or expired", "code": "token_not_valid"}` | Public | None |
| `POST` | `/api/v1/accounts/logout/` | Bearer `<access>` | JSON: `refresh` (str, required) | `205` → `{"detail": "Successfully logged out."}` | `400` → `{"error": "Refresh token is required."}` or `{"error": "Invalid token."}` | `IsAuthenticated` | None |
| `GET` | `/api/v1/accounts/profile/` | Bearer `<access>` | None | `200` → `{"id": int, "phone_number": str, "email": str\|null, "full_name": str\|null, "language": "fa"\|"en", "avatar": str\|null, "date_joined": str}` | `401` → Unauthorized | `IsAuthenticated` | None |
| `PATCH` | `/api/v1/accounts/profile/` | Bearer `<access>` | Multipart/JSON: `email`? (str\|null), `full_name`? (str\|null), `language`? ("fa"\|"en"), `avatar`? (file\|null) | `200` → User object (same as GET) | `400` → `{"email": [str], ...}` | `IsAuthenticated` | None |
| `GET` | `/api/v1/groups/` | Bearer `<access>` | None | `200` → `[GroupSerializer]` (all groups where user is member) | `401` → Unauthorized | `IsAuthenticated` | None (flat array) |
| `POST` | `/api/v1/groups/` | Bearer `<access>` | JSON: `name` (str, 1-255), `description`? (str), `budget_limit`? (int ≥ 0, default 0) | `201` → `GroupSerializer` (creator set as owner + admin, invite code auto-generated) | `400` → `{"name": [str], ...}` | `IsAuthenticated` | None |
| `POST` | `/api/v1/groups/join/` | Bearer `<access>` | JSON: `invite_code` (str, max 8) | `201` → `{"detail": "Successfully joined the group."}` | `400` → `{"error": "Invalid or expired invite code."}` or `{"error": "User is already a member..."}` | `IsAuthenticated` | None |
| `GET` | `/api/v1/groups/{pk}/` | Bearer `<access>` | None | `200` → `GroupSerializer` | `403` → not member · `404` → not found | `IsGroupMember` | None |
| `PATCH` | `/api/v1/groups/{pk}/` | Bearer `<access>` | JSON: `name`? (str), `description`? (str), `budget_limit`? (int ≥ 0) | `200` → `GroupSerializer` | `400` → validation errors · `403` → not member | `IsGroupMember` | None |
| `DELETE` | `/api/v1/groups/{pk}/` | Bearer `<access>` | None | `204` → No Content | `403` → not member/not owner · `404` → not found | `IsGroupMember` | None |
| `GET` | `/api/v1/groups/{pk}/members/` | Bearer `<access>` | None | `200` → `[{"id": int, "user": int, "user_phone": str, "user_name": str, "role": "admin"\|"member", "joined_at": str}]` | `403` → not member · `404` → not found | `IsGroupMember` | None (flat array) |
| `POST` | `/api/v1/groups/{pk}/members/add/` | Bearer `<access>` | JSON: `phone_number` (str, 11 digits) | `201` → `MembershipResponseSerializer` (`id, user, user_phone, user_name, role, joined_at`) | `400` → `{"phone_number": [str]}` or `{"error": str}` · `403` → not admin | `IsGroupAdmin` | None |
| `DELETE` | `/api/v1/groups/{pk}/members/{user_id}/remove/` | Bearer `<access>` | None | `204` → No Content (or `200` → `{"detail": "..."}` if group deleted) | `400` → `{"error": "Cannot remove member with unsettled balance..."}` · `403` → `{"error": "You do not have permission..."}` | Self-removal or `IsGroupAdmin` | None |
| `PATCH` | `/api/v1/groups/{pk}/members/{user_id}/role/` | Bearer `<access>` | JSON: `role` (str, `"admin"` \| `"member"`, required) | `200` → `MembershipSerializer` | `400` → `{"error": "The 'role' field is required."}` or `{"error": "Cannot demote the group owner."}` · `403` → `{"error": "Only admins can change roles."}` | `IsGroupAdmin` | None |
| `POST` | `/api/v1/groups/{pk}/invite/` | Bearer `<access>` | JSON: `{}` | `200` → `{"invite_code": str (8 chars), "expires_at": str (ISO)}` | `403` → not admin · `404` → not found | `IsGroupAdmin` | None |
| `GET` | `/api/v1/groups/{pk}/qr-code/` | Bearer `<access>` | None | `200` → binary image blob (`Content-Type: image/png`) | `403` → not member · `404` → not found | `IsGroupMember` | None (binary blob) |
| `GET` | `/api/v1/groups/{pk}/expenses/` | Bearer `<access>` | None | `200` → `[ExpenseDetailSerializer]` | `403` → not member · `404` → not found | `IsGroupMember` | None (flat array) |
| `POST` | `/api/v1/groups/{pk}/expenses/` | Bearer `<access>` | Multipart/JSON: `description`, `total_amount`, `split_type`, `splits` / `items`, `receipt_image`?, `receipt_expiry_date`? | `201` → `ExpenseDetailSerializer` | `400` → `{"splits": ...}` or `{"items": ...}` · `403` → not member | `IsGroupMember` (paid_by is request.user) | None |
| `GET` | `/api/v1/groups/{pk}/expenses/{eid}/` | Bearer `<access>` | None | `200` → `ExpenseDetailSerializer` | `403` → not owner/admin · `404` → not found | `IsOwnerOrAdmin` (paid_by or admin) | None |
| `PATCH` | `/api/v1/groups/{pk}/expenses/{eid}/` | Bearer `<access>` | JSON: `{"is_confirmed": true}` | `200` → `ExpenseDetailSerializer` | `403` → `{"detail": "A confirmed expense cannot be edited."}` · `404` → not found | `IsOwnerOrAdmin` (paid_by or admin) | None |
| `DELETE` | `/api/v1/groups/{pk}/expenses/{eid}/` | Bearer `<access>` | None | `204` → No Content | `403` → not owner/admin · `404` → not found | `IsOwnerOrAdmin` (paid_by or admin) | None |
| `GET` | `/api/v1/groups/{pk}/settlements/` | Bearer `<access>` | None | `200` → `[SettlementSerializer]` | `403` → not member · `404` → not found | `IsGroupMember` | None (flat array) |
| `POST` | `/api/v1/groups/{pk}/settlements/` | Bearer `<access>` | JSON: `to_user_id` (int), `amount` (int ≥ 1) | `201` → `SettlementSerializer` (status="pending", from_user=request.user) | `400` → `{"error": str}` (self-settle / not member / invalid amount) | `IsGroupMember` | None |
| `POST` | `/api/v1/groups/{pk}/settlements/{sid}/confirm/` | Bearer `<access>` | JSON: `{}` | `200` → `SettlementSerializer` (status="confirmed", confirmed_by=request.user) | `400` → `{"error": "Settlement is not pending."}` · `403` → `{"error": "Only the creditor (to_user) can confirm this settlement."}` | Creditor (`to_user`) only | None |
| `POST` | `/api/v1/groups/{pk}/settlements/{sid}/reverse/` | Bearer `<access>` | JSON: `{}` | `200` → `SettlementSerializer` (status="reversed", reversed_by=request.user) | `400` → `{"error": "Only confirmed settlements can be reversed."}` · `403` → `{"error": "Only parties to this settlement may reverse it."}` | Either party (`from_user` or `to_user`) | None |
| `GET` | `/api/v1/groups/{pk}/optimize-settlements/` | Bearer `<access>` | None | `200` → `{"balance_version": str (sha256), "suggestions": [{"from_user_id": int, "to_user_id": int, "amount": int}]}` | `403` → not member · `404` → not found | `IsGroupMember` | None |
| `POST` | `/api/v1/groups/{pk}/settlements/apply-optimization/` | Bearer `<access>` | JSON: `balance_version` (str), `suggestions` (`[{"from_user_id": int, "to_user_id": int, "amount": int}]`) | `201` → `[SettlementSerializer]` (created as pending) | `409` → `{"error": "Balances have changed since optimization was generated. Please refresh."}` | `IsGroupMember` | None |
| `GET` | `/api/v1/groups/{pk}/balances/` | Bearer `<access>` | None | `200` → `[{"phone_number": str, "full_name": str, "net": int}]` | `403` → not member · `404` → not found | `IsGroupMember` | None (flat array) |
| `GET` | `/api/v1/groups/{pk}/activities/` | Bearer `<access>` | None | `200` → `[{"id": int, "user": int, "user_phone": str, "action": str, "description": str, "timestamp": str}]` | `403` → not member · `404` → not found | `IsGroupMember` | None (flat array) |
| `POST` | `/api/v1/groups/{pk}/report/` | Bearer `<access>` | JSON: `{}` | `202` → `{"detail": "Report generation started. You will receive an email shortly."}` | `403` → rate limit (3/h/user) or not member · `404` → not found | `IsGroupMember` (3 req/hour/user) | None |
| `POST` | `/api/v1/groups/{pk}/suggest-name/` | Bearer `<access>` | JSON: `{}` | `200` → `{"persian": [str, str, str], "english": [str, str, str]}` | `403` → not authenticated · `404` → not found · `503` → `{"error": "Could not generate name suggestions at this time."}` | `IsAuthenticated` | None |

---

## 2. Business Rules & Validations

| Domain | Rule / Constraint | Behavior / Error Code |
|---|---|---|
| **Roles & Permissions** | `owner`: created the group; cannot be demoted; can delete group; cannot leave without transferring ownership.<br>`admin`: can add members, change member roles, regenerate invite codes.<br>`member`: can view group, post expenses, create settlements, self-leave (if balance = 0). | Unauthorized role changes return `403` with `{"error": "..."}`. Removing member with non-zero balance returns `400` with `{"error": "..."}`. |
| **Settlement Confirmation** | Only creditor (`to_user`) can confirm a pending settlement. | Payer or non-party attempting confirm returns `403` with `{"error": "Only the creditor (to_user) can confirm this settlement."}`. |
| **Settlement Reversal** | Either `from_user` or `to_user` can reverse a **confirmed** settlement. | Other users return `403`. Attempting to reverse a pending/already reversed settlement returns `400`. |
| **Expense Immutability** | Once `is_confirmed = True`, an expense **cannot be modified** — only deleted. | Sending `PATCH` on a confirmed expense returns `403` with `{"detail": "A confirmed expense cannot be edited."}`. |
| **Expense Permissions** | Only payer (`paid_by`) or group admin (`IsOwnerOrAdmin`) can update, confirm, or delete an expense. | Other members return `403 Forbidden`. |
| **Balance Version Stale Guard** | `GET optimize-settlements/` calculates a SHA-256 hash of net balances (`balance_version`). `POST apply-optimization/` recalculates and verifies hash match. | Stale hash returns `409 Conflict` with `{"error": "Balances have changed since optimization was generated. Please refresh."}`. Client must re-fetch. |
| **Invite Code Validity** | Invite codes are 8 random alphanumeric characters and expire after 4 days. | Expired or nonexistent code on `POST groups/join/` returns `400` with `{"error": "Invalid or expired invite code."}`. |
| **Rate Limiting** | 1. IP rate limit on `register/` and `verify-otp/`: 5/minute/IP (`django-ratelimit`).<br>2. User rate limit on `report/`: 3/hour/user (`django-ratelimit`).<br>3. General DRF throttles: Anon 10/min, User 30/min. | `django-ratelimit` returns `403 Forbidden`. DRF throttle returns `429 Too Many Requests`. Frontend must handle both gracefully. |
| **JWT Lifecycle** | Access: 30 minutes. Refresh: 7 days. `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`. | Each `POST token/refresh/` invalidates old refresh and provides new access + refresh pair. `POST logout/` blacklists refresh token (`205 Reset Content`). |
| **OTP Registration Flow** | `POST register/` creates user with `is_active=False` and returns `temp_token` (JWT with `purpose="verify_otp"`, 5-min expiry). Client submits `POST verify-otp/` with `Authorization: Bearer <temp_token>`. | `VerifyOTPView` validates TOTP secret, deletes OTP, activates user (`is_active=True`), and returns standard access + refresh tokens (auto-login). In dev, TOTP code logs to backend console. |
| **Split Type 1: `equal`** | Input: `split_type: "equal"`, `total_amount: int > 0`, `splits: [{"user": int}]`. | Backend service divides `total_amount` equally among listed users. Do not pass `amount` in `splits`. |
| **Split Type 2: `exact`** | Input: `split_type: "exact"`, `splits: [{"user": int, "amount": int}]`. | Each split entry must specify `amount`. Backend sets `total_amount` to sum of amounts. |
| **Split Type 3: `percentage`** | Input: `split_type: "percentage"`, `total_amount: int > 0`, `splits: [{"user": int, "percentage": float}]`. | Percentages must sum to exactly `100.0` (tolerance `0.001`). Backend calculates each split amount from `total_amount * percentage / 100`. |
| **Split Type 4: `itemized`** | Input: `split_type: "itemized"`, `items: [{"name": str, "total_amount": int, "shares": [{"user": int, "amount": int}]}]`. | At least one item required. Each item has total amount and member shares. |
| **Balance Calculation Formula** | Canonical formula: `net = (paid - received) - (owed - sent)`. Positive = creditor (is owed money), Negative = debtor (owes money), 0 = settled. | Balances always calculated fresh on demand from confirmed expenses and settlements. |

---

## 3. WebSocket Protocol & Event Catalog

- **Connection URL:** `ws://<host>/ws/groups/{group_id}/?token=<access_token>` (or `wss://`)
- **Authentication:** JWT access token in query string parameter `token`.
- **Close Codes:** `4001` (missing or invalid token), `4003` (user not a member of group), `4000` (server connection error).
- **Direction:** Server → Client ONLY. Consumer has no client message handling. Frontend never sends messages over WebSocket.
- **Envelope Structure:**
  ```json
  {
    "type": "group_state_changed",
    "group_id": 1,
    "event_type": "expense_created",
    "params": { ... },
    "ts": "2026-10-29T14:30:00.000000Z"
  }
  ```

### The 9 Server Event Types & Parameter Shapes

| # | `event_type` | Trigger Domain Event | `params` Payload Shape | Query Cache Invalidation |
|---|---|---|---|---|
| 1 | `group_created` | Group is initialized | `{}` | `['groups']` |
| 2 | `member_joined` | New member joins via invite code or admin add | `{"phone_number": string}` | `['groups', group_id, 'members']`, `['groups', group_id]` |
| 3 | `member_left` | Member leaves or is removed | `{"phone_number": string}` | `['groups', group_id, 'members']`, `['groups', group_id, 'balances']` |
| 4 | `expense_created` | Payer submits new expense | `{"description": string, "amount": int, "payer": string}` | `['groups', group_id, 'expenses']`, `['groups', group_id]` |
| 5 | `expense_confirmed` | Expense confirmed by payer/admin | `{"description": string, "amount": int}` | `['groups', group_id, 'expenses']`, `['groups', group_id, 'balances']`, `['groups', group_id]` |
| 6 | `expense_deleted` | Expense deleted by payer/admin | `{"description": string, "amount": int}` | `['groups', group_id, 'expenses']`, `['groups', group_id, 'balances']`, `['groups', group_id]` |
| 7 | `settlement_created` | Debtor creates pending settlement | `{"amount": int, "from_phone": string, "to_phone": string}` | `['groups', group_id, 'settlements']` |
| 8 | `settlement_confirmed` | Creditor confirms receipt | `{"amount": int, "from_phone": string, "to_phone": string}` | `['groups', group_id, 'settlements']`, `['groups', group_id, 'balances']` |
| 9 | `settlement_reversed` | Payer or receiver reverses settlement | `{"amount": int, "from_phone": string, "to_phone": string}` | `['groups', group_id, 'settlements']`, `['groups', group_id, 'balances']` |

---

## 4. Screen ↔ Endpoint Map & Frontend Status

| Screen / Feature | Route / UI Element | Backend Endpoints Used | Current Status | Redesign Scope |
|---|---|---|---|---|
| **Login** | `/login` | `POST /accounts/login/` | Partial | Needs i18n, digit normalization, rate-limit 429 countdown, show-password toggle. |
| **Register + OTP** | `/register` | `POST /accounts/register/`, `POST /accounts/verify-otp/` | Partial | Needs step indicator, `temp_token` flow adherence, 6-digit OTP input with paste, dev hint banner, i18n. |
| **Dashboard** | `/dashboard` (redirect from `/`) | `GET /groups/`, `GET /groups/{pk}/balances/` | Partial | Needs semantic colors (`owed`/`owing`), summary cards, quick actions, skeleton/error states, i18n. |
| **Groups List** | `/groups` | `GET /groups/`, `POST /groups/`, `POST /groups/join/`, `POST /groups/{pk}/suggest-name/` | Partial | Needs search/sort, budget progress indicators, AI group name suggestion modal, invite code modal, i18n. |
| **Group Detail: Header & Shell** | `/groups/:id` | `GET /groups/{pk}/`, `GET /groups/{pk}/balances/` | Partial | Needs responsive tab navigation (mobile bottom/drawers), budget bar, net balance chip, WebSocket status indicator. |
| **Group Detail: Expenses Tab** | `/groups/:id?tab=expenses` | `GET /groups/{pk}/expenses/`, `POST /groups/{pk}/expenses/`, `PATCH /groups/{pk}/expenses/{eid}/`, `DELETE /groups/{pk}/expenses/{eid}/` | Partial | Needs all 4 split types forms (equal/exact/percent/itemized), live validation of totals, confirm immutability handling, expense detail drawer. |
| **Group Detail: Settlements Tab** | `/groups/:id?tab=settlements` | `GET /groups/{pk}/settlements/`, `POST /groups/{pk}/settlements/`, `POST /groups/{pk}/settlements/{sid}/confirm/`, `POST /groups/{pk}/settlements/{sid}/reverse/` | Partial | Needs status badges, confirm button (receiver only), reverse button, new settlement dialog, server confirmation handling. |
| **Group Detail: Optimize Dialog** | `/groups/:id` (action button) | `GET /groups/{pk}/optimize-settlements/`, `POST /groups/{pk}/settlements/apply-optimization/` | Partial | Needs `balance_version` submission, 409 stale-balance handling with prompt to refresh, suggestions list review. |
| **Group Detail: Members Tab** | `/groups/:id?tab=members` | `GET /groups/{pk}/members/`, `POST /groups/{pk}/members/add/`, `DELETE /groups/{pk}/members/{uid}/remove/`, `PATCH /groups/{pk}/members/{uid}/role/`, `POST /groups/{pk}/invite/`, `GET /groups/{pk}/qr-code/` | Partial | Needs role management dialog, authenticated PNG QR blob display, invite copy/share, owner transfer awareness. |
| **Group Detail: Activities Tab** | `/groups/:id?tab=activities` | `GET /groups/{pk}/activities/` | Implemented | Needs timeline UI polish, Jalali/relative date formatting, localized action descriptions. |
| **Group Detail: Reports Tab** | `/groups/:id?tab=reports` | `POST /groups/{pk}/report/`, Recharts from expense data | Partial | Needs RTL-aware Recharts (Bar/Pie), PDF email request button with 3/h rate limit feedback. |
| **Profile & Settings** | `/profile` | `GET /accounts/profile/`, `PATCH /accounts/profile/`, `POST /accounts/logout/` | Partial | Needs language switch (fa/en), theme toggle, avatar upload, token refresh blacklist on logout. |
| **Notification Center** | Header bell | `ws://.../ws/groups/{pk}/?token=...` | Partial | In-session notification store, badge counter, drawer/popover, localized text generation from 9 event types + params. |
| **Error / Edge Pages** | `/404`, 403, 500, Offline | None | Partial | Needs custom bilingual SVG illustrations, retry buttons, responsive layouts. |

---

## 5. Frontend Inventory: Keep vs. Delete / Replace

| Component / File | Verdict | Rationale & Plan |
|---|---|---|
| `shared/lib/api.ts` | **Keep & Refactor** | Axios instance and single-flight refresh logic are sound; add `Accept-Language` header, error normalizer, and enhanced 429 countdown support. |
| `features/auth/store.ts` | **Keep & Refactor** | Zustand store with token persistence is clean; align with language and user profile state. |
| `features/notifications/store.ts` | **Keep & Refactor** | Clean session-based notification queue (capped at 100); add translation helper per event type. |
| `shared/lib/utils.ts` | **Keep** | Standard `clsx` + `tailwind-merge` utility (`cn`). |
| `shared/components/ui/*` (Radix wrappers) | **Keep & Refactor** | Radix UI primitives (`dialog`, `dropdown`, `tabs`, `avatar`, `badge`, `card`, etc.) are good foundations; replace physical spacing (`ml/mr/left/right`) with logical CSS (`ms/me/start/end`), integrate design system tokens. |
| `shared/hooks/useWebSocket.ts` | **Replace** | Needs exponential backoff with jitter, token refresh on reconnection, event deduplication, and connection state reporting. |
| `shared/lib/formats.ts` | **Replace** | Basic formatters; replace with centralized `shared/lib/format` module supporting Jalali (`fa-IR-u-ca-persian`), Gregorian, Toman currency formatting, and Persian digit normalization. |
| Hardcoded Persian strings | **Delete / Replace** | Every user-facing string must move to `src/locales/{fa,en}/*.json` with `react-i18next`. |
| Feature pages & forms | **Refactor in Phases 2–6** | Rebuild with React Hook Form + Zod schemas, logical direction styling, mobile drawers, and exact contract adherence. |
