# ═══════════════════════════════════════════════════════════════
# HamPool – Nginx image
#
# Stage 1: Build the React (Vite) frontend
# Stage 2: Serve the built SPA + reverse-proxy the Django API/WS
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build frontend ────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (better layer caching)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Nginx ─────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy the built frontend
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy the nginx configuration
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
