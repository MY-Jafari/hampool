# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 1 completed.
- **Next Phase:** Phase 2 — Auth screens (login, register + OTP) & route guards.

## Decisions Made
- **API Contracts:** Fully extracted and frozen in `docs/redesign/ANALYSIS.md`. No further backend reads required.
- **Backend Changes:** Route `transfer-ownership` is unwired in backend `urls.py`; logged as non-blocking in `BACKEND_CHANGE_REQUESTS.md`.
- **Pagination:** Backend DRF has no default pagination; all list endpoints return raw JSON arrays.
- **Design Tokens:** Documented in `frontend/docs/DESIGN_SYSTEM.md`. Light & Dark mode HSL variables with semantic financial tokens: `owed` (#10B981), `owing` (#F43F5E), `settled` (#94A3B8), `pending` (#F59E0B), `ai` (#8B5CF6).
- **Fonts & Typography:** Self-hosted Vazirmatn (fa) and Inter (en) via `@fontsource`. Automatic font family switching per locale.
- **RTL & Direction:** `LanguageProvider` manages `html[lang]`, `html[dir]`, dynamic font variable, and wraps app in Radix `DirectionProvider`. Strictly logical CSS utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`).
- **Formatting Layer:** Unified `src/shared/lib/format` (normalizer, numbers with separators, Toman currency, Jalali/Gregorian dates, relative time). 15 unit tests passing.
- **App Shell & Routing:** Desktop sidebar + mobile bottom nav; header with language switch, theme switch, logo, notifications bell, user avatar menu. Route `/` redirects to `/dashboard` (protected by `RequireAuth`).

## Folder Conventions
- `src/app/`: Providers, router, layout shell, auth guards.
- `src/assets/`: Inline SVG logo, domain icon set (`Equal`, `Exact`, `Percentage`, `Itemized`, etc.), illustrations (`Empty`, `Error`, `Offline`).
- `src/features/<feature>/`: Feature pages, components, schemas, hooks, sub-stores.
- `src/locales/{fa,en}/`: Namespaced JSON translations (`common.json`, `auth.json`, `groups.json`).
- `src/shared/components/ui/`: Radix-based primitives with Tailwind logical properties (`Button`, `Input`, `PhoneInput`, `MoneyInput`, `OtpInput`, `Select`, `Dialog`, `Drawer`, `Tabs`, `Table`, `Card`, `Badge`, `Avatar`, `Stepper`, `Money`, `DateText`, `StatusBadge`).
- `src/shared/lib/format/`: Single source of truth for numbers, currency (Toman), Jalali/Gregorian dates, and digit normalization.

## i18n Key Naming Scheme
- Pattern: `<namespace>.<section>.<key>` (e.g. `auth.login.title`, `groups.splits.equal`, `common.actions.confirm`).
- Stored under `src/locales/fa/*.json` and `src/locales/en/*.json`.

## Component Inventory Status
- Primitives (`button`, `input`, `phone-input`, `money-input`, `otp-input`, `select`, `dialog`, `drawer`, `tabs`, `table`, `card`, `badge`, `avatar`, `stepper`, `money`, `date-text`, `status-badge`, `empty-state`, `error-state`): Completed and verified.
- Formatters & Unit Tests: Completed in `src/shared/lib/format` (15/15 passing).
- App Shell & Navigation: Completed in `src/app/layouts/AppLayout.tsx`.

## Known Issues & Notes
- Dev OTP: Backend logs TOTP code to console logger; dev builds should present a helper hint in OTP view.
- Offline & Receipts: Backend receipt upload is optional; no offline financial actions allowed (server confirmation mandatory).
