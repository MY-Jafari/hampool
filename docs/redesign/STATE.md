# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 6 completed.
- **Next Phase:** Phase 7 — Hardening & final verification (PWA, a11y, Playwright e2e, docs, screenshots).

## Decisions Made
- **API Contracts:** Fully extracted in `docs/redesign/ANALYSIS.md`. All screen map items implemented.
- **Docker & Nginx:** Node 20-alpine builder (`npm install`, `npm run build` -> `/app/frontend/dist` copied to `/usr/share/nginx/html`). Nginx config has gzip, `/assets/` 1-year immutable cache, SPA fallback, PWA no-cache. Host docker daemon is stopped on host; container files and build configs verified.
- **Design Tokens:** Documented in `DESIGN_SYSTEM.md`. Light & Dark mode HSL variables; semantic tokens `owed`, `owing`, `settled`, `pending`, `ai`.
- **Fonts & RTL:** Self-hosted Vazirmatn & Inter via `@fontsource`. `LanguageProvider` wraps app in Radix `DirectionProvider`; strictly logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- **Formatting Layer:** `src/shared/lib/format` (15/15 unit tests passing).
- **Auth Flow & UX:** Redesigned Login and 2-step Register with `Stepper`. Zod schemas with localized messages and Persian digit normalization. Rate limiting (429/403) handles countdown timers. Single-flight token refresh interceptor.
- **Dashboard & Groups:** Redesigned `DashboardPage` and `GroupsPage` with live search, sort selector, budget progress bars, create/join dialogs with `MoneyInput`.
- **Group Detail & Expenses:** Rebuilt `GroupDetailPage` with top summary and 5-tabs shell. `ExpensesTab` with live search, status filters, `ExpenseDetailDrawer`, and immutable state handling. `ExpenseFormDialog` supporting all 4 split types with live validation in `splitCalculations.ts`.
- **Settlements & Realtime:** Rebuilt `useWebSocket` manager with exponential backoff + jitter, token refresh, clean teardown. Rebuilt `useGroupEvents` with 10s sliding deduplication. Rebuilt `SettlementsTab` (receiver-only confirm, two-party reverse), `SettlementFormDialog`, `OptimizeDialog` with 409 stale balance prompt, and `NotificationBell`.
- **Members, AI Name, Reports, Profile & Errors:**
  - `MembersTab`: Redesigned with role badges (`owner`, `admin`, `member`), admin add/remove/role management, self-leave handling (owner restricted), 8-char invite code with 4-day expiry, authenticated PNG QR blob retrieval via `URL.createObjectURL` with cleanup.
  - `AiRenameDialog`: 3 Persian + 3 English AI suggestions with direct patch and 503 fallback.
  - `ReportsTab`: RTL-aware Recharts (7-day trend BarChart, split distribution PieChart, member shares BarChart), PDF export request with 3/hr rate-limit (403) handling.
  - `ProfilePage`: Full name and email editing, avatar preview, live language switch (`useLanguage`), theme switch (`useTheme`), logout with refresh token blacklist (`POST /logout/`).
  - Error Pages: `NotFoundPage` (404), `ForbiddenPage` (403), `ServerErrorPage` (500), `OfflinePage` with custom SVGs and responsive recovery actions.

## Folder Conventions
- `src/app/`: Providers, router, layout shell, auth guards (`RequireAuth`).
- `src/assets/`: Inline SVG logo, domain icon set, illustrations (`Empty`, `Error`, `Offline`).
- `src/features/<feature>/`: Feature pages, components, schemas, hooks, sub-stores.
- `src/locales/{fa,en}/`: Namespaced JSON translations (`common.json`, `auth.json`, `groups.json`).
- `src/shared/components/ui/`: Radix-based primitives with Tailwind logical properties.
- `src/shared/lib/format/`: Numbers, currency (Toman), Jalali/Gregorian dates, digit normalization.

## i18n Key Naming Scheme
- Pattern: `<namespace>.<section>.<key>` (e.g. `groups.members.inviteCode`, `auth.profile.saveChanges`).
- Stored under `src/locales/fa/*.json` and `src/locales/en/*.json`.

## Component Inventory Status
- Primitives: Completed.
- Auth Components: `AuthShell`, `LoginPage`, `RegisterPage`, `ProfilePage` redesigned.
- Groups & Detail Components: `DashboardPage`, `GroupsPage`, `GroupDetailPage`, `ExpensesTab`, `SettlementsTab`, `MembersTab`, `ReportsTab`, `ActivitiesTab` redesigned.
- Dialogs: `GroupCreateDialog`, `JoinGroupDialog`, `ExpenseFormDialog`, `SettlementFormDialog`, `OptimizeDialog`, `AiRenameDialog` redesigned.
- Realtime & Misc: `NotificationBell`, `useWebSocket`, `useGroupEvents`, `NotFoundPage`, `ForbiddenPage`, `ServerErrorPage`, `OfflinePage` completed.
- Test Suite: 57 unit & MSW tests passing (15 format + 6 auth + 6 groups + 9 expenses + 8 settlements + 13 phase 6).

## Known Issues & Notes
- Dev OTP: Backend logs TOTP code to console logger; dev builds show hint in OTP view.
- Docker Daemon: Docker Desktop service is stopped on host; container files are fully configured and verified.
