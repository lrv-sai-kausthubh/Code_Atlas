import hashlib
import hmac
import json
import os
import secrets
import threading
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .routes import _download_github_repo_zip, _extract_and_analyze, _new_upload_task, _update_upload_task

router = APIRouter()

USERS_FILE = Path(__file__).resolve().parents[3] / "data_base" / "users.json"
AUTH_LOCK = threading.Lock()

SESSIONS: dict[str, dict] = {}
USERS: dict[str, dict] = {}

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_BASE = os.environ.get("BACKEND_BASE", "http://localhost:8000")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LogoutRequest(BaseModel):
    token: str


class ImportRepoRequest(BaseModel):
    repo_url: str
    upload_id: str
    token: str


def _load_users() -> None:
    if not USERS_FILE.exists():
        return
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as file:
            USERS.update(json.load(file))
    except (json.JSONDecodeError, OSError):
        USERS.clear()


def _save_users() -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(USERS, file, indent=2)


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def _issue_token() -> str:
    return secrets.token_urlsafe(32)


def _current_user(token: str) -> dict | None:
    session = SESSIONS.get(token)
    if not session:
        return None
    user = USERS.get(session.get("email"))
    if not user:
        return None
    return {"email": user["email"], "name": user.get("name", ""), "github_login": user.get("github_login")}


def _github_api_get(url: str, token: str) -> dict:
    import urllib.error
    import urllib.request

    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "User-Agent": "CodeAtlas",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _github_api_post(url: str, payload: dict) -> dict:
    import urllib.error
    import urllib.parse
    import urllib.request

    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={
        "Accept": "application/json",
        "User-Agent": "CodeAtlas",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


@router.get("/api/auth/github/authorize")
def github_authorize():
    """Redirect the user to GitHub's OAuth consent screen."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.")
    redirect_uri = f"{BACKEND_BASE}/api/auth/github/callback"
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&scope=repo read:user user:email"
    )
    return RedirectResponse(url)


@router.get("/api/auth/github/callback")
def github_callback(code: str):
    """Exchange the OAuth code for a token and log the user in."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub OAuth is not configured.")
    token_response = _github_api_post(
        "https://github.com/login/oauth/access_token",
        {
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": f"{BACKEND_BASE}/api/auth/github/callback",
        },
    )
    access_token = token_response.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub authorization failed.")
    try:
        user_info = _github_api_get("https://api.github.com/user", access_token)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not reach the GitHub API.") from error
    login = user_info.get("login")
    email = user_info.get("email") or f"{login}@users.noreply.github.com"
    name = user_info.get("name") or login
    token = _issue_token()
    with AUTH_LOCK:
        user = USERS.get(email)
        if user:
            user["name"] = name
            user["github_login"] = login
            user["github_access_token"] = access_token
            user["avatar_url"] = user_info.get("avatar_url")
        else:
            salt = secrets.token_hex(8)
            USERS[email] = {
                "name": name,
                "email": email,
                "salt": salt,
                "password_hash": _hash_password(secrets.token_hex(16), salt),
                "github_login": login,
                "github_access_token": access_token,
                "avatar_url": user_info.get("avatar_url"),
                "created_at": time.time(),
            }
        _save_users()
        SESSIONS[token] = {"email": email}
    return RedirectResponse(f"{FRONTEND_URL}/?token={token}&github=connected")


@router.post("/api/auth/register")
def register(request: RegisterRequest):
    """Create a new account with email and password."""
    email = request.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Please provide a valid email address.")
    if len(request.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters long.")
    with AUTH_LOCK:
        if email in USERS:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        salt = secrets.token_hex(8)
        USERS[email] = {
            "name": request.name.strip() or email.split("@")[0],
            "email": email,
            "salt": salt,
            "password_hash": _hash_password(request.password, salt),
            "created_at": time.time(),
        }
        _save_users()
        token = _issue_token()
        SESSIONS[token] = {"email": email}
    return {"token": token, "user": _current_user(token)}


@router.post("/api/auth/login")
def login(request: LoginRequest):
    """Sign in with email and password."""
    email = request.email.strip().lower()
    with AUTH_LOCK:
        user = USERS.get(email)
        if not user:
            raise HTTPException(status_code=401, detail="No account found for this email.")
        expected = _hash_password(request.password, user["salt"])
        if not hmac.compare_digest(expected, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect email or password.")
        token = _issue_token()
        SESSIONS[token] = {"email": email}
    return {"token": token, "user": _current_user(token)}


@router.post("/api/auth/logout")
def logout(request: LogoutRequest):
    """Invalidate a session token."""
    with AUTH_LOCK:
        SESSIONS.pop(request.token, None)
    return {"status": "logged_out"}


@router.get("/api/auth/me")
def me(token: str):
    """Return the current user for a session token."""
    user = _current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return {"user": user}


@router.get("/api/auth/github/repos")
def github_repos(token: str):
    """List repositories accessible to the connected GitHub account."""
    session = SESSIONS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = USERS.get(session.get("email"))
    access_token = (user or {}).get("github_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Connect a GitHub account to list your repositories.")
    try:
        repos = _github_api_get("https://api.github.com/user/repos?per_page=100&sort=updated", access_token)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not reach the GitHub API.") from error
    return {
        "repos": [
            {
                "full_name": repo.get("full_name"),
                "name": repo.get("name"),
                "private": repo.get("private", False),
                "language": repo.get("language"),
                "description": repo.get("description"),
                "default_branch": repo.get("default_branch", "main"),
            }
            for repo in repos
        ]
    }


@router.post("/api/auth/github/import")
def github_import(request: ImportRepoRequest):
    """Import a connected repository into the analysis pipeline."""
    session = SESSIONS.get(request.token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    task = _new_upload_task(request.upload_id)
    threading.Thread(
        target=_import_github_repo,
        args=(request.upload_id, request.repo_url, request.token),
        daemon=True,
    ).start()
    return {"upload_id": request.upload_id, "status": task["status"]}


def _import_github_repo(upload_id: str, repo_url: str, token: str) -> None:
    try:
        session = SESSIONS.get(token)
        if not session:
            _update_upload_task(upload_id, status="error", error="Session expired.")
            return
        user = USERS.get(session.get("email"))
        access_token = (user or {}).get("github_access_token")
        if not access_token:
            _update_upload_task(upload_id, status="error", error="Connect a GitHub account first.")
            return
        from .routes import _parse_github_url

        parsed = _parse_github_url(repo_url)
        if not parsed:
            _update_upload_task(upload_id, status="error", error="Invalid GitHub repository URL.")
            return
        owner, repo, branch = parsed
        _update_upload_task(upload_id, status="processing", phase="downloading", progress=5.0, current_file=repo_url)
        content = _download_github_repo_zip(owner, repo, branch)
        _extract_and_analyze(upload_id, content, repo, strip_root=True)
    except HTTPException as error:
        _update_upload_task(upload_id, status="error", error=error.detail)


_load_users()
