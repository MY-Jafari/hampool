# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 5 completed.
- **Next Phase:** Phase 6 — Members/invite/QR, AI name, Reports, Profile, error pages.

## Decisions Made
- **API Contracts:** Fully extracted in `docs/redesign/ANALYSIS.md`. Unwired backend `transfer-ownership` logged in `BACKEND_CHANGE_REQUESTS.md`.
- **Docker & Nginx:** Node 20-alpine builder (`npm install`, `npm run build` -> `/app/frontend/dist` copied to `/usr/share/nginx/html`). Nginx config has gzip, `/assets/` 1-year immutable cache, SPA fallback, PWA no-cache. `.dockerignore` configured. Host docker daemon is stopped on host; container configs verified.
- **Design Tokens:** Documented in `DESIGN_SYSTEM.md`. Light & Dark mode HSL variables; semantic tokens `owed`, `owing`, `settled`, `pending`, `ai`.
- **Fonts & RTL:** Self-hosted Vazirmatn & Inter via `@fontsource`. `LanguageProvider` wraps app in Radix `DirectionProvider`; strictly logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- **Formatting Layer:** `src/shared/lib/format` (15/15 unit tests passing).
- **Auth Flow & UX:** Redesigned Login and 2-step Register with `Stepper`. Zod schemas with localized messages and Persian digit normalization. Rate limiting (429/403) handles countdown timers. Show-password eye toggle. 6-slot `OtpInput` with auto-advance and resend timer. Single-flight token refresh interceptor. 6 MSW tests passing.
- **Dashboard & Groups:** Redesigned `DashboardPage` and `GroupsPage` with live search, sort selector, budget progress bars, create/join dialogs with `MoneyInput`.
- **Group Detail & Expenses:** Rebuilt `GroupDetailPage` with top summary (budget bar & member balances strip) and 5-tabs shell. `ExpensesTab` with live search, status filters, `ExpenseDetailDrawer`, and immutable state handling. `ExpenseFormDialog` supporting all 4 split types with live validation in `splitCalculations.ts`.
- **Settlements, Optimization & Realtime:** Rebuilt `useWebSocket` manager with exponential backoff + random jitter (1s → 30s), relative URL building (`buildWebSocketUrl`), fresh JWT acquisition on reconnect, clean teardown. Rebuilt `useGroupEvents` with 10s sliding event deduplication, granular query cache invalidation per event type, and localized event message formatter. Rebuilt `SettlementsTab` (receiver-only confirm, two-party reverse), `SettlementFormDialog` with `MoneyInput`, `OptimizeDialog` with 409 stale balance prompt, and `NotificationBell`.

## Folder Conventions
- `src/app/`: Providers, router, layout shell, auth guards (`RequireAuth`).
- `src/assets/`: Inline SVG logo, domain icon set, illustrations (`Empty`, `Error`, `Offline`).
- `src/features/<feature>/`: Feature pages, components, schemas, hooks, sub-stores.
- `src/locales/{fa,en}/`: Namespaced JSON translations (`common.json`, `auth.json`, `groups.json`).
- `src/shared/components/ui/`: Radix-based primitives with Tailwind logical properties.
- `src/shared/lib/format/`: Numbers, currency (Toman), Jalali/Gregorian dates, digit normalization.

## i18n Key Naming Scheme
- Pattern: `<namespace>.<section>.<key>` (e.g. `groups.settlements.confirmSettlement`, `groups.optimize.staleError`).
- Stored under `src/locales/fa/*.json` and `src/locales/en/*.json`.

## Component Inventory Status
- Primitives: Completed.
- Auth Components: `AuthShell`, `LoginPage`, `RegisterPage` redesigned.
- Dashboard & Groups Components: `DashboardPage`, `GroupsPage`, `GroupCreateDialog`, `JoinGroupDialog` redesigned.
- Detail & Expense Components: `GroupDetailPage`, `ExpensesTab`, `ExpenseFormDialog`, `ExpenseDetailDrawer`, `ActivitiesTab` redesigned.
- Settlements & Realtime Components: `SettlementsTab`, `SettlementFormDialog`, `OptimizeDialog`, `NotificationBell`, `useWebSocket`, `useGroupEvents` redesigned.
- Test Suite: 44 unit & MSW tests passing (15 format + 6 auth + 6 groups + 9 expenses + 8 settlements/events).

## Known Issues & Notes
- Dev OTP: Backend logs TOTP code to console logger; dev builds show hint in OTP view.
- Docker Daemon: Docker Desktop service is stopped on host; container files are fully configured and verified.
