# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 3 completed.
- **Next Phase:** Phase 4 — Group detail + Expenses (all 4 split types).

## Decisions Made
- **API Contracts:** Fully extracted in `docs/redesign/ANALYSIS.md`. Unwired backend `transfer-ownership` logged in `BACKEND_CHANGE_REQUESTS.md`.
- **Docker & Nginx:** Node 20-alpine builder (`npm install`, `npm run build` -> `/app/frontend/dist` copied to `/usr/share/nginx/html`). Nginx config has gzip, `/assets/` 1-year immutable cache, SPA fallback, PWA no-cache. `.dockerignore` configured. Host docker daemon is stopped on host; container configs verified.
- **Design Tokens:** Documented in `DESIGN_SYSTEM.md`. Light & Dark mode HSL variables; semantic tokens `owed`, `owing`, `settled`, `pending`, `ai`.
- **Fonts & RTL:** Self-hosted Vazirmatn & Inter via `@fontsource`. `LanguageProvider` wraps app in Radix `DirectionProvider`; strictly logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- **Formatting Layer:** `src/shared/lib/format` (15/15 unit tests passing).
- **Auth Flow & UX:** Redesigned Login and 2-step Register with `Stepper`. Zod schemas with localized messages and Persian digit normalization. Rate limiting (429/403) handles countdown timers. Show-password eye toggle. 6-slot `OtpInput` with auto-advance and resend timer. Single-flight token refresh interceptor. 6 MSW tests passing.
- **Dashboard & Groups:** Redesigned `DashboardPage` with semantic balance cards (`owed` / `owing`), per-group balance chips, recent expenses list with domain split icons and confirmation badges. Redesigned `GroupsPage` with live search, sort selector (recent/name/expenses), budget progress bars. `GroupCreateDialog` uses `MoneyInput` (Toman) and localized validation; `JoinGroupDialog` handles 8-char invite code uppercase normalization.
- **UI Primitives:** `Button` component fixed to cleanly support Radix `Slot` when `asChild=true`. `StatCard` supports `owed` and `owing` tones and React nodes.

## Folder Conventions
- `src/app/`: Providers, router, layout shell, auth guards (`RequireAuth`).
- `src/assets/`: Inline SVG logo, domain icon set, illustrations (`Empty`, `Error`, `Offline`).
- `src/features/<feature>/`: Feature pages, components, schemas, hooks, sub-stores.
- `src/locales/{fa,en}/`: Namespaced JSON translations (`common.json`, `auth.json`, `groups.json`).
- `src/shared/components/ui/`: Radix-based primitives with Tailwind logical properties.
- `src/shared/lib/format/`: Numbers, currency (Toman), Jalali/Gregorian dates, digit normalization.

## i18n Key Naming Scheme
- Pattern: `<namespace>.<section>.<key>` (e.g. `groups.dashboard.totalOwed`, `groups.list.searchPlaceholder`).
- Stored under `src/locales/fa/*.json` and `src/locales/en/*.json`.

## Component Inventory Status
- Primitives (`button`, `input`, `phone-input`, `money-input`, `otp-input`, `select`, `dialog`, `drawer`, `tabs`, `table`, `card`, `badge`, `avatar`, `stepper`, `money`, `date-text`, `status-badge`, `empty-state`, `error-state`): Completed.
- Auth Components: `AuthShell`, `LoginPage`, `RegisterPage` redesigned.
- Dashboard & Groups Components: `DashboardPage`, `GroupsPage`, `GroupCreateDialog`, `JoinGroupDialog` redesigned.
- Test Suite: 27 unit & MSW tests passing (15 format + 6 auth + 6 groups/dashboard).

## Known Issues & Notes
- Dev OTP: Backend logs TOTP code to console logger; dev builds show hint in OTP view.
- Docker Daemon: Docker Desktop service is stopped on host; container files are fully configured and verified.
