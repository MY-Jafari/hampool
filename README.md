<div dir="rtl">

<h1 align="center">💰 همپول — پلتفرم مدیریت هزینه</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/Django_REST_Framework-red?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" />
</p>

---

## 🌊 درباره پروژه

**همپول** یک بک‌اند کامل و حرفه‌ای برای مدیریت هزینه‌های مشترک است. این پروژه با **Django** و **Django REST Framework** ساخته شده و طیف گسترده‌ای از ویژگی‌ها از جمله احراز هویت دو مرحله‌ای، پرداخت آنلاین، پیام‌رسانی لحظه‌ای، تولید گزارش PDF، و دستیار هوش مصنوعی مبتنی بر Gemini را پوشش می‌دهد.

این پروژه با معماری ماژولار طراحی شده؛ هر بخش (اپلیکیشن) وظیفه مشخصی دارد و کل سیستم با **Docker** کانتینرایز شده است.

---

## ✨ ویژگی‌های اصلی

| ویژگی | توضیح |
|-------|-------|
| 🔐 احراز هویت | JWT + احراز هویت دو مرحله‌ای (OTP) با QR Code |
| 💬 چت آنی | پیام‌رسانی لحظه‌ای با WebSocket (Django Channels) |
| 📊 گزارش‌گیری | تولید PDF و نمودار با WeasyPrint و Matplotlib |
| 🤖 دستیار AI | چت‌بات هوشمند با Google Gemini |
| 📧 اعلان‌ها | ایمیل قالب‌دار + اعلان‌های لحظه‌ای |
| ⏱️ وظایف زمان‌بندی | Celery Worker و Celery Beat برای کارهای پس‌زمینه |
| 🚦 محدودیت نرخ | Rate Limiting برای امنیت API |
| 🐳 داکر کامل | محیط توسعه و پروداکشن با Docker Compose |

---

## 🗂️ ساختار پروژه

```
hampool/
├── apps/                     # Django applications (various modules)
├── core/                              # Basic settings, ASGI, Celery
├── nginx/                     # Nginx configuration (for production)
├── docker-compose.yml                      # Development environment
├── docker-compose.prod.yml                  # Production environment
├── Dockerfile                                           # DockerFile
└── requirements.txt                                   # requirements
```

---

## 🚀 راه‌اندازی سریع

> پیش‌نیاز: **Docker** و **Docker Compose** نصب باشند.

```bash
# ۱. کپی مخزن
git clone https://github.com/MY-Jafari/hampool.git
cd hampool

# ۲. ساخت فایل محیطی
cp .env.example .env
# سپس فایل .env را با مقادیر واقعی پر کنید

# ۳. اجرای محیط توسعه
docker compose up --build

# ۴. اجرای مایگریشن‌ها
docker compose exec django python manage.py migrate

# ۵. ساخت سوپریوزر (اختیاری)
docker compose exec django python manage.py createsuperuser
```

برنامه روی `http://localhost:8000` در دسترس خواهد بود.

### 🏭 اجرا در پروداکشن

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

محیط پروداکشن شامل: **PostgreSQL**, **Nginx**, **Gunicorn**, **Flower** برای مانیتورینگ Celery.

---

## 🔧 متغیرهای محیطی

فایل `.env.example` را کپی کرده و مقادیر زیر را تنظیم کنید:

```env
DJANGO_SECRET_KEY=...
DJANGO_DEBUG=True
DATABASE_ENGINE=django.db.backends.sqlite3  # یا PostgreSQL در پروداکشن
REDIS_HOST=redis
CELERY_BROKER_URL=redis://redis:6379/0
GEMINI_API_KEY=...         # کلید API هوش مصنوعی Gemini
EMAIL_BACKEND=...
```

---

## 🧪 تست‌ها

```bash
docker compose exec django pytest --cov
```

پروژه از **pytest** و **pytest-django** استفاده می‌کند و پوشش کد با `pytest-cov` اندازه‌گیری می‌شود.

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

این پروژه تحت لایسنس **MIT** منتشر شده است.

</div>

---
---

<div dir="ltr">

<h1 align="center">💰 HamPool — Expense Management Platform</h1>

<p align="center">
  A full-featured, production-ready backend for shared expense management — built with <strong>Django</strong>, <strong>Django REST Framework</strong>, <strong>WebSockets</strong>, <strong>Celery</strong>, and <strong>Google Gemini AI</strong>.
</p>

---

## 🌊 About

**HamPool** is a robust, modular REST API backend built with **Django** and **Django REST Framework**. It handles everything from user authentication and subscription management to real-time chat, AI assistance, and automated PDF reporting — all containerized with Docker for easy deployment anywhere.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔐 **Auth & Security** | JWT authentication + Two-Factor Authentication (OTP) via QR Code |
| 💬 **Real-Time Chat** | Instant messaging via WebSocket (Django Channels + Redis) |
| 📊 **Reporting** | PDF generation and charts with WeasyPrint & Matplotlib |
| 🤖 **AI Assistant** | Smart chatbot powered by Google Gemini (gemini-2.5-flash) |
| 📧 **Notifications** | Templated email + real-time push notifications |
| ⏱️ **Task Queue** | Celery Worker & Beat for background and scheduled jobs |
| 🚦 **Rate Limiting** | Built-in API rate limiting for security |
| 🐳 **Fully Dockerized** | Separate dev & production Docker Compose setups |

---

## 🏗️ Architecture Overview

```
hampool/
├── apps/               # Django applications (modular features)
├── core/               # Settings, ASGI config, Celery
├── nginx/              # Nginx config for production
├── .env.example        # Environment variable template
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production environment
├── Dockerfile
└── requirements.txt
```

**Services in production:**

| Service | Role |
|---------|------|
| `django` | App server (Gunicorn + Uvicorn workers) |
| `db` | PostgreSQL 16 database |
| `redis` | Message broker + cache |
| `celery_worker` | Background task processing |
| `celery_beat` | Scheduled task runner |
| `nginx` | Reverse proxy + static file serving |
| `flower` | Celery monitoring dashboard |

---

## 🚀 Quick Start

> **Prerequisites:** Docker & Docker Compose installed.

```bash
# 1. Clone the repository
git clone https://github.com/MY-Jafari/hampool.git
cd hampool

# 2. Set up environment variables
cp .env.example .env
# Edit .env and fill in your values

# 3. Start development environment
docker compose up --build

# 4. Run database migrations
docker compose exec django python manage.py migrate

# 5. Create a superuser (optional)
docker compose exec django python manage.py createsuperuser
```

The API will be available at **`http://localhost:8000`**.  
Swagger docs: **`http://localhost:8000/swagger/`**

### 🏭 Production Deployment

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The production stack adds PostgreSQL, Nginx, Gunicorn with multiple workers, and Flower at port `5555` for monitoring.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Django
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com

# Database (SQLite for dev / PostgreSQL for prod)
DATABASE_ENGINE=django.db.backends.sqlite3

# Redis & Celery
REDIS_HOST=redis
CELERY_BROKER_URL=redis://redis:6379/0

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_AI_MODEL=gemini-2.5-flash
```

---

## 🧪 Running Tests

```bash
docker compose exec django pytest --cov
```

The project uses **pytest** + **pytest-django** with coverage reports via **pytest-cov**.  
Code style is enforced by **Black** and **Flake8**.

---

## 🛠️ Tech Stack

<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Django_5.2-092E20?style=flat-square&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/DRF-red?style=flat-square&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Celery-37814A?style=flat-square&logo=celery&logoColor=white" />
  <img src="https://img.shields.io/badge/Django_Channels-WebSocket-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white" />
  <img src="https://img.shields.io/badge/Gunicorn-499848?style=flat-square&logo=gunicorn&logoColor=white" />
  <img src="https://img.shields.io/badge/WeasyPrint-PDF-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white" />
</p>

---

## 👨‍💻 Author

<p align="left">
  <a href="https://github.com/MY-Jafari">
    <img src="https://img.shields.io/badge/GitHub-MY--Jafari-181717?style=for-the-badge&logo=github" />
  </a>
  &nbsp;
  <a href="https://www.linkedin.com/in/mohammadyasin-jafari-422706378">
    <img src="https://img.shields.io/badge/LinkedIn-MohammadYasin_Jafari-0A66C2?style=for-the-badge&logo=linkedin" />
  </a>
</p>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

</div>
