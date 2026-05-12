# Stage 1: Build dependencies
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN rm -rf /etc/apt/sources.list /etc/apt/sources.list.d/* && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian bookworm main" > /etc/apt/sources.list && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian bookworm-updates main" >> /etc/apt/sources.list && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian-security bookworm-security main" >> /etc/apt/sources.list

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Stage 2: Production/Development image
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN rm -rf /etc/apt/sources.list /etc/apt/sources.list.d/* && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian bookworm main" > /etc/apt/sources.list && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian bookworm-updates main" >> /etc/apt/sources.list && \
    echo "deb [trusted=yes check-valid-until=no] http://mirror-linux.runflare.com/debian-security bookworm-security main" >> /etc/apt/sources.list

# No runtime system packages needed for SQLite currently

# Copy installed Python packages from the builder stage
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Create static and media directories
RUN mkdir -p static media

EXPOSE 8000

# Use runserver for development
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
