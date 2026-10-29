# HamPool Internationalization (i18n) & RTL Guide

This guide describes how internationalization, localization, and right-to-left (RTL) layout work in HamPool, and provides step-by-step instructions for adding new strings or supporting new languages.

---

## 1. Architecture Overview

HamPool supports full runtime bilingual switching between **Persian (fa)** and **English (en)** without page reloads.

- **Default Language:** Persian (`fa`), direction: `rtl`.
- **Secondary Language:** English (`en`), direction: `ltr`.
- **Fonts:** Self-hosted Vazirmatn for Persian, Inter for English via `@fontsource`.
- **Direction:** Managed by `LanguageProvider` wrapping Radix `DirectionProvider`.
- **Formatting Layer:** Centralized in `@/shared/lib/format` (numbers, Toman currency, Jalali/Gregorian dates, Persian/Arabic digit normalization).

---

## 2. File Structure & Namespaces

Translations are located under `frontend/src/locales/`:

```
frontend/src/locales/
├── fa/
│   ├── auth.json       # Login, Register, OTP verification, Profile
│   ├── common.json     # Brand, Navigation, Actions, Status, Errors, Theme
│   └── groups.json     # Dashboard, Groups list, Expenses, Settlements, Members, Reports
└── en/
    ├── auth.json
    ├── common.json
    └── groups.json
```

### Key Naming Convention
Every translation key follows the pattern:
```
<namespace>.<section>.<key>
```
Examples:
- `groups.members.inviteCode`
- `groups.expenses.newExpense`
- `auth.profile.saveChanges`
- `common.errors.notFoundTitle`

---

## 3. How to Add a New Translation String

### Step 1: Add the Persian string
Open `frontend/src/locales/fa/<namespace>.json` and add your key:
```json
{
  "section": {
    "myNewKey": "متن فارسی جدید"
  }
}
```

### Step 2: Add the English string
Open `frontend/src/locales/en/<namespace>.json` and add the matching key:
```json
{
  "section": {
    "myNewKey": "My New English Text"
  }
}
```

### Step 3: Use the key in your React component
```tsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation('groups'); // or ['groups', 'common']

  return <div>{t('section.myNewKey')}</div>;
}
```

With parameters:
```tsx
// In JSON: "greeting": "سلام {{name}}!"
t('greeting', { name: 'امیر' })
```

---

## 4. Formatting Layer Guidelines

Always import formatters from `@/shared/lib/format` — never format numbers, currency, or dates manually inline.

### 1. Money & Currency (Toman)
All financial amounts in HamPool are in **Toman**. No currency conversion is performed.
```tsx
import { formatMoney } from '@/shared/lib/format';

// Persian: "۱۵۰٬۰۰۰ تومان"
// English: "150,000 Toman"
formatMoney(150000);
```

### 2. Numbers
```tsx
import { formatNumber } from '@/shared/lib/format';

// Persian: "۱۲۳٬۴۵۶"
// English: "123,456"
formatNumber(123456);
```

### 3. Dates & Calendar
- In Persian (`fa`), dates format as **Jalali** (`fa-IR-u-ca-persian`).
- In English (`en`), dates format as **Gregorian**.
```tsx
import { formatDate, formatDateTime, formatRelative } from '@/shared/lib/format';

formatDate('2026-10-29T12:00:00Z');       // "۸ آبان ۱۴۰۵" or "Oct 29, 2026"
formatDateTime('2026-10-29T12:00:00Z');   // Includes hour:minute
formatRelative('2026-10-29T12:00:00Z');   // Relative time ("۲ ساعت پیش" / "2 hours ago")
```

### 4. Digit Normalization
All input forms must accept Persian and Arabic-Indic digits (`۰۱۲۳۴۵۶۷۸۹` / `٠١٢٣٤٥٦٧٨٩`) and normalize them to ASCII Latin digits before validation or API dispatch:
```tsx
import { normalizeDigits, normalizeToNumericString } from '@/shared/lib/format';

normalizeToNumericString('۰۹۱۲۳۴۵۶۷۸۹'); // => "09123456789"
```

---

## 5. RTL Layout Best Practices

1. **Logical Properties Only:**
   - Use `ms-*` (margin-inline-start) and `me-*` (margin-inline-end) instead of `ml-*` and `mr-*`.
   - Use `ps-*` and `pe-*` instead of `pl-*` and `pr-*`.
   - Use `start-*` and `end-*` instead of `left-*` and `right-*`.
   - Use `text-start` and `text-end` instead of `text-left` and `text-right`.

2. **Directional Form Inputs:**
   - Phone numbers, OTP codes, and monetary inputs should specify `dir="ltr"` and `className="text-start"` to maintain proper cursor and digit positioning inside RTL interfaces.

3. **Icons & Flipping:**
   - Directional navigation icons (back buttons, forward chevrons) automatically invert with direction when using `rtl:rotate-180` or logical arrow utilities.
   - Do **not** flip logos, phone numbers, or media controls.

---

## 6. How to Add a New Language

To add another language (for example, French `fr` or Arabic `ar`):

1. **Create Translation Files:**
   Create `frontend/src/locales/<lang>/` with `auth.json`, `common.json`, and `groups.json`.

2. **Register in i18n Configuration:**
   In `frontend/src/shared/lib/i18n.ts`:
   - Import the new JSON resources.
   - Add `<lang>` to `supportedLngs`.

3. **Update Direction & Locales:**
   In `frontend/src/shared/providers/LanguageProvider.tsx`:
   - Specify whether the new language is `'rtl'` (e.g. `ar`) or `'ltr'`.
   - Add the language code to `AppLocale` in `@/shared/lib/format/formatNumber.ts`.

4. **Add to Language Selector:**
   In `frontend/src/locales/*/common.json`, add the language name label under `"language"`.
   In `frontend/src/shared/components/LanguageSwitcher.tsx` and `ProfilePage.tsx`, add the option to the selector.
