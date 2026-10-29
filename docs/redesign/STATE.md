# HamPool Redesign — Project State

## Status
- **Current Phase:** Phase 7 completed (All Phases 0–7 Complete).
- **Project State:** Redesign master plan fully implemented, tested, and verified.

## Decisions Made
- **Architecture & Foundation:** Fully extracted contracts in `ANALYSIS.md`. Design tokens in `DESIGN_SYSTEM.md`. Self-hosted Vazirmatn & Inter fonts. `LanguageProvider` with Radix `DirectionProvider` (logical CSS only). Centralized formatting layer in `@/shared/lib/format` (Toman currency, Jalali/Gregorian dates, digit normalization).
- **Auth, Dashboard & Groups:** 2-step register + OTP (`temp_token`), single-flight refresh interceptor, 429 countdown. Semantic balance summary (`owed`/`owing`), search/sort, create/join with `MoneyInput`.
- **Detail, Expenses & Realtime:** 5-tabs shell, all 4 split types with live validation, immutability guard. Two-party settlements with receiver-only confirm, optimal settlement plan with `balance_version` protection. Realtime WS manager with exponential backoff + jitter, deduplication, and granular query cache invalidation.
- **Members, Reports, Profile & Errors:** Role management, invite code & QR blob handling. AI name suggestions via Gemini with graceful fallback. RTL Recharts and rate-limited PDF export. Live language & theme switching, logout token blacklisting. Bilingual 404/403/500/offline pages.
- **PWA & Performance:** `vite-plugin-pwa` precaching static assets with NetworkOnly API protection. Route-level code-splitting with `React.lazy` & `Suspense`. Vendor chunks split under 400 kB.
- **Testing & Tooling:** 57 Vitest + MSW tests and 2 Playwright bilingual e2e tests passing. GitHub Actions CI updated. Fresh screenshots captured in `screenshots/`.

## Final Master Plan Checklist
| Phase | Scope | Status | Notes |
|---|---|---|---|
| Phase 0 | Analysis & contract extraction | Done | `ANALYSIS.md` & `BACKEND_CHANGE_REQUESTS.md` created |
| Phase 1 | Foundation (design tokens, i18n, assets, shell) | Done | Tokens, SVG asset suite, formatting layer, shell |
| Phase 2 | Auth screens (login, register + OTP) | Done | Phone auth, TOTP verification, token refresh |
| Phase 3 | Dashboard & Groups | Done | Balances, quick actions, search/sort, create/join |
| Phase 4 | Group detail & Expenses (all 4 split types) | Done | Equal/exact/percent/itemized splits, drawer, immutability |
| Phase 5 | Settlements, optimization & realtime events | Done | Confirm/reverse, optimal plan, WS backoff, notifications |
| Phase 6 | Members/invite/QR, AI name, Reports, Profile, Errors | Done | QR blob, Gemini rename, RTL charts, profile, error pages |
| Phase 7 | PWA, performance, a11y, tests, docs, verification | Done | PWA manifest/SW, code splitting, e2e tests, I18N_GUIDE |
