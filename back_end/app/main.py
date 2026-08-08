from pathlib import Path
import os

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
from app.api.routes import router

app = FastAPI(title="CodeAtlas API")


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
