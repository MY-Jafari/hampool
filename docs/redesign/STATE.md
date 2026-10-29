# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 0 completed.
- **Next Phase:** Phase 1 — Foundation (Design system, i18n/RTL, assets, app shell).

## Decisions Made
- **API Contracts:** Fully extracted and frozen in `docs/redesign/ANALYSIS.md`. No further backend reads required.
- **Backend Changes:** Route `transfer-ownership` is unwired in backend `urls.py`; logged as non-blocking in `BACKEND_CHANGE_REQUESTS.md`.
- **Pagination:** Backend DRF has no default pagination; all list endpoints return raw JSON arrays.
- **Auth Flow:** Standard JWT (30m access, 7d refresh with rotation). OTP flow uses 5m temporary JWT with claim `purpose="verify_otp"`.
- **Rate Limits:** `django-ratelimit` returns HTTP 403; DRF throttles return HTTP 429. Both must be handled with friendly countdown/messages.
- **WebSocket:** Unidirectional (server → client) on `/ws/groups/{id}/?token=...`; notifies on 9 event types. Client rebuilds in-session notifications and invalidates queries.
- **Default Locale & Currency:** Persian (`fa`, RTL) default, English (`en`, LTR) secondary. Currency is Toman (no currency conversion).

## Folder Conventions
- `src/app/`: Providers, router, layout shell, auth guards.
- `src/assets/`: Inline SVG assets, logos, domain icons, illustrations.
- `src/features/<feature>/`: Feature pages, components, schemas, hooks, sub-stores.
- `src/locales/{fa,en}/`: Namespaced JSON translations (`common.json`, `auth.json`, `groups.json`, etc.).
- `src/shared/components/ui/`: Radix-based design primitives with Tailwind logical properties (`ms-*`, `me-*`).
- `src/shared/lib/format/`: Single source of truth for numbers, currency (Toman), Jalali/Gregorian dates, and digit normalization.

## i18n Key Naming Scheme
- Pattern: `<namespace>.<section>.<key>` (e.g. `auth.login.title`, `groups.expenses.splitEqual`, `common.actions.confirm`).
- Stored under `src/locales/fa/*.json` and `src/locales/en/*.json`.

## Component Inventory Status
- Primitives (`button`, `dialog`, `input`, `badge`, `card`, `tabs`, `avatar`): Exist; scheduled for RTL logical refactoring in Phase 1.
- Formatters & Parsers: Basic implementation exists; scheduled for unified `src/shared/lib/format` replacement in Phase 1.
- WebSocket Manager: Prototype exists; scheduled for resilient rewrite in Phase 5.

## Known Issues & Notes
- Dev OTP: Backend logs TOTP code to console logger; dev builds should present a helper hint in OTP view.
- Offline & Receipts: Backend receipt upload is optional; no offline financial actions allowed (server confirmation mandatory).
