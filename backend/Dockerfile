# ANVESHAN backend — production image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

# Non-root runtime user. Writable locations for evidence objects, signing keys
# and backups are mounted as volumes by docker-compose.
RUN useradd --create-home --uid 10001 anveshan \
    && mkdir -p /data/uploads /data/keys /data/backups \
    && chown -R anveshan:anveshan /app /data
USER anveshan

ENV OBJECT_STORAGE_PROVIDER=local \
    OBJECT_STORAGE_DIR=/data/uploads \
    SIGNING_KEY_PATH=/data/keys/document-signing-key.pem \
    BACKUP_DIR=/data/backups

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
