# CodeAtlas backend container.
#
# NOTE: Render (and most platforms) builds with the Dockerfile's own
# directory as the build context, so all COPY paths are relative to this
# file's folder (back_end/), not the repo root.
#
# The backend keeps sessions and the SSE event bus in memory, so it MUST run
# as a single process (no uvicorn --workers > 1, no replicas) until sessions
# are moved to a shared store. Render health checks hit /healthz.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /codeatlas

# Keep the data_base layout identical to local development: the app resolves
# data_base as the repo-root parent of back_end/app/api/auth.py, i.e. /codeatlas.
COPY requirements.txt ./back_end/requirements.txt
RUN pip install --no-cache-dir -r back_end/requirements.txt

COPY app ./back_end/app

WORKDIR /codeatlas/back_end

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
