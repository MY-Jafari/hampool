# API_SUMMARY — تحلیل کامل بک‌اند همپول (HamPool)

> این سند نتیجه‌ی تحلیل کد بک‌اند (Django 5.2 + DRF) است و مبنای طراحی فرانت‌اند قرار می‌گیرد.
> هر جا API با پرامپت اولیه تفاوت داشت، علامت «⚠️ نیاز به تایید» گذاشته شده است.

---

## ۱. اپ‌های بک‌اند و مسئولیت هرکدام

| اپ | مسئولیت |
|---|---|
| `apps/accounts` | کاربر سفارشی (ورود با شماره موبایل)، ثبت‌نام + تایید OTP، لاگین JWT، پروفایل |
| `apps/groups` | گروه‌ها (Pool)، عضویت، هزینه‌ها (۴ نوع تقسیم)، تسویه‌ها، بهینه‌سازی تسویه، موجودی‌ها (Balance)، لاگ فعالیت‌ها، QR دعوت، WebSocket اعلان گروه |
| `apps/ai` | پیشنهاد نام گروه با Google Gemini (`gemini-2.5-flash`) |
| `apps/outbox` | الگوی Outbox — رویدادها را داخل تراکنش ذخیره و پس از commit با Celery ارسال می‌کند |
| `apps/reports` | تولید گزارش PDF هفتگی (WeasyPrint + Matplotlib) و ارسال ایمیل؛ Celery Beat جمعه‌ها اجرا می‌کند |

**⚠️ تفاوت با پرامپت:** اپ «چت» وجود ندارد. WebSocket فقط **سرور → کلاینت** است (اعلان تغییر وضعیت گروه)، نه چت دوطرفه. اپ «اعلان‌ها» جدا هم وجود ندارد؛ اعلان‌ها فقط از طریق همین WebSocket به کلاینت می‌رسند و **هیچ ذخیره/خواندن/نخواندن سمت سرور ندارند**.

---

## ۲. مدل‌های دیتابیس

| مدل | فیلدهای کلیدی |
|---|---|
| `User` | `phone_number` (unique، الگوی `09\d{9}`)، `email`، `full_name`، `language` (fa/en)، `avatar`، `is_active` (تا تایید OTP غیرفعال) |
| `OTP` | `user` (OneToOne)، `secret` (TOTP)، `expires_at` (۲ دقیقه) |
| `Group` | `name`، `description`، `budget_limit` (تومان، ۰ = بی‌حد)، `invite_code` (۸ کاراکتری، ۴ روز اعتبار)، `created_by`، `owner`، `created_at` |
| `Membership` | `user`، `group`، `role` (`admin`/`member`)، `joined_at` |
| `Expense` | `group`، `paid_by`، `description`، `total_amount`، `split_type` (`equal`/`exact`/`percentage`/`itemized`)، `is_confirmed`، `receipt_image`، `receipt_expiry_date`، `date` |
| `ExpenseSplit` | `expense`، `user`، `amount`، `settled` |
| `ExpenseItem` / `ExpenseItemShare` | آیتم‌های هزینه‌ی itemized و سهم هر کاربر |
| `Settlement` | `group`، `from_user`، `to_user`، `amount`، `status` (`pending`/`confirmed`/`reversed`)، `created_by`، `confirmed_by`، `created_at`، `confirmed_at` |
| `Balance` | `user`، `group`، `amount` (نتیجه‌ی خالص؛ همیشه از داده‌ها بازمحاسبه می‌شود) |
| `ActivityLog` | `group`، `user`، `action`، `description`، `timestamp` |

**فرمول موجودی خالص (net):** `net = (paid − received) − (owed − sent)` — مثبت = طلبکار، منفی = بدهکار.

---

## ۳. اندپوینت‌های REST API

Base URL: `http://localhost:8000/api/v1/` — همه به‌جز auth با هدر `Authorization: Bearer <access>`.

### احراز هویت (`/accounts/`)

| متد | مسیر | توکن؟ | ورودی | خروجی |
|---|---|---|---|---|
| POST | `register/` | ❌ | `{phone_number, password, password_confirm}` (الگوی ۰۹xxxxxxxxx، رمزها یکسان) | `201` → `{detail, temp_token}` (توکن موقت ۵ دقیقه‌ای برای تایید OTP) |
| POST | `verify-otp/` | temp_token در هدر | `{code}` (۶ رقمی) | `200` → `{detail, access, refresh}` (کاربر فعال و لاگین می‌شود) |
| POST | `login/` | ❌ | `{phone_number, password}` | `200` → `{access, refresh}` |
| POST | `token/refresh/` | ❌ | `{refresh}` | `200` → `{access}` (و refresh جدید — ROTATE فعال است) |
| POST | `token/verify/` | ❌ | `{token}` | `200` |
| POST | `logout/` | ✅ | `{refresh}` | `205` (بلاک‌لیست) |
| GET/PATCH | `profile/` | ✅ | PATCH: `{full_name?, email?, language?, avatar?}` | `UserSerializer` |

> `UserSerializer` → `{id, phone_number, email, full_name, language, avatar, date_joined}`.

**⚠️ تفاوت با پرامپت:** جریان «فعال‌سازی 2FA با QR Code» و «کدهای بازیابی» در بک‌اند وجود ندارد. OTP فقط در **ثبت‌نام** استفاده می‌شود و کد TOTP در لاگ سرور (`logging` → console) چاپ می‌شود. «فراموشی رمز عبور» هم هیچ اندپوینتی ندارد.

### گروه‌ها (`/groups/`)

| متد | مسیر | توکن؟ | ورودی | خروجی |
|---|---|---|---|---|
| GET | `groups/` | ✅ | — | لیست گروه‌های کاربر (GroupSerializer) |
| POST | `groups/` | ✅ | `{name, description?, budget_limit?}` | `201` → گروه ساخته‌شده (سازنده = owner + admin، invite code ساخته می‌شود) |
| POST | `groups/join/` | ✅ | `{invite_code}` | `201` → `{detail}` |
| GET/PATCH/DELETE | `groups/{pk}/` | ✅ (عضو) | PATCH: `{name?, description?, budget_limit?}` | GroupSerializer |
| GET | `groups/{pk}/members/` | ✅ | — | لیست عضویت‌ها `{id, user, user_phone, user_name, role, joined_at}` |
| POST | `groups/{pk}/members/add/` | ✅ (admin) | `{phone_number}` | `201` → عضویت جدید |
| DELETE | `groups/{pk}/members/{user_id}/remove/` | ✅ | — | `200/204` |
| PATCH | `groups/{pk}/members/{user_id}/role/` | ✅ (admin) | `{role: "admin"|"member"}` | عضویت به‌روزشده |
| POST | `groups/{pk}/invite/` | ✅ (admin) | — | `{invite_code, expires_at}` (کد جدید) |
| GET | `groups/{pk}/qr-code/` | ✅ | — | تصویر PNG حاوی لینک دعوت (برای `<img>` نمی‌شود؛ باید با axios به‌صورت blob گرفت) |
| GET | `groups/{pk}/expenses/` | ✅ | — | لیست ExpenseDetailSerializer |
| POST | `groups/{pk}/expenses/` | ✅ | فرم هزینه (پایین) | `201` |
| GET/PATCH/DELETE | `groups/{pk}/expenses/{eid}/` | ✅ (پرداخت‌کننده یا admin) | PATCH: `{is_confirmed: true}` برای تایید | — |
| GET | `groups/{pk}/settlements/` | ✅ | — | لیست SettlementSerializer |
| POST | `groups/{pk}/settlements/` | ✅ | `{to_user_id, amount}` | `201` |
| POST | `groups/{pk}/settlements/{sid}/confirm/` | ✅ (فقط گیرنده) | — | `200` |
| POST | `groups/{pk}/settlements/{sid}/reverse/` | ✅ (دو طرف) | — | `200` |
| GET | `/api/v1/groups/{pk}/optimize-settlements/` ✅ | ✅ | — | `200` → `{balance_version: sha256, suggestions: [{from_user_id, to_user_id, amount}]}` |
| POST | `/api/v1/groups/{pk}/settlements/apply-optimization/` ✅ | ✅ | `{balance_version, suggestions}` | `201` → لیست Settlement ها · `409` → `{error}` |
| GET | `groups/{pk}/balances/` | ✅ | — | `[{phone_number, full_name, net}]` |
| GET | `groups/{pk}/activities/` | ✅ | — | `[{id, user, user_phone, action, description, timestamp}]` |
| POST | `groups/{pk}/report/` | ✅ | — | `202` → `{detail}` (تولید PDF و ارسال ایمیل با Celery؛ محدودیت ۳/ساعت) |

> ✅ **دو فیچر مهم که در بک‌اند واقعاً وجود دارند (تایید کاربر):**
> ۱. «پیشنهاد نام گروه با AI» → `POST /api/v1/groups/{pk}/suggest-name/` (کد: `apps/ai/views.py`)
> ۲. «پیشنهاد تسویه‌ی بهینه» → `GET /api/v1/groups/{pk}/optimize-settlements/` + اعمال با `POST /api/v1/groups/{pk}/settlements/apply-optimization/` (کد: `apps/groups/api/v1/views.py`)

### دستیار هوش مصنوعی — پیشنهاد نام گروه ✅ (فیچر واقعی)

| متد | مسیر کامل | توکن؟ | ورودی | خروجی |
|---|---|---|---|---|
| POST | `/api/v1/groups/{pk}/suggest-name/` | ✅ Bearer | — (بدون بدنه) | `200` → `{persian: [3 نام], english: [3 نام]}` · `503` → `{error}` وقتی AI در دسترس نیست |

> ✅ این فیچر **در بک‌اند پیاده‌سازی شده است** (کد: `apps/ai/urls.py` → `apps/ai/views.py` → `GeminiProvider` با مدل `gemini-2.5-flash`). پیشنهادها از روی ۱۰ هزینه‌ی آخر گروه تولید می‌شوند.
> ⚠️ این **چت‌بات گفت‌وگومحور نیست** — فقط خروجی نام پیشنهادی می‌دهد.

### فرم ایجاد هزینه

```jsonc
// equal — فقط user ها؛ سهم‌ها خودکار
{ "description": "شام", "total_amount": 100000, "split_type": "equal",
  "splits": [{"user": 2}, {"user": 3}] }

// exact
{ "description": "کرایه", "total_amount": 0, "split_type": "exact",
  "splits": [{"user": 2, "amount": 60000}, {"user": 3, "amount": 40000}] }
// (total_amount بعداً با مجموع سهم‌ها بازنویسی می‌شود)

// percentage — جمع درصدها باید دقیقاً ۱۰۰ باشد
{ "split_type": "percentage", "splits": [{"user": 2, "percentage": 60}, {"user": 3, "percentage": 40}] }

// itemized
{ "split_type": "itemized",
  "items": [{"name": "سوپرمارکت", "total_amount": 50000,
    "shares": [{"user": 2, "amount": 30000}, {"user": 3, "amount": 20000}]}] }

// اختیاری: receipt_image (multipart)، receipt_expiry_date (ISO datetime)
```

> ⚠️ نکته: `total_amount` برای نوع equal الزامی است (سرویس سهم‌ها را از روی آن می‌سازد).

---

## ۴. مکانیزم احراز هویت و جریان OTP

1. **ثبت‌نام:** `POST /register/` → کاربر **غیرفعال** ساخته می‌شود + رکورد OTP + `temp_token` (JWT با claim مخصوص `purpose=verify_otp`، ۵ دقیقه).
2. **تایید:** `POST /verify-otp/` با `Authorization: Bearer <temp_token>` و `{code}` → کاربر فعال + توکن‌های استاندارد.
3. **لاگین:** `POST /login/` با `{phone_number, password}` → `{access, refresh}`.
4. **توکن‌ها:** access = ۳۰ دقیقه، refresh = ۷ روز، `ROTATE_REFRESH_TOKENS=True` (هر refresh، refresh جدید می‌دهد و قبلی را بلاک می‌کند). خروج = بلاک‌لیست refresh.

> ⚠️ **نیاز به تایید:** در توسعه کد OTP در **کنسول بک‌اند** چاپ می‌شود (بدون SMS). پیشنهاد: در فرم OTP یک باکس راهنما برای توسعه‌دهنده نمایش دهیم.

---

## ۵. پروتکل WebSocket

> ❗ **این WebSocket چت/پیام‌رسانی نیست.** هیچ اندپوینت یا کانال چتی در بک‌اند وجود ندارد. این کانال فقط برای **اعلان‌های زنده‌ی تغییر وضعیت گروه** است (یک‌طرفه: سرور → کلاینت). فرانت هیچ پیامی از طریق WS نمی‌فرستد.

- **آدرس:** `ws://localhost:8000/ws/groups/{group_id}/?token=<access_token>` (توکن در query string).
- **جهت:** فقط سرور → کلاینت (اعلان فقط). هیچ پیام ورودی از کلاینت پذیرفته نمی‌شود و متد `receive` در consumer پیاده‌سازی نشده است (`apps/groups/consumers.py`).
- **پیام دریافتی:**
```json
{ "type": "group_state_changed", "group_id": 3,
  "event_type": "expense_created",
  "params": { "description": "شام", "amount": 100000, "payer": "09123456789" },
  "ts": "2026-08-21T10:00:00Z" }
```
- **event_type ها:** `group_created`، `member_joined`، `member_left`، `member_role_changed`، `expense_created`، `expense_confirmed`، `expense_deleted`، `settlement_created`، `settlement_confirmed`، `settlement_reversed`.
- کدهای بسته‌شدن: `4001` (ناتوکن/توکن نامعتبر)، `4003` (عضو نیست)، `4000` (خطا).
- سمت فرانت: ساخت متن فارسی اعلان از `event_type`/`params` + re-fetch داده‌های گروه بعد از هر رویداد (پیام‌ها best-effort هستند).

---

## ۶. فرمت خطاها

- فرمت استاندارد DRF: `{"field": ["پیام"]}` یا `{"detail": "پیام"}` برای خطاهای سطح بالا.
- برخی اندپوینت‌ها (مثل remove/role/settlement) از `{"error": "پیام"}` استفاده می‌کنند — کلاینت باید هر سه شکل را مدیریت کند.
- **Rate limiting:** `django-ratelimit` → خطای **403** (نه 429) با پیام پیش‌فرض. ترجمه‌ی انسانی: «درخواست زیاد؛ کمی صبر کنید». ثبت‌نام/tایید OTP: ۵/دقیقه/IP. گزارش: ۳/ساعت. Throttle عمومی DRF: anon 10/min، user 30/min.
- `409 Conflict` در apply-optimization: «موجودی‌ها تغییر کرده؛ دوباره محاسبه کنید».
- `503` در suggest-name: «AI در دسترس نیست».

---

## ۷. متغیرهای محیطی مرتبط با فرانت

| متغیر بک‌اند | ارتباط با فرانت |
|---|---|
| `DJANGO_ALLOWED_HOSTS` | host مجاز API |
| `CORS_*` | ⚠️ در `settings.py` هیچ تنظیم CORS وجود ندارد — فرانت توسعه با **Vite proxy** (بدون CORS) وصل می‌شود |
| `GEMINI_API_KEY` | پیشنهاد نام گروه |
| `EMAIL_BACKEND` | در dev = console؛ گزارش PDF در `media/test_reports/` هم ذخیره می‌شود |

> برای فرانت: `VITE_API_BASE_URL` (پیش‌فرض `/` با proxy در dev).

---

## ⚠️ خلاصه‌ی تفاوت‌های پرامپت اولیه با API واقعی (نیاز به تایید)

1. **چت گروهی:** وجود ندارد — فقط اعلان‌های لحظه‌ای WS (یک‌طرفه، سرور → کلاینت). (پیشنهاد: حذف صفحه چت؛ مرکز اعلان زنده بسازیم)
2. **2FA با QR / کد بازیابی:** وجود ندارد — OTP فقط در ثبت‌نام، بدون QR. (پیشنهاد: جریان ۲ مرحله‌ای ثبت‌نام با کد OTP)
3. **فراموشی رمز:** اندپوینتی ندارد. (پیشنهاد: حذف)
4. **دستیار AI چت‌بات:** فقط پیشنهاد نام گروه. (پیشنهاد: ویجت پیشنهاد نام هوشمند در ساخت/ویرایش گروه)
5. **گزارش PDF:** دانلودی در کار نیست؛ درخواست → ارسال ایمیل. نمودارها را فرانت از داده‌ی هزینه‌ها با Recharts می‌سازد.
6. **مرکز اعلان:** بدون ذخیره‌سازی سمت سرور؛ اعلان‌ها در حافظه‌ی کلاینت (در طول نشست) + لاگ فعالیت‌ها از `activities/`.
