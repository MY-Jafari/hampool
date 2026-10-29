# HamPool Design System

> Concise design tokens, brand identity, and UI system specification.

---

## 1. Brand Identity & Logo Concept

- **Name:** HamPool (هم‌پول)
- **Concept:** "Ham" (هم - together/shared) + "Pool" (pool of funds / water pool / circulation).
- **Logo Mark:** Twin overlapping water droplets forming an endless circulation loop with a central golden/emerald coin core, symbolizing fluid, frictionless shared expense settlement.
- **Wordmark:** Bold geometric Persian typography «هم‌پول» with English subtitle "HamPool".

---

## 2. Color Palette & Semantic Tokens

### Color Scales (Light & Dark)
Tokens are defined as CSS variables in HSL format for instant runtime theme switching:

| Token | Light Value | Dark Value | Purpose |
|---|---|---|---|
| `--background` | `210 40% 98%` (`#F8FAFC`) | `222 35% 7%` (`#0B0F17`) | Page background canvas |
| `--foreground` | `222 47% 11%` (`#0F172A`) | `210 40% 96%` (`#F1F5F9`) | Base text color |
| `--card` | `0 0% 100%` (`#FFFFFF`) | `222 36% 11%` (`#121826`) | Card & container surfaces |
| `--card-foreground` | `222 47% 11%` | `210 40% 96%` | Text on card surfaces |
| `--popover` | `0 0% 100%` | `222 34% 15%` (`#1A2234`) | Menus, popovers, dropdowns |
| `--popover-foreground` | `222 47% 11%` | `210 40% 96%` | Text on popovers |
| `--primary` | `173 80% 36%` (`#0D9488` Teal) | `168 76% 42%` (`#14B8A6` Emerald Teal) | Primary actions & active states |
| `--primary-foreground` | `0 0% 100%` | `222 35% 7%` | Text on primary |
| `--secondary` | `210 40% 94%` | `222 25% 18%` | Secondary buttons & pills |
| `--secondary-foreground` | `222 47% 11%` | `210 40% 90%` | Text on secondary |
| `--muted` | `210 40% 94%` | `222 25% 16%` | Background for disabled/inactive items |
| `--muted-foreground` | `215 16% 47%` | `215 20% 65%` | Subtle subtitles & metadata |
| `--border` | `214 32% 91%` | `222 25% 18%` | Component borders |
| `--input` | `214 32% 91%` | `222 25% 20%` | Form input borders |
| `--ring` | `173 80% 36%` | `168 76% 42%` | Focus ring outline |

### Financial Semantic Colors

| State | Variable | Light Value | Dark Value | Usage |
|---|---|---|---|---|
| **Owed (Creditor)** | `--owed` | `158 64% 38%` (`#059669`) | `158 64% 52%` (`#10B981`) | Positive net balance, money you receive |
| **Owing (Debtor)** | `--owing` | `350 89% 50%` (`#E11D48`) | `350 89% 60%` (`#F43F5E`) | Negative net balance, money you owe |
| **Settled** | `--settled` | `215 16% 47%` (`#64748B`) | `215 20% 65%` (`#94A3B8`) | Zero balance, settled expenses |
| **Pending** | `--pending` | `38 92% 50%` (`#D97706`) | `38 92% 56%` (`#F59E0B`) | Unconfirmed settlements, pending items |
| **AI Assist** | `--ai` | `262 83% 58%` (`#7C3AED`) | `258 90% 66%` (`#8B5CF6`) | Smart suggestions, Gemini buttons |

---

## 3. Typography & Direction

- **Persian (`fa`):** Self-hosted `Vazirmatn` (weights 400, 500, 600, 700). Default direction: `rtl`.
- **English (`en`):** Self-hosted `Inter` (weights 400, 500, 600, 700). Default direction: `ltr`.
- **Display Swap:** `font-display: swap` for instant text rendering without FOIT.
- **RTL Logical Properties:** Strictly use `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`. Physical `left/right/ml/mr` are banned for layout.
- **Numeric & Monetary Direction:** Amounts, phone numbers, and OTP inputs maintain `dir="ltr"` inside both RTL and LTR viewports.

---

## 4. Spacing, Elevation & Radius

- **Radius Tokens:**
  - `sm`: `0.375rem` (6px) — badges, tags, mini chips
  - `md`: `0.5rem` (8px) — inputs, buttons, menu items
  - `lg`: `0.75rem` (12px) — cards, modal sheets
  - `xl`: `1rem` (16px) — modal dialogs, drawers
  - `full`: `9999px` — avatars, round pills
- **Elevation / Shadows:**
  - `card`: Subtle border + soft ambient drop shadow.
  - `card-hover`: Lifted card shadow for interactive tiles.
  - `drawer`: Deep ambient occlusion for sheets and bottom drawers.

---

## 5. Motion Tokens

- **Duration:**
  - Fast: `150ms` (hover, active, toggle)
  - Base: `200ms` (dropdowns, accordions, tabs)
  - Emphasized: `300ms` (dialog transitions, mobile drawer open/close)
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo snappy natural feel).
- **Accessibility:** Motion is disabled when `prefers-reduced-motion: reduce`.

---

## 6. Shared Component Inventory

1. `Button`: Solid, outline, ghost, destructive, link, ai variants; loading spinner; RTL icon spacing (`gap-2`).
2. `Input`: Accessible input with logical padding, error states, and helper text.
3. `PhoneInput`: LTR phone field with Iranian mobile mask validation (`09xxxxxxxxx`).
4. `MoneyInput`: LTR formatted currency input with comma grouping and Toman unit suffix.
5. `OtpInput`: 6-slot OTP field with automatic focus advancing, paste handling, and digit normalization.
6. `Select`: Accessible Radix-powered dropdown select with RTL placement awareness.
7. `Dialog`: Desktop center modal with backdrop blur and focus trap.
8. `Drawer`: Responsive sheet (slide-up bottom drawer on mobile, side or dialog on desktop).
9. `Tabs`: Radix tabs with animated active pill indicator respecting RTL orientation.
10. `Table`: Responsive data table with logical alignments.
11. `Card`: Layered container with header, content, footer, and interactive hover states.
12. `Badge`: Semantic badges (`default`, `secondary`, `owed`, `owing`, `pending`, `settled`, `ai`).
13. `Avatar`: User avatar with image fallback, deterministic pastel colors, and Persian/Latin safe initials.
14. `Tooltip`: Accessible Radix tooltip with arrow.
15. `Toast`: Rich Sonner toasts configured with RTL direction and localized typography.
16. `Skeleton`: Animated shimmer loading state for cards, lists, and avatars.
17. `EmptyState`: Centered friendly empty illustration + localized title + description + action CTA.
18. `ErrorState`: Error illustration with error message and retry button.
19. `Stepper`: Multi-step wizard indicator (used in 2-step registration).
20. `Money`: Dedicated inline component rendering formatted numbers with semantic color and Toman unit.
21. `DateText`: Localized Jalali (`fa-IR-u-ca-persian`) or Gregorian date/time renderer.
22. `StatusBadge`: Pre-configured badge for expense (`confirmed`/`unconfirmed`) and settlement (`pending`/`confirmed`/`reversed`).
