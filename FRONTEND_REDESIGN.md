# HamPool — Frontend Redesign Master Plan (agent-executable)

> Place this file in the repo root. It is the single source of truth for the redesign.
> **Kickoff prompt for the agent:** `Read FRONTEND_REDESIGN.md fully, then execute ONLY the first unchecked phase in the Progress Tracker. Follow the Operating Rules strictly.`

---

## 0. Operating Rules (read first, obey always)

**Token discipline (most important):**
1. Execute **exactly one phase per session**, then update the tracker, commit, and stop with a summary of **max 10 lines**. Never start the next phase on your own.
2. Never read the whole repo. In each phase read **only** the files listed under that phase's `READ`. Use `grep`/`rg`/targeted line ranges instead of opening large files.
3. Phase 0 compresses the backend into `docs/redesign/ANALYSIS.md`. After Phase 0 you must **not** reopen backend code unless a phase says so or a contract mismatch is found; read ANALYSIS.md instead.
4. Keep `docs/redesign/STATE.md` (≤ 80 lines) updated at the end of every phase: decisions made, folder conventions, i18n key naming scheme, component inventory, known issues. A fresh session must be able to resume from `FRONTEND_REDESIGN.md` + `STATE.md` + `ANALYSIS.md` + `DESIGN_SYSTEM.md` alone.
5. Don't paste file contents in chat. Don't re-read a file you just wrote. Batch related edits into as few tool calls as possible. Run commands quietly (`--silent`, `| tail -n 30`).
6. Don't take screenshots or open a browser except where a phase explicitly says so.
7. Don't write long explanations or plans in chat; write them into the docs files only if listed in the phase deliverables.

**Safety rules:**
8. Do **not** change backend API contracts or backend code. Needed backend changes go to `docs/redesign/BACKEND_CHANGE_REQUESTS.md` (one line each); build the frontend to work without them.
9. Roadmap items in README (group chat, password recovery, 2FA recovery, receipt upload, server-stored notifications, online payment) are **not implemented**. Never fake them as working.
10. At the end of every phase this must pass: `cd frontend && npx tsc -b && npm run lint && npm run build`. If it fails, fix before finishing the phase. No `any`, no dead code, no leftover old components after replacement.
11. When something is ambiguous, pick the most reasonable production-grade option, record it in `STATE.md`, and continue. Ask the user only if truly blocked.
12. Commit at the end of each phase: `feat(frontend): phase N — <name>` (Conventional Commits).

---

## 1. Fixed Product Decisions

| Topic | Decision |
|---|---|
| Stack | Keep: React 18, Vite, TypeScript strict, Tailwind, shadcn/ui (Radix), TanStack Query, Axios, Zustand, React Hook Form + Zod, Recharts, lucide-react. Add only: `react-i18next` (+ `i18next-browser-languagedetector`), `framer-motion`, `vite-plugin-pwa`, `vitest` + Testing Library + MSW, `@playwright/test`. |
| Languages | Persian `fa` (RTL, **default**) and English `en` (LTR). |
| Currency | Amounts are **Toman**. fa label «تومان», en label "Toman" (same numeric value, no conversion). |
| Calendar | fa → Jalali (`fa-IR-u-ca-persian`), en → Gregorian. API always uses Latin digits + ISO dates. |
| Landing page | **None.** `/` redirects to `/login` when unauthenticated, otherwise to `/dashboard`. No marketing SEO work needed (keep sane `<title>`/meta per route only). |
| Brand | Agent's free choice. Design an original HamPool identity (name = هم‌پول / HamPool, theme: shared money, pool/water, togetherness). Record palette + logo concept in DESIGN_SYSTEM.md. |
| Theme | Light + Dark (system default, manual toggle, persisted). |
| Inspiration | Splitwise (domain patterns: you owe / you are owed, settle up), Stripe/Linear (typography, spacing, polish), Wise/Revolut (money presentation), Digikala/Snapp (Persian UX familiarity). Never copy brand assets or exact layouts. |
| Assets | All icons/illustrations/logo created as optimized **SVG** (use `currentColor`, theme-aware). If an image-generation tool is available it may be used only for optional raster art (WebP, lazy, with width/height and bilingual alt). No hot-linked external images. Fonts self-hosted (Vazirmatn for fa, Inter for en; woff2, `font-display: swap`). |

---

## 2. Global Spec (applies to every phase; keep compact)

**Design system:** tokens as CSS variables + Tailwind theme (color scales; semantic colors for `owed` / `owing` / `settled` / `pending`; radius, shadow, spacing, motion). Mobile-first 360→1920px; bottom nav on mobile, sidebar on desktop; drawers instead of dialogs on small screens. Every data screen has loading skeleton, empty state, error + retry, and a WebSocket-disconnected indicator where relevant. Motion is subtle and respects `prefers-reduced-motion`. WCAG AA contrast; color is never the only signal.

**RTL/LTR rules (critical):**
- Switching language at runtime (no reload) updates: `<html lang>`, `<html dir>`, font family, number/date/currency formatting; persisted in localStorage; first visit detects browser language (fallback fa).
- Use only logical utilities (`ms-* me-* ps-* pe-* start-* end-* text-start`), never `left/right/ml/mr` for layout.
- Mirror directional icons (chevrons, arrows, back) in RTL; don't mirror logo, phone numbers, media controls.
- Radix/shadcn: wrap app in `DirectionProvider`; verify Dialog/Drawer/Dropdown/Tabs/Toast placement, Recharts axes/tooltips in RTL.
- Phone / amount / OTP inputs stay `dir="ltr"` inside RTL pages with proper alignment.
- Inputs accept Persian/Arabic-Indic digits and normalize to Latin before API calls.
- Send `Accept-Language` with every request. Map backend errors to localized messages (by code/field, graceful fallback).
- No hard-coded strings anywhere (toasts, Zod messages, aria-labels, titles, WS event messages). Key scheme: `namespace.section.key`, files `src/locales/{fa,en}/<namespace>.json`.

**Formatting layer** `src/shared/lib/format`: `formatMoney`, `formatNumber`, `formatDate`, `formatDateTime`, `formatRelative`, `normalizeDigits`. One implementation, used everywhere.

**Engineering:** route-level code splitting; strict typed API payloads + Zod validation at the response boundary; single-flight JWT refresh in the Axios interceptor; 401/403/429 UX (429 with countdown); financial actions (confirm, settle, apply optimization) are server-confirmed, double-submit-safe, never optimistic; WS manager with exponential backoff + jitter, token refresh on reconnect, event dedupe, per-`event_type` query invalidation, clean teardown. No secrets in bundle. Build must stay compatible with `nginx/Dockerfile`, `nginx/default.conf`, both compose files, and the Vite dev proxy (`/api`, `/ws`).

---

## 3. Progress Tracker (update after each phase)

- [x] **Phase 0** — Analysis & contract extraction
- [x] **Phase 1** — Foundation: design system, i18n/RTL, assets, app shell
- [ ] **Phase 2** — Auth screens (login, register + OTP) & route guards
- [ ] **Phase 3** — Dashboard & Groups list/create/join
- [ ] **Phase 4** — Group detail + Expenses (all 4 split types)
- [ ] **Phase 5** — Settlements, optimal settlement, WebSocket notifications
- [ ] **Phase 6** — Members/invite/QR, AI name, Reports, Profile, error pages
- [ ] **Phase 7** — PWA, performance, a11y, tests, final verification & docs

---

## 4. Phases

### Phase 0 — Analysis & contract extraction
**READ:** `frontend/API_SUMMARY.md`, `frontend/WIREFRAMES.md`, `README.md` (skim), `apps/*/api/v1/` serializers + urls (grep for field names, don't read everything line by line), `apps/groups/consumers.py`, `apps/groups/ws_handlers.py`, `apps/accounts/` auth views, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/` **file tree only** (+ open only `shared/lib/api*` and the store files), `nginx/default.conf`.
**DO:** Create `docs/redesign/ANALYSIS.md` (compact tables, no prose) containing:
1. Endpoint table: method, path, auth, request fields (type/required/validation), response shape, error format, permissions, pagination.
2. Business rules: roles (admin/member), only receiver confirms settlement, confirmed expenses immutable, `balance_version` stale protection, invite code expiry, rate limits, JWT refresh/blacklist, OTP flow with `temp_token`, 4 split types and their validation.
3. WebSocket: URL, auth, 9 event types with `params` shape.
4. Screen ↔ endpoint map and current frontend status (implemented / partial / missing).
5. Current frontend inventory: reusable pieces worth keeping vs. to delete.
Create `docs/redesign/STATE.md` and `BACKEND_CHANGE_REQUESTS.md` (empty template).
**DONE WHEN:** ANALYSIS.md covers every endpoint and event; no source code changed.

### Phase 1 — Foundation
**READ:** `docs/redesign/ANALYSIS.md`, `STATE.md`, `frontend/tailwind.config.*`, `frontend/src/app/*`, `frontend/src/shared/ui/*` (names only; open a file only if it will be kept).
**DO:**
1. Install deps listed in §1. Self-host fonts.
2. Design tokens + light/dark theme + Tailwind theme extension. Write `frontend/docs/DESIGN_SYSTEM.md` (palette, type scale, spacing, radius, motion, logo concept, component list — concise).
3. i18n setup (`react-i18next`), `LanguageProvider` handling lang/dir/font/persist/detect, `DirectionProvider`, language + theme switchers, formatting layer (§2) with unit tests (Vitest) for digits/money/Jalali date.
4. Rebuild shared UI primitives (shadcn-based) with RTL-safe logical styling: Button, Input (incl. `PhoneInput`, `MoneyInput`, `OtpInput`), Select, Dialog, Drawer/Sheet, Tabs, Table, Card, Badge, Avatar (deterministic color + initials, Persian-safe), Tooltip, Toast, Skeleton, EmptyState, ErrorState, Stepper, `Money`, `DateText`, `StatusBadge`.
5. Assets: logo SVG (mark + fa/en wordmark, light/dark), favicon set, PWA icons (192/512 + maskable), custom domain icon set (split types, settle-up, invite/QR, wallet, group), base illustrations for empty/error states — all SVG components in `src/assets`.
6. App shell: responsive layout (sidebar desktop / bottom-nav mobile), header with language + theme + notifications bell placeholder, router skeleton, `/` redirect rule from §1.
**DONE WHEN:** shell renders in fa/en × light/dark with correct direction; checks pass; tests for format layer pass.

### Phase 2 — Auth
**READ:** `ANALYSIS.md` (auth section), `STATE.md`, existing `features/auth/*`.
**DO:** Redesign Login (phone + password), Register (phone, password, confirm) → OTP verification (6-digit, resend UX, expiry, `temp_token` flow). Zod schemas with localized messages, Persian-digit normalization, 429 countdown, show-password, safe error mapping. Axios interceptor with single-flight refresh, logout with refresh blacklist, route guards, post-login redirect. Dev-note: OTP prints in backend console in dev (small hint only in dev builds).
**DONE WHEN:** full register → OTP → login → logout → refresh flow works against the real backend; tests (MSW) for login + OTP; checks pass.

### Phase 3 — Dashboard & Groups
**READ:** `ANALYSIS.md` (accounts/groups endpoints), `STATE.md`, `features/dashboard/*`, `features/groups/*` (list/create/join only).
**DO:** Dashboard (total owed/owing summary with semantic colors, groups overview, recent expenses, quick actions). Groups list with search/sort, create-group dialog (name, budget in Toman), join-by-code flow, per-group balance chip, skeleton/empty/error states.
**DONE WHEN:** screens use only real endpoints; correct fa/en/RTL/LTR behavior; checks pass.

### Phase 4 — Group detail & Expenses
**READ:** `ANALYSIS.md` (groups/expenses/balances/activity), `STATE.md`, `features/groups/*` (detail/expense parts).
**DO:** Group detail layout (header, budget progress, member balances) with tabs shell (Expenses, Settlements, Members, Activity, Reports). Expenses tab: list/filter, detail drawer, confirm/delete with correct permission and immutability handling. Add-Expense flow for all 4 split types (equal / exact / percent / itemized) with live validation that totals match, member picker, itemized shares editor; payload exactly per ANALYSIS.md. Activity tab (timeline).
**DONE WHEN:** each split type creates an expense successfully against the backend; unit tests for split calculation/validation; checks pass.

### Phase 5 — Settlements, optimization, realtime
**READ:** `ANALYSIS.md` (settlements, optimize, WS), `STATE.md`, `features/groups/*` (settlement parts), WS manager file.
**DO:** Settlements tab: create, confirm (receiver only), reverse, status badges. Optimal-settlement flow: fetch suggestions, show `from → to` list, apply with `balance_version`, handle stale-data error with a clear refresh prompt. Rebuild WS manager (backoff + jitter, token refresh, dedupe, status indicator) and notification center (bell + list) rendering **localized** messages from the 9 `event_type`s + `params`; invalidate the proper query keys per event. Notifications live only in the session (backend doesn't store them).
**DONE WHEN:** two browser sessions see each other's changes live; stale-version path verified; MSW tests for settle + optimize; checks pass.

### Phase 6 — Members, AI, Reports, Profile, Errors
**READ:** `ANALYSIS.md` (members/invite/qr/ai/report/profile), `STATE.md`, related `features/*`.
**DO:** Members tab (roles, transfer ownership, leave), invite code with expiry + QR image from `/qr-code/` (blob handling) + copy/share. AI group-name suggestion (3 fa + 3 en) with graceful fallback when key missing. Reports tab: Recharts charts (RTL-aware) + request PDF report (emailed) with clear feedback. Profile/settings (PATCH profile, language, theme). 404/403/500/offline pages with SVG illustrations.
**DONE WHEN:** every item in ANALYSIS.md screen map is "implemented"; checks pass.

### Phase 7 — Hardening & final verification
**READ:** `STATE.md`, `DESIGN_SYSTEM.md`, `package.json`, `nginx/*`, `.github/workflows/*`.
**DO:** PWA (installable, offline shell, cached static assets only — never cache API responses with tokens). Performance: bundle analysis, lazy-load charts/heavy routes, image/SVG optimization; Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices) on login + dashboard. A11y pass (keyboard, focus traps, localized aria-labels). Tests: Playwright e2e **in both languages**: login → create group → add expense → optimal settlement → confirm; run MSW/Vitest suites. Update nginx/Docker files only if truly required. Write `frontend/docs/I18N_GUIDE.md` (add a string/language), update README frontend section, capture fresh screenshots into `screenshots/` (fa + en, light + dark: login, dashboard, groups, group-detail) — **this is the only phase allowed to use a browser/screenshots.**
**DONE WHEN:** all checks + tests green; final checklist appended to `STATE.md` listing every requirement in this file as done / not done (+ reason).

---

## 5. Phase End Template (agent output, ≤ 10 lines)

```
Phase N done.
Changed: <3–5 key items>
Checks: tsc ✅ lint ✅ build ✅ tests ✅/n.a.
Decisions recorded in STATE.md: <count>
Backend change requests added: <count>
Next phase: N+1 — <name>
```
