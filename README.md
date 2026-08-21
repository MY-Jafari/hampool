<div dir="rtl">

<h1 align="center">💰 هم‌پول (HamPool) — مدیریت هزینه‌های مشترک</h1>

<p align="center">
  پلتفرم کامل مدیریت هزینه‌های مشترک بین دوستان، خانواده و هم‌سفرها — بک‌اند Django REST + فرانت‌اند React، با تسویه‌ی هوشمند و اعلان‌های لحظه‌ای.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Django_REST_Framework-red?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-211%20passed-10B981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" />
</p>

---

## 🖼️ پیش‌نمایش

<p align="center">
  <img src="screenshots/dashboard.png" alt="داشبورد هم‌پول" width="340" />
  <br />
  <sub><b>داشبورد</b> — طلب/بدهی من، گروه‌ها و آخرین هزینه‌ها</sub>
</p>

<p align="center">
  <img src="screenshots/groups.png" alt="لیست گروه‌ها" width="340" />
  <br />
  <sub><b>گروه‌ها</b> — لیست گروه‌های من، ساخت گروه جدید و عضویت با کد دعوت</sub>
</p>

<p align="center">
  <img src="screenshots/group-detail.png" alt="جزئیات گروه" width="340" />
  <br />
  <sub><b>جزئیات گروه</b> — بودجه، موجودی اعضا و ۶ تب (هزینه‌ها، تسویه‌ها، اعضا، فعالیت‌ها، گزارش‌ها)</sub>
</p>

<p align="center">
  <img src="screenshots/login.png" alt="صفحه ورود" width="340" />
  <br />
  <sub><b>ورود</b> — ورود با شماره موبایل و رمز عبور</sub>
</p>

---

## 🌊 درباره پروژه

**هم‌پول** به گروهی از افراد کمک می‌کند هزینه‌های مشترک را ثبت، تقسیم و تسویه کنند:

- **یک نفر هزینه را ثبت می‌کند** (مثلاً شام رستوران، تاکسی، خرید گروهی) و دیگران را شریک می‌کند.
- هزینه به ۴ روش قابل تقسیم است: **مساوی، مبلغ دقیق، درصدی، آیتمی**.
- سیستم به‌صورت خودکار **موجودی (بالانس)** هر عضو را حساب می‌کند: چه‌کسی چقدر طلب دارد و چه‌کسی چقدر بدهکار است.
- با دکمه‌ی «پیشنهاد تسویه بهینه»، الگوریتم کمترین تعداد پرداخت برای صاف‌کردن همه‌ی بدهی‌ها را پیشنهاد می‌دهد.
- همه‌ی رویدادها (ثبت هزینه، تایید، تسویه، عضویت و...) به‌صورت **زنده از طریق WebSocket** به اعضا اعلان می‌شود.
- گزارش هفتگی PDF به‌صورت خودکار تولید و ایمیل می‌شود.

### معماری

<div dir="ltr">

```text
┌─────────────┐            ┌─────────────────────────────────────────┐
│   Browser   │  :80 ────► │  Nginx (reverse proxy + SPA)           │
│  (SPA)      │  ◄──────── │  nginx/default.conf                    │
└─────────────┘            └──────┬──────────────────┬─────────────┘
                                  │ /api /ws /media   │ /static /media
                                  ▼                   ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Django REST (uvicorn)   │   │  PostgreSQL 16 (db)              │
│  apps/accounts           │   └──────────────────────────────────┘
│  apps/groups             │
│  apps/ai · apps/reports   │   ┌──────────────────────────────────┐
└───────────┬──────────────┘   │  Redis 7 (cache + broker)        │
            │ Outbox pattern   └──────────────┬───────────────────┘
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Celery Worker + Beat (reports, outbox, notifications)      │
│  Flower (monitoring) → http://localhost:5555                │
└─────────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ ویژگی‌های اصلی

| دسته | جزئیات |
|------|--------|
| 🔐 **احراز هویت** | ثبت‌نام با شماره موبایل + کد OTP (۶ رقمی TOTP) · ورود با JWT (Access/Refresh) · بلاک‌لیست refresh پس از خروج · محدودیت نرخ (rate limiting) |
| 👥 **گروه‌ها** | ساخت گروه با بودجه · کد دعوت ۸ کاراکتری با انقضا · عضویت با کد · QR کد دعوت · نقش‌ها (admin/member) · انتقال مالکیت |
| 💸 **هزینه‌ها** | ۴ نوع تقسیم: **مساوی / مبلغ دقیق / درصدی / آیتمی** · تایید و حذف · جلوگیری از ویرایش هزینه‌ی تاییدشده |
| 📊 **بالانس و تسویه** | محاسبه‌ی خودکار طلب/بدهی هر عضو · تسویه‌ی دوجانبه (ایجاد/تایید/ابطال) · **پیشنهاد تسویه بهینه** (حداقل تعداد پرداخت) با محافظت از داده‌ی قدیمی (balance_version) |
| 🔔 **اعلان‌های زنده** | WebSocket یک‌طرفه (Django Channels + Redis) — رویدادهای group_state_changed به‌صورت real-time + Outbox pattern برای تحویل اطمینان‌پذیر |
| 📄 **گزارش PDF** | گزارش هفتگی خودکار (WeasyPrint + Matplotlib) به‌صورت ایمیل · درخواست گزارش دستی از API |
| 🤖 **دستیار هوش مصنوعی** | «پیشنهاد نام گروه» با Google Gemini — ۳ نام فارسی + ۳ نام انگلیسی بر اساس هزینه‌های گروه |
| 📝 **فعالیت‌ها** | لاگ کامل رویدادهای گروه با زمان‌بندی |
| ⏱️ **وظایف پس‌زمینه** | Celery Worker + Celery Beat برای گزارش‌ها و Outbox · پایش با Flower |
| 🐳 **داکر کامل** | محیط توسعه و پروداکشن (PostgreSQL + Nginx + Flower) |

---

## 🛠️ استک فنی

### بک‌اند (`apps/`)

| فناوری | کاربرد |
|--------|--------|
| Python 3.12 · Django 5.2 · DRF | چارچوب اصلی |
| SimpleJWT + pyotp | احراز هویت و OTP |
| Django Channels + Redis | WebSocket و Channel Layer |
| Celery + Celery Beat | وظایف پس‌زمینه و زمان‌بندی |
| Flower | داشبورد پایش Celery (tasks، queues، workers) |
| Nginx | ریورس‌پروکسی + سرو فرانت‌اند SPA و فایل‌های static/media |
| WeasyPrint + Matplotlib | تولید گزارش PDF و نمودار |
| google-generativeai | پیشنهاد نام گروه با Gemini |
| django-ratelimit | محدودیت نرخ |
| pytest + pytest-django | تست (۲۱۱ تست) |

### فرانت‌اند (`frontend/`)

| فناوری | کاربرد |
|--------|--------|
| React 18 · Vite · TypeScript (strict) | چارچوب اصلی |
| TailwindCSS + shadcn/ui (Radix) | طراحی دارک، راست‌چین، موبایل‌فرست |
| TanStack Query · Axios | مدیریت داده و JWT interceptor با refresh خودکار |
| Zustand | استور (auth، اعلان‌ها) |
| React Hook Form + Zod | فرم‌ها |
| Recharts | نمودارهای گزارش‌ها |
| WebSocket manager | اتصال زنده با reconnect خودکار |
| Vazirmatn · lucide-react | فونت فارسی و آیکون‌ها |

---

## 🗂️ ساختار پروژه

<div dir="ltr">

```text
hampool/
├── apps/                        # Django apps
│   ├── accounts/                #   کاربر، OTP، JWT
│   ├── groups/                  #   گروه، عضو، هزینه، تسویه، بالانس، فعالیت
│   │   ├── api/v1/              #     DRF views + serializers
│   │   ├── services.py          #     لاجیک مالی (تقسیم، تسویه، بهینه‌سازی)
│   │   ├── consumers.py         #     WebSocket consumer
│   │   └── ws_handlers.py       #     انتشار رویدادها به Channel Layer
│   ├── ai/                      #   پیشنهاد نام با Gemini
│   ├── reports/                 #   گزارش هفتگی PDF (Celery task)
│   └── outbox/                  #   Outbox pattern (رویدادهای تراکنشی)
├── core/                        # تنظیمات، ASGI، Celery
├── frontend/                    # فرانت‌اند React (RTL فارسی)
│   ├── src/
│   │   ├── app/                 #   router، providers، layout
│   │   ├── features/            #   auth، dashboard، groups، notifications
│   │   └── shared/              #   UI primitives، hooks، lib، types
│   ├── API_SUMMARY.md           #   تحلیل کامل بک‌اند
│   └── WIREFRAMES.md            #   وایرفریم صفحات
├── screenshots/                 # اسکرین‌شات‌های فرانت‌اند
├── nginx/
│   ├── default.conf             #   ریورس‌پروکسی + سرو SPA
│   └── Dockerfile               #   بیلد فرانت‌اند + Nginx
├── docker-compose.yml           # ۷ سرویس: db، redis، django، celery، flower، nginx
├── docker-compose.prod.yml      # نسخه‌ی پروداکشن (Gunicorn + ایمج‌های بیلدشده)
├── Dockerfile                   # ایمج پایتون (django/celery/flower)
├── .flake8                      # کانفیگ lint (max-line-length=100)
└── requirements.txt
```

</div>

---

## 🚀 راه‌اندازی سریع

> پیش‌نیاز: **Docker** و **Docker Compose** نصب باشند. (پورت ۸۰۰۰ آزاد)

<div dir="ltr">

```bash
# ۱. کلون و ورود به پروژه
git clone <your-repo-url> hampool
cd hampool

# ۲. ساخت فایل محیطی
cp .env.example .env
#   (در .env مقدار FLOWER_PASSWORD و POSTGRES_PASSWORD را عوض کنید)

# ۳. اجرای کل محیط توسعه (db + Redis + Django + Celery + Nginx + Flower)
docker compose up --build

# ۴. در ترمینال دوم — اجرای مایگریشن‌ها
docker compose exec django python manage.py migrate

# ۵. (اختیاری) ساخت سوپریوزر
docker compose exec django python manage.py createsuperuser
```

### اجرای نسخه‌ی پروداکشن

<div dir="ltr">

```bash
# استک پروداکشن: Gunicorn + ایمج‌های بیلدشده + SPA از طریق Nginx
# (پورت‌های db/redis در معرض هاست نیستند؛ Flower با basic-auth محافظت می‌شود)
docker compose -f docker-compose.prod.yml up -d --build

# مایگریشن و جمع‌آوری فایل‌های استاتیک
docker compose -f docker-compose.prod.yml exec django python manage.py migrate
docker compose -f docker-compose.prod.yml exec django python manage.py collectstatic --noinput
```

</div>

</div>

پس از بالا آمدن:

| سرویس | آدرس |
|-------|------|
| 🌐 فرانت‌اند (SPA) | `http://localhost/` |
| API بک‌اند | `http://localhost:8000` (مستقیم) · `http://localhost/api/` (از طریق Nginx) |
| مستندات Swagger | `http://localhost:8000/swagger/` |
| Redoc | `http://localhost:8000/redoc/` |
| 🌸 Flower (پایش Celery) | `http://localhost:5555` (ورود: `FLOWER_USER`/`FLOWER_PASSWORD` از `.env`) |
| وضعیت سرویس | `http://localhost/health/` |
| PostgreSQL | `localhost:5432` |

### اجرای فرانت‌اند (اختیاری)

<div dir="ltr">

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

</div>

> Vite به‌صورت خودکار `/api` و `/ws` را به بک‌اند (پورت ۸۰۰۰) پروکسی می‌کند؛ بدون نیاز به تنظیم CORS.

---

## 🔧 متغیرهای محیطی

فایل `.env.example` را به `.env` کپی کنید و مقادیر لازم را پر کنید:

<div dir="ltr">

| متغیر | پیش‌فرض | توضیح |
|-------|---------|-------|
| `DJANGO_SECRET_KEY` | — (الزامی) | کلید امنیتی Django — حتماً مقدار تصادفی بدهید |
| `DJANGO_DEBUG` | `True` | در پروداکشن `False` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | هاست‌های مجاز |
| `DATABASE_ENGINE` | `django.db.backends.sqlite3` | SQLite برای توسعه / PostgreSQL برای پروداکشن |
| `DATABASE_NAME` | `db.sqlite3` | نام دیتابیس SQLite |
| `POSTGRES_DB/USER/PASSWORD/HOST/PORT` | — | برای پروداکشن (PostgreSQL) |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | آدرس Redis |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | بروکر Celery |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/0` | بک‌اند نتیجه |
| `EMAIL_BACKEND` | `console.EmailBackend` | در توسعه در کنسول چاپ می‌شود / SMTP برای پروداکشن |
| `EMAIL_HOST` و هم‌خانواده‌ها | — | تنظیمات SMTP (پروداکشن) |
| `GEMINI_API_KEY` | — | کلید Gemini برای پیشنهاد نام گروه (اختیاری) |
| `GEMINI_AI_MODEL` | `gemini-2.5-flash` | مدل Gemini |

</div>

> ⚠️ در محیط توسعه، **کد OTP در کنسول بک‌اند چاپ می‌شود** (هیچ SMS ای ارسال نمی‌شود).

---

## 📚 مستندات API

مستندات تعاملی: **`http://localhost:8000/swagger/`** (drf-yasg)

تحلیل کامل همه‌ی اندپوینت‌ها (ورودی/خروجی، خطاها، پروتکل WebSocket): [`frontend/API_SUMMARY.md`](frontend/API_SUMMARY.md)

### نمونه‌ی درخواست‌ها (با curl)

**ثبت‌نام (دریافت temp_token برای OTP):**

<div dir="ltr">

```bash
curl -X POST http://localhost:8000/api/v1/accounts/register/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "09123456789", "password": "Strong@Pass1", "password_confirm": "Strong@Pass1"}'
```

</div>

**ورود:**

<div dir="ltr">

```bash
curl -X POST http://localhost:8000/api/v1/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "09123456789", "password": "Strong@Pass1"}'
# → {"access": "...", "refresh": "..."}
```

</div>

**ساخت گروه:**

<div dir="ltr">

```bash
curl -X POST http://localhost:8000/api/v1/groups/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "گروه سفر", "budget_limit": 5000000}'
```

</div>

**ثبت هزینه‌ی مساوی:**

<div dir="ltr">

```bash
curl -X POST http://localhost:8000/api/v1/groups/1/expenses/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"description": "شام رستوران", "total_amount": 300000,
       "split_type": "equal",
       "splits": [{"user": 1}, {"user": 2}]}'
```

</div>

**پیشنهاد تسویه بهینه:**

<div dir="ltr">

```bash
curl http://localhost:8000/api/v1/groups/1/optimize-settlements/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
# → {"balance_version": "<sha256>", "suggestions": [{"from_user_id": 2, "to_user_id": 1, "amount": 150000}]}
```

</div>

**اندپوینت‌های اصلی:**

<div dir="ltr">

| متد | مسیر | توضیح |
|-----|------|-------|
| POST | `/api/v1/accounts/register/` | ثبت‌نام + ارسال OTP |
| POST | `/api/v1/accounts/verify-otp/` | تایید OTP → دریافت توکن |
| POST | `/api/v1/accounts/login/` | ورود با شماره و رمز |
| GET/PATCH | `/api/v1/accounts/profile/` | پروفایل |
| GET/POST | `/api/v1/groups/` | لیست / ساخت گروه |
| POST | `/api/v1/groups/join/` | عضویت با کد دعوت |
| GET | `/api/v1/groups/{id}/balances/` | بالانس همه‌ی اعضا |
| POST | `/api/v1/groups/{id}/expenses/` | ثبت هزینه (۴ نوع تقسیم) |
| PATCH | `/api/v1/groups/{id}/expenses/{eid}/` | تایید هزینه (`is_confirmed: true`) |
| POST | `/api/v1/groups/{id}/settlements/` | ثبت تسویه |
| POST | `/api/v1/groups/{id}/settlements/{sid}/confirm/` | تایید تسویه (فقط گیرنده) |
| POST | `/api/v1/groups/{id}/settlements/{sid}/reverse/` | ابطال تسویه |
| GET | `/api/v1/groups/{id}/optimize-settlements/` | پیشنهاد تسویه بهینه |
| POST | `/api/v1/groups/{id}/settlements/apply-optimization/` | اعمال پیشنهاد |
| POST | `/api/v1/groups/{id}/report/` | درخواست گزارش PDF (ایمیلی) |
| GET | `/api/v1/groups/{id}/qr-code/` | QR کد دعوت (PNG) |
| POST | `/api/v1/groups/{id}/suggest-name/` | پیشنهاد نام گروه با AI |

</div>

### WebSocket (اعلان زنده)

<div dir="ltr">

```text
ws://localhost:8000/ws/groups/<group_id>/?token=<ACCESS_TOKEN>
```

</div>

پیام‌های دریافتی (فقط **سرور → کلاینت**، یک‌طرفه):

<div dir="ltr">

```json
{
  "type": "group_state_changed",
  "group_id": 1,
  "event_type": "expense_confirmed",
  "params": {"description": "شام", "amount": 300000},
  "ts": "2026-08-21T12:00:00+00:00"
}
```

</div>

نوع رویدادها: `group_created` · `member_joined` · `member_left` · `expense_created` · `expense_confirmed` · `expense_deleted` · `settlement_created` · `settlement_confirmed` · `settlement_reversed`

> این کانال **چت نیست** — فقط اعلانِ تغییر وضعیت گروه است.

---

## 🗄️ دیاگرام دیتابیس (مختصر)

<div dir="ltr">

```text
User ──┬── 1:N ── Group (created_by / owner)
       └── 1:N ── Membership (user, group, role)
                  └── 1:N ── Expense (paid_by, split_type, is_confirmed)
                               ├── 1:N ── ExpenseSplit (user, amount, settled)
                               └── 1:N ── ExpenseItem ── 1:N ── ExpenseItemShare
                  └── 1:N ── Settlement (from_user, to_user, amount, status, reversed_by)
                  └── 1:N ── Balance (user, group, amount)   ← materialized، net طلب/بدهی
                  └── 1:N ── ActivityLog (action, description, timestamp)
User ── 1:1 ── OTP (secret, expires_at)
OutboxEvent (event_type, payload JSON, status: pending→processing→dispatched/failed)
```

</div>

---

## 🧪 تست‌ها

پروژه از **pytest** + **pytest-django** استفاده می‌کند — **۲۱۱ تست، همه‌ی اپ‌ها**:

<div dir="ltr">

```bash
# همه‌ی تست‌ها (داخل کانتینر)
docker compose exec django python -m pytest

# فقط یک اپ
docker compose exec django python -m pytest apps/groups

# با جزئیات
docker compose exec django python -m pytest -v
```

</div>

پوشش تست‌ها:

| اپ | پوشش |
|----|------|
| accounts | ثبت‌نام، OTP، ورود، refresh، خروج، پروفایل، مدل User/OTP |
| groups | CRUD، اعضا/نقش‌ها، دعوت/QR، هزینه (۴ تقسیم)، تسویه/بهینه‌سازی، بالانس، فعالیت‌ها، مدل‌ها، WebSocket handlers |
| ai | پیشنهاد نام + GeminiProvider (با mock) |
| outbox | مدل، رجیستری handler، سرویس، task ها |
| reports | تولید PDF (با mock)، زمان‌بندی هفتگی |

### لینت بک‌اند

<div dir="ltr">

```bash
docker compose exec django python -m flake8
```

</div>

### فرانت‌اند — تایپ‌چک، لینت، بیلد

<div dir="ltr">

```bash
cd frontend
npx tsc -b && npm run lint && npm run build
```

</div>

---

## 🤝 مشارکت (Contributing)

1. از شاخه‌ی `main` یک شاخه‌ی جدید بزنید: `git checkout -b feature/your-feature`
2. تغییرات را پیاده کنید و مطمئن شوید تست‌ها سبزند:
   <div dir="ltr">

   ```bash
   docker compose exec django python -m pytest
   cd frontend && npm run lint && npm run build
   ```

   </div>
3. کامیت با پیام واضح (ترجیحاً انگلیسی، فرمت Conventional Commits)
4. Pull Request بسازید و تغییر را توضیح دهید

---

## 🗺️ نقشه‌راه (Roadmap)

ویژگی‌هایی که **هنوز پیاده نشده‌اند** (در کد وجود ندارند):

- [ ] **چت گروهی** — فعلاً WebSocket فقط اعلان یک‌طرفه است
- [ ] **2FA با QR / کد بازیابی** — فعلاً OTP فقط در ثبت‌نام است (کد در کنسول چاپ می‌شود)
- [ ] **فراموشی رمز عبور** — اندپوینت بازیابی رمز وجود ندارد
- [ ] **آپلود رسید** (تصویر فاکتور برای هزینه‌ها)
- [ ] **اعلان‌های ذخیره‌شده سمت سرور** — فعلاً اعلان‌ها فقط در نشست مرورگر می‌مانند
- [ ] **پرداخت آنلاین** — اتصال به درگاه پرداخت
- [ ] **تست‌های فرانت‌اند** (Vitest / Playwright)

---

## ❓ عیب‌یابی (Troubleshooting)

| مشکل | راه‌حل |
|------|--------|
| **پورت ۸۰۰۰ اشغال است** | `docker compose stop` و سرویس دیگری را که روی ۸۰۰۰ است متوقف کنید |
| **خطای اتصال به دیتابیس (`could not translate host name "db"`)** | سرویس `db` را با `docker compose up -d db` بالا بیاورید — PostgreSQL بخشی از استک است |
| **خطای مایگریشن / جدول پیدا نشد** | `docker compose exec django python manage.py migrate` |
| **پیام‌های WebSocket نمی‌رسند** | مطمئن شوید Redis و Celery بالا هستند (`docker compose ps`) — Outbox توسط Celery dispatch می‌شود |
| **ثبت گروه/هزینه با خطای ۵۰۰** | بدون Celery/Redis کار نمی‌کند (Outbox) — ابتدا آن‌ها را اجرا کنید |
| **داشبورد Flower نمی‌آید** | `docker compose logs flower` — ورود با `FLOWER_USER`/`FLOWER_PASSWORD` (پیش‌فرض: admin/admin) |
| **صفحه فرانت‌اند باز نمی‌شود** | Nginx باید روی پورت ۸۰ باشد: `docker compose up -d nginx` |
| **کد OTP کجاست؟** | در کنسول بک‌اند چاپ می‌شود (`docker compose logs django`) |
| **AI نام پیشنهاد نمی‌دهد** | `GEMINI_API_KEY` را در `.env` تنظیم کنید |
| **فرانت‌اند به API وصل نمی‌شود** | بک‌اند روی ۸۰۰۰ بالا باشد؛ `VITE_PROXY_TARGET` را بررسی کنید |
| **خطای `version is obsolete` در compose** | بی‌خطر است — فقط یک اخطار است |

---

## 👨‍💻 توسعه‌دهنده

<p align="center">
  <a href="https://github.com/MY-Jafari">
    <img src="https://img.shields.io/badge/GitHub-MY--Jafari-181717?style=for-the-badge&logo=github" />
  </a>
  &nbsp;
  <a href="https://www.linkedin.com/in/mohammadyasin-jafari-422706378">
    <img src="https://img.shields.io/badge/LinkedIn-MohammadYasin_Jafari-0A66C2?style=for-the-badge&logo=linkedin" />
  </a>
</p>

---

## 📄 لایسنس

این پروژه تحت لایسنس **MIT** منتشر شده است — فایل [LICENSE](LICENSE) را ببینید.

</div>
