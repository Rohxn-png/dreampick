# =========================================================================
# Dreampick — production Docker image for PandaStack
#
# Layout inside the container (mirrors the source repo):
#   /app
#   ├── backend/      FastAPI service  (Python 3.11)
#   ├── frontend/     React app        (built to frontend/build)
#   └── supervisord.conf
#
# Ports exposed: 8000 (FastAPI) and 3000 (static React served by `serve`)
# =========================================================================
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000

# ---------- System deps: Node.js 20.x, npm, supervisor, build tools ----------
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg build-essential supervisor \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update && apt-get install -y --no-install-recommends nodejs \
 && npm install -g serve \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Working directory ----------
WORKDIR /app

# ---------- Python dependencies (layer-cached) ----------
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ---------- Frontend build (layer-cached) ----------
COPY frontend/package.json frontend/package-lock.json* frontend/yarn.lock* ./frontend/
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps

# ---------- Copy the rest of the source ----------
WORKDIR /app
COPY . .

# ---------- Build the React production bundle ----------
WORKDIR /app/frontend
RUN npm run build

# ---------- Supervisor config ----------
WORKDIR /app
RUN mkdir -p /etc/supervisor/conf.d /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ---------- Runtime ----------
EXPOSE 3000 8000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
