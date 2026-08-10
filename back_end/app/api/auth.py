import hashlib
import hmac
import json
import os
import secrets
import threading
import time
import urllib.error
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.services import authorization as authz
from app.services.events import bus
from .routes import (
    _download_github_repo_zip,
    _existing_upload_task,
    _extract_and_analyze,
    _new_upload_task,
    _update_upload_task,
    UPLOAD_TASKS,
    UPLOAD_TASKS_LOCK,
)

router = APIRouter()

USERS_FILE = Path(__file__).resolve().parents[3] / "data_base" / "users.json"
SESSIONS_FILE = Path(__file__).resolve().parents[3] / "data_base" / "sessions.json"
SECRET_KEY_FILE = Path(__file__).resolve().parents[3] / "data_base" / ".secret_key"
AUTH_LOCK = threading.Lock()

# Sessions survive backend restarts (persisted to data_base/sessions.json) and
# slide on every request; a session expires only after 30 days of inactivity.
SESSION_TTL_SECONDS = 30 * 24 * 3600
SESSION_SAVE_INTERVAL = 300  # persist at most every 5 min per active session

SESSIONS: dict[str, dict] = {}
USERS: dict[str, dict] = {}

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_BASE = os.environ.get("BACKEND_BASE", "http://localhost:8000")

# Comma-separated emails promoted to super_admin on load/login/register.
SUPER_ADMIN_EMAILS = [
    email.strip()
    for email in os.environ.get("CODEATLAS_SUPER_ADMIN", "").split(",")
    if email.strip()
]


def _is_super_admin(email: str) -> bool:
    return email in SUPER_ADMIN_EMAILS


def _frontend_url() -> str:
    """Resolve the frontend URL at request time so .env edits apply immediately."""
    return os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _backend_base() -> str:
    """Resolve the backend base URL at request time (used for the OAuth redirect URI)."""
    return os.environ.get("BACKEND_BASE", "http://localhost:8000").rstrip("/")


def _get_fernet():
    """Return a Fernet instance for encrypting OAuth tokens at rest.

    Uses CODEATLAS_SECRET_KEY if set; otherwise loads (or creates) a random
    key file at data_base/.secret_key. The key file is git-ignored.
    """
    from cryptography.fernet import Fernet

    key = os.environ.get("CODEATLAS_SECRET_KEY", "").strip()
    if not key:
        if SECRET_KEY_FILE.exists():
            key = SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
        else:
            SECRET_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
            key = Fernet.generate_key().decode("ascii")
            SECRET_KEY_FILE.write_text(key, encoding="utf-8")
            try:
                os.chmod(SECRET_KEY_FILE, 0o600)
            except OSError:
                pass
    return Fernet(key.encode("ascii"))


def _encrypt_token(token: str) -> str:
    if not token:
        return token
    return _get_fernet().encrypt(token.encode("utf-8")).decode("ascii")


def _decrypt_token(blob: str) -> str:
    if not blob:
        return blob
    if not blob.startswith("gAAAA"):
        return blob  # legacy plaintext token (already migrated in-memory on load)
    try:
        return _get_fernet().decrypt(blob.encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def _github_token_for_user(user: dict) -> str:
    return _decrypt_token((user or {}).get("github_access_token", "") or "")


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


class UpdateProfileRequest(BaseModel):
    name: str
    avatar_url: str = ""


class ChangePasswordRequest(BaseModel):
    current_password: str = ""
    new_password: str


def _load_users() -> None:
    if not USERS_FILE.exists():
        return
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as file:
            loaded = json.load(file)
        migrated = False
        for user in loaded.values():
            token = user.get("github_access_token", "")
            if token and not token.startswith("gAAAA"):
                user["github_access_token"] = _encrypt_token(token)
                migrated = True
            if _is_super_admin(user.get("email", "")):
                user["role"] = authz.SUPER_ADMIN
                migrated = True
        USERS.update(loaded)
        if migrated:
            _save_users()
    except (json.JSONDecodeError, OSError):
        USERS.clear()


def _save_users() -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(USERS, file, indent=2)


def _load_sessions() -> None:
    if not SESSIONS_FILE.exists():
        return
    try:
        with open(SESSIONS_FILE, "r", encoding="utf-8") as file:
            loaded = json.load(file)
        now = time.time()
        for token, session in loaded.items():
            if now - (session.get("last_seen") or session.get("created_at") or 0) > SESSION_TTL_SECONDS:
                continue
            SESSIONS[token] = session
    except (json.JSONDecodeError, OSError):
        SESSIONS.clear()


def _save_sessions() -> None:
    SESSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SESSIONS_FILE, "w", encoding="utf-8") as file:
        json.dump(SESSIONS, file, indent=2)


def _new_session(email: str) -> str:
    """Create a session and persist it so it survives backend restarts."""
    token = _issue_token()
    now = time.time()
    SESSIONS[token] = {"email": email, "created_at": now, "last_seen": now}
    _save_sessions()
    return token


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def _issue_token() -> str:
    return secrets.token_urlsafe(32)


def _current_user(token: str) -> dict | None:
    session = SESSIONS.get(token)
    if not session:
        return None
    now = time.time()
    last_seen = session.get("last_seen") or session.get("created_at") or now
    if now - last_seen > SESSION_TTL_SECONDS:
        SESSIONS.pop(token, None)
        _save_sessions()
        return None
    # Sliding expiry: refresh last_seen in memory each call, persist lazily.
    session["last_seen"] = now
    if now - last_seen > SESSION_SAVE_INTERVAL:
        _save_sessions()
    user = USERS.get(session.get("email"))
    if not user:
        return None
    role = user.get("role", authz.DEFAULT_ROLE)
    if _is_super_admin(user["email"]):
        role = authz.SUPER_ADMIN
    return {
        "email": user["email"],
        "name": user.get("name", ""),
        "github_login": user.get("github_login"),
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at"),
        "role": role,
        "password_set": bool(user.get("password_set", True)),
    }


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
def github_authorize(prompt: str | None = None):
    """Redirect the user to GitHub's OAuth consent screen.

    `prompt=select_account` forces GitHub to show the account chooser even if
    the app was already authorized, so users can switch GitHub accounts.
    """
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.")
    redirect_uri = f"{_backend_base()}/api/auth/github/callback"
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&scope=repo read:user user:email"
    )
    if prompt:
        url += f"&prompt={prompt}"
    return RedirectResponse(url)


def _resolve_github_email(login: str, user_info: dict, access_token: str) -> str:
    """Resolve the real primary/verified GitHub email via `user:email` scope,
    so accounts are keyed by a real address instead of the noreply placeholder
    (which breaks email-based org membership / collaborator sync)."""
    candidates: list[str] = []
    try:
        emails = _github_api_get("https://api.github.com/user/emails", access_token)
        if isinstance(emails, list):
            primary = [e for e in emails if isinstance(e, dict) and e.get("primary")]
            verified = [e for e in emails if isinstance(e, dict) and e.get("verified")]
            candidates = [e.get("email") for e in primary] + [e.get("email") for e in verified if not e.get("primary")]
    except Exception:
        pass
    for candidate in candidates:
        candidate = (candidate or "").strip().lower()
        if candidate:
            return candidate
    return (user_info.get("email") or "").strip().lower() or f"{login}@users.noreply.github.com"


def _has_real_password(email: str) -> bool:
    """Whether the account has a password its owner actually chose.

    The authoritative evidence is the audit trail: an account that was
    registered with email+password leaves an `auth.register` line, a
    successful email login (`auth.login` with a plain email resource) proves
    the password is known, and a password change/set writes `auth.password`.
    GitHub logins write `auth.login` with a `github:...` resource and prove
    nothing about a password, so they are ignored.

    This supersedes the stored password_set flag: older code stamped
    `password_set: true` onto legacy GitHub-created accounts (whose hash is an
    unverifiable random placeholder), so the flag alone cannot be trusted for
    accounts lacking an audit trail.
    """
    try:
        with open(authz.AUDIT_FILE, "r", encoding="utf-8") as file:
            for line in file:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("email") != email:
                    continue
                action = event.get("action")
                if action in ("auth.register", "auth.password"):
                    return True
                if action == "auth.login" and event.get("resource") == email:
                    return True
    except OSError:
        pass
    return False


def _bind_github_login(email: str, login: str, access_token: str, name: str, avatar_url: str) -> str:
    """Bind a GitHub login to the account keyed by `email`, linking or re-keying
    `@users.noreply.github.com` placeholder accounts to the real email so that
    org membership / collaborator grants match the login identity.

    Returns the active USERS key for the session."""
    email = (email or "").strip().lower()
    is_noreply = email.endswith("@users.noreply.github.com")
    encrypted = _encrypt_token(access_token)

    holder = None
    for existing_email, existing_user in USERS.items():
        if existing_email != email and existing_user.get("github_login") == login:
            holder = existing_email
            break

    if not is_noreply and email in USERS:
        # Real account exists: link the GitHub login onto it, always refreshing
        # the access token so revoked/expired tokens are replaced on reconnect.
        user = USERS[email]
        user["github_login"] = login
        user["github_access_token"] = encrypted
        user["name"] = name
        user["avatar_url"] = avatar_url
        # An account registered with email+password keeps its real password;
        # a GitHub-created legacy account (no register/login audit line) still
        # needs a password to be set. Unconditional assignment also repairs
        # accounts whose flag was wrongly stamped `true` by earlier code.
        user["password_set"] = _has_real_password(email)
        if holder:
            placeholder_user = USERS.pop(holder, None)
            if placeholder_user:
                placeholder_token = placeholder_user.get("github_access_token")
                if placeholder_token and not user.get("github_access_token"):
                    user["github_access_token"] = placeholder_token
            authz.rekey_user_email(holder, email)
            authz.audit("system", "github.rekey", f"{holder} -> {email}")
        return email

    if not is_noreply and holder:
        # Same person logged in before under the noreply key: re-key it to the
        # real email, keeping their policy/org/team membership and password.
        user = USERS.pop(holder)
        user["email"] = email
        user["name"] = name
        user["github_login"] = login
        user["github_access_token"] = encrypted
        user["avatar_url"] = avatar_url
        user["role"] = user.get("role") or authz.DEFAULT_ROLE
        # Account originally created via GitHub (placeholder password): the
        # user never chose one, so the "set a password" flow must trigger.
        user.setdefault("password_set", False)
        USERS[email] = user
        authz.rekey_user_email(holder, email)
        authz.audit("system", "github.rekey", f"{holder} -> {email}")
        return email

    if email not in USERS:
        salt = secrets.token_hex(8)
        USERS[email] = {
            "name": name,
            "email": email,
            "salt": salt,
            "password_hash": _hash_password(secrets.token_hex(16), salt),
            "password_set": False,
            "github_login": login,
            "github_access_token": encrypted,
            "avatar_url": avatar_url,
            "role": authz.DEFAULT_ROLE,
            "created_at": time.time(),
        }
    else:
        user = USERS[email]
        user["github_login"] = login
        user["github_access_token"] = encrypted
        user["name"] = name
        user["avatar_url"] = avatar_url
        # A @users.noreply.github.com key only ever comes from GitHub account
        # creation, so a legacy account keyed by one has a placeholder password
        # unless the audit trail proves a password was set or known.
        if is_noreply:
            user["password_set"] = _has_real_password(email)
    return email


def _grant_pending_collaborator(email: str, login: str) -> None:
    """When a GitHub collaborator signs in for the first time, grant them
    access to every GitHub-backed project where their login was already
    listed as a collaborator but had no CodeAtlas account yet."""
    if not login:
        return
    for policy in authz.load_all_policies():
        if policy.source != "github":
            continue
        pending = [
            item
            for item in policy.github_collaborators
            if item.get("login") == login and not item.get("email")
        ]
        if not pending:
            continue
        owner = USERS.get(policy.owner_email)
        access_token = _github_token_for_user(owner) if owner else ""
        if not access_token:
            continue
        try:
            authz.sync_github_collaborators(policy, access_token)
            authz.audit(email, "collaborators.claim", policy.project_id, {"login": login})
        except Exception:
            pass


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
            "redirect_uri": f"{_backend_base()}/api/auth/github/callback",
        },
    )
    access_token = token_response.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub authorization failed.")
    try:
        user_info = _github_api_get("https://api.github.com/user", access_token)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not reach the GitHub API.") from error
    login = user_info.get("login") or ""
    name = user_info.get("name") or login
    resolved_email = _resolve_github_email(login, user_info, access_token)
    with AUTH_LOCK:
        email = _bind_github_login(resolved_email, login, access_token, name, user_info.get("avatar_url"))
        _save_users()
        token = _new_session(email)
    _grant_pending_collaborator(email, login)
    authz.audit(email, "auth.login", f"github:{login}")
    return RedirectResponse(f"{_frontend_url()}/?token={token}&github=connected")


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
            "password_set": True,
            "role": authz.DEFAULT_ROLE,
            "created_at": time.time(),
        }
        _save_users()
        token = _new_session(email)
    authz.audit(email, "auth.register", email)
    bus.publish("user.changed", payload={"email": email, "action": "register"})
    return {"token": token, "user": _current_user(token)}


@router.post("/api/auth/login")
def login(request: LoginRequest):
    """Sign in with email and password."""
    email = request.email.strip().lower()
    with AUTH_LOCK:
        user = USERS.get(email)
        if not user:
            authz.audit(email, "auth.login_failed", email, {"reason": "no account"})
            raise HTTPException(status_code=401, detail="No account found for this email.")
        expected = _hash_password(request.password, user["salt"])
        if not hmac.compare_digest(expected, user["password_hash"]):
            authz.audit(email, "auth.login_failed", email, {"reason": "bad password"})
            raise HTTPException(status_code=401, detail="Incorrect email or password.")
        # A successful email login proves the password is known: re-stamp the
        # flag so a wrongly-inferred `false` self-heals.
        if not user.get("password_set"):
            user["password_set"] = True
            _save_users()
        token = _new_session(email)
    authz.audit(email, "auth.login", email)
    return {"token": token, "user": _current_user(token)}


@router.post("/api/auth/logout")
def logout(request: LogoutRequest):
    """Invalidate a session token."""
    with AUTH_LOCK:
        SESSIONS.pop(request.token, None)
        _save_sessions()
    return {"status": "logged_out"}


@router.get("/api/auth/me")
def me(token: str):
    """Return the current user for a session token."""
    user = _current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return {"user": user}


@router.put("/api/auth/profile")
def update_profile(request: UpdateProfileRequest, token: str):
    """Update the logged-in user's display name and avatar."""
    session = SESSIONS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty.")
    with AUTH_LOCK:
        user = USERS.get(session.get("email"))
        if not user:
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        user["name"] = name
        if request.avatar_url.strip():
            user["avatar_url"] = request.avatar_url.strip()
        _save_users()
    return {"user": _current_user(token)}


@router.post("/api/auth/password")
def change_password(request: ChangePasswordRequest, token: str):
    """Change the logged-in user's password."""
    session = SESSIONS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    if len(request.new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters long.")
    with AUTH_LOCK:
        user = USERS.get(session.get("email"))
        if not user:
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        password_set = bool(user.get("password_set", True))
        if password_set:
            current = _hash_password(request.current_password, user["salt"])
            if not hmac.compare_digest(current, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Current password is incorrect.")
        new_salt = secrets.token_hex(8)
        user["salt"] = new_salt
        user["password_hash"] = _hash_password(request.new_password, new_salt)
        user["password_set"] = True
        _save_users()
    authz.audit(session["email"], "auth.password", session["email"])
    return {"status": "password_changed"}


@router.get("/api/auth/github/repos")
def github_repos(token: str):
    """List repositories accessible to the connected GitHub account."""
    session = SESSIONS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = USERS.get(session.get("email"))
    access_token = _github_token_for_user(user)
    if not access_token:
        raise HTTPException(status_code=400, detail="Connect a GitHub account to list your repositories.")
    try:
        repos = _github_api_get("https://api.github.com/user/repos?per_page=100&sort=updated", access_token)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="Your GitHub access token is no longer valid. Reconnect your GitHub account.",
            ) from error
        raise HTTPException(status_code=502, detail="Could not reach the GitHub API.") from error
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
    existing = _existing_upload_task(request.upload_id)
    if existing is not None:
        return {"upload_id": request.upload_id, "status": existing["status"]}
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
        access_token = _github_token_for_user(user)
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
        _extract_and_analyze(upload_id, content, repo, strip_root=True, owner_email=user["email"])
        with UPLOAD_TASKS_LOCK:
            result = (UPLOAD_TASKS.get(upload_id) or {}).get("result")
        if result:
            try:
                authz.mark_github_policy(
                    result["project_id"], owner, repo, access_token
                )
            except Exception:
                # collaborator sync is best-effort; the repo remains private to the owner
                pass
    except HTTPException as error:
        _update_upload_task(upload_id, status="error", error=error.detail)


_load_users()
_load_sessions()
