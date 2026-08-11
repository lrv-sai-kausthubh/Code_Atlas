from pathlib import Path
import os

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def _load_env_file() -> None:
    """Load BACKEND/.env into the process environment if present."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(env_file)
    except ImportError:
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_file()

from app.api.auth import router as auth_router
from app.api.aura import router as aura_router
from app.api.routes import router
from app.services import store
from app.services.events import bus


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create DB tables when running on PostgreSQL, then capture the running
    event loop so worker threads can publish live events."""
    store.init()
    bus.attach_loop(asyncio.get_running_loop())
    yield
    # Close any open SSE streams so uvicorn shuts down instead of waiting for
    # browser connections that stay open indefinitely.
    bus.shutdown()
    bus.attach_loop(None)


app = FastAPI(title="CodeAtlas API", lifespan=lifespan)

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("codeatlas")
logger.info(
    "CodeAtlas backend ready. FRONTEND_URL=%r BACKEND_BASE=%r GITHUB_OAuth_configured=%s",
    os.environ.get("FRONTEND_URL", "http://localhost:5173"),
    os.environ.get("BACKEND_BASE", "http://localhost:8000"),
    bool(os.environ.get("GITHUB_CLIENT_ID") and os.environ.get("GITHUB_CLIENT_SECRET")),
)


def _cors_origins() -> list[str]:
    """CORS origins come from ALLOWED_ORIGINS (comma-separated) plus the
    frontend URL. Defaults keep local development working out of the box."""
    origins: list[str] = []
    for value in (
        os.environ.get("ALLOWED_ORIGINS", "").split(",")
        + [os.environ.get("FRONTEND_URL", "")]
    ):
        origin = value.strip().rstrip("/")
        if origin:
            origins.append(origin)
    if not origins:
        origins.append("http://localhost:5173")
    return list(dict.fromkeys(origins))


# Allow React to access the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(router)
app.include_router(aura_router)


@app.get("/healthz")
def healthz():
    """Health check for load balancers and platform probes."""
    return {"status": "ok"}
