# =========================================================================
# Dreampick — production Docker image for PandaStack
# =========================================================================
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000

# ---------- Install Node.js, npm, and build tools ----------
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg build-essential supervisor \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update && apt-get install -y --no-install-recommends nodejs \
 && npm install -g serve yarn \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Working directory ----------
WORKDIR /app

# ---------- Python dependencies ----------
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ---------- Frontend Build ----------
WORKDIR /app/frontend
# Copy package files and install using Yarn
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile

# Copy the rest of the frontend source
COPY frontend/ .
# Build the project using yarn. CI=false so eslint warnings don't fail the build
# in headless environments (CRA sets CI=true by default when no TTY).
RUN CI=false yarn build

# ---------- Supervisor config ----------
WORKDIR /app
RUN mkdir -p /etc/supervisor/conf.d /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ---------- Runtime ----------
EXPOSE 3000 8000
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]