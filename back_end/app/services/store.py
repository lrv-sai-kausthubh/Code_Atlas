"""CodeAtlas persistence store — one facade, two interchangeable backends.

* FileStore (default) — the original JSON-file layout under ``data_base/``.
  Paths are resolved lazily from the auth/authorization modules so unit tests
  that monkeypatch those globals keep working.
* PostgresStore — production backend (Supabase or any PostgreSQL), activated
  by setting ``DATABASE_URL``. Collections live in a single ``ca_collections``
  table as JSONB documents (same shapes as the files), the audit log in
  ``ca_audit``, and project graphs/secrets in ``ca_graphs``/``ca_secrets``.

Set ``DATABASE_URL`` to switch. ``store.init()`` creates the tables on boot,
and ``python -m scripts.migrate_to_db`` copies an existing data_base/ into it.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

DATA_BASE = Path(__file__).resolve().parents[3] / "data_base"

DB_ENABLED = bool(os.environ.get("DATABASE_URL", "").strip())

COLLECTION_NAMES = (
    "users",
    "sessions",
    "policies",
    "policy_versions",
    "teams",
    "organizations",
    "security_events",
    "access_requests",
)


def is_db_enabled() -> bool:
    return DB_ENABLED


# ── file backend helpers ────────────────────────────────────────────────────
def _collection_path(name: str) -> Path:
    """Resolve a collection's JSON file at call time.

    Paths come from the authorization module's globals so unit tests that
    monkeypatch them (``authz.DATA_BASE`` etc.) keep working, and so the store
    never imports ``app.api.auth`` (fastapi is unavailable in engine tests).
    """
    from app.services import authorization as authz

    if name == "users":
        return authz.DATA_BASE / "users.json"
    if name == "sessions":
        return authz.DATA_BASE / "sessions.json"
    if name == "policies":
        return authz.POLICIES_FILE
    if name == "policy_versions":
        return authz.POLICY_VERSIONS_FILE
    if name == "teams":
        return authz.TEAMS_FILE
    if name == "organizations":
        return authz.ORGANIZATIONS_FILE
    if name == "security_events":
        return authz.SECURITY_EVENTS_FILE
    if name == "access_requests":
        return authz.DATA_BASE / "access_requests.json"
    raise KeyError(f"unknown collection: {name}")


def _secret_key_path() -> Path:
    from app.services import authorization as authz

    return authz.DATA_BASE / ".secret_key"


def _audit_file() -> Path:
    from app.services import authorization as authz

    return authz.AUDIT_FILE


def _projects_dir() -> Path:
    from app.services import authorization as authz

    return authz.PROJECTS_DIR


def _load_json_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_json_file(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ── postgres backend ────────────────────────────────────────────────────────
_pool: Any = None

_DDL = """
CREATE TABLE IF NOT EXISTS ca_collections (
    name TEXT PRIMARY KEY,
    data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS ca_audit (
    seq BIGSERIAL PRIMARY KEY,
    ts DOUBLE PRECISION NOT NULL,
    email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ca_audit_email_idx ON ca_audit (email);
CREATE TABLE IF NOT EXISTS ca_graphs (
    project_id TEXT PRIMARY KEY,
    data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS ca_secrets (
    project_id TEXT PRIMARY KEY,
    data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS ca_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def _probe_conninfo() -> str:
    """Return a connection string that works against this server.

    Managed clouds (Supabase/Render/Neon) usually require SSL; local Postgres
    usually has it disabled. Probe with ``sslmode=require`` once and fall back
    to the plain URL so both work out of the box.
    """
    import psycopg

    conninfo = os.environ["DATABASE_URL"].strip()
    if "sslmode" not in conninfo:
        conninfo += ("&" if "?" in conninfo else "?") + "sslmode=require"
    try:
        with psycopg.connect(conninfo, connect_timeout=5):
            return conninfo
    except psycopg.OperationalError as exc:
        message = str(exc).lower()
        if "ssl" not in message and "sslmode" not in message:
            raise
        conninfo = os.environ["DATABASE_URL"].strip()
        with psycopg.connect(conninfo, connect_timeout=5):
            return conninfo


def _get_pool() -> Any:
    global _pool
    if _pool is None:
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(conninfo=_probe_conninfo(), min_size=1, max_size=8, open=False)
        _pool.open(wait=True, timeout=30)
    _ensure_schema()
    return _pool


_ddl_done = False


def _ensure_schema() -> None:
    """Create the ca_* tables on first DB use.

    Idempotent (IF NOT EXISTS) and called lazily because auth.py loads users at
    import time — before the FastAPI lifespan would run — so a fresh database
    would otherwise fail on the first query.
    """
    global _ddl_done
    if _ddl_done:
        return
    _ddl_done = True
    with _pool.connection() as conn:
        conn.execute(_DDL)


def init() -> None:
    """Create tables when running on PostgreSQL; no-op in file mode."""
    if DB_ENABLED:
        _get_pool()


def reset_db() -> None:
    """Wipe all ca_* tables (test isolation; no-op in file mode)."""
    if not DB_ENABLED:
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "TRUNCATE ca_collections, ca_audit, ca_graphs, ca_secrets, ca_settings"
        )


# ── collection API ──────────────────────────────────────────────────────────
def load_collection(name: str) -> dict[str, Any]:
    if name not in COLLECTION_NAMES:
        raise KeyError(f"unknown collection: {name}")
    if not DB_ENABLED:
        return _load_json_file(_collection_path(name))
    with _get_pool().connection() as conn:
        row = conn.execute(
            "SELECT data FROM ca_collections WHERE name = %s", (name,)
        ).fetchone()
    return dict(row[0]) if row else {}


def save_collection(name: str, data: dict[str, Any]) -> None:
    if name not in COLLECTION_NAMES:
        raise KeyError(f"unknown collection: {name}")
    if not DB_ENABLED:
        _write_json_file(_collection_path(name), data)
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "INSERT INTO ca_collections (name, data) VALUES (%s, %s::jsonb) "
            "ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data",
            (name, json.dumps(data, ensure_ascii=False)),
        )


def pop_collection(name: str, key: str) -> bool:
    """Remove a single key from a collection (read-modify-write)."""
    data = load_collection(name)
    if key not in data:
        return False
    del data[key]
    save_collection(name, data)
    return True


# ── audit log API ───────────────────────────────────────────────────────────
def audit_append(event: dict[str, Any]) -> None:
    if not DB_ENABLED:
        try:
            _audit_file().parent.mkdir(parents=True, exist_ok=True)
            with open(_audit_file(), "a", encoding="utf-8") as file:
                file.write(json.dumps(event) + "\n")
        except OSError:
            pass
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "INSERT INTO ca_audit (ts, email, action, resource, detail) "
            "VALUES (%s, %s, %s, %s, %s::jsonb)",
            (
                event.get("ts", round(time.time(), 3)),
                event.get("email", ""),
                event.get("action", ""),
                event.get("resource", ""),
                json.dumps(event.get("detail") or {}),
            ),
        )


def audit_list() -> list[dict[str, Any]]:
    """All audit events, oldest first."""
    if not DB_ENABLED:
        events: list[dict[str, Any]] = []
        try:
            with open(_audit_file(), "r", encoding="utf-8") as file:
                for line in file:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except OSError:
            return []
        return events
    with _get_pool().connection() as conn:
        rows = conn.execute(
            "SELECT ts, email, action, resource, detail FROM ca_audit ORDER BY seq"
        ).fetchall()
    return [
        {
            "ts": row[0],
            "email": row[1],
            "action": row[2],
            "resource": row[3],
            "detail": row[4] or {},
        }
        for row in rows
    ]


def audit_find(email: str) -> list[tuple[str, str]]:
    """(action, resource) pairs for one account (password-flag inference)."""
    if not DB_ENABLED:
        return [
            (event.get("action", ""), event.get("resource", ""))
            for event in audit_list()
            if event.get("email") == email
        ]
    with _get_pool().connection() as conn:
        rows = conn.execute(
            "SELECT action, resource FROM ca_audit WHERE email = %s", (email,)
        ).fetchall()
    return [(row[0], row[1]) for row in rows]


# ── project graph / secrets API ─────────────────────────────────────────────
def save_graph(project_id: str, data: dict[str, Any]) -> None:
    if not DB_ENABLED:
        _write_json_file(_projects_dir() / f"{project_id}.json", data)
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "INSERT INTO ca_graphs (project_id, data) VALUES (%s, %s::jsonb) "
            "ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data",
            (project_id, json.dumps(data, ensure_ascii=False)),
        )


def load_graph(project_id: str) -> dict[str, Any] | None:
    if not DB_ENABLED:
        return _load_json_file(_projects_dir() / f"{project_id}.json") or None
    with _get_pool().connection() as conn:
        row = conn.execute(
            "SELECT data FROM ca_graphs WHERE project_id = %s", (project_id,)
        ).fetchone()
    return dict(row[0]) if row else None


def delete_graph(project_id: str) -> None:
    if not DB_ENABLED:
        (_projects_dir() / f"{project_id}.json").unlink(missing_ok=True)
        return
    with _get_pool().connection() as conn:
        conn.execute("DELETE FROM ca_graphs WHERE project_id = %s", (project_id,))


def save_secrets(project_id: str, data: dict[str, Any]) -> None:
    if not DB_ENABLED:
        _write_json_file(_projects_dir() / f"{project_id}.secrets.json", data)
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "INSERT INTO ca_secrets (project_id, data) VALUES (%s, %s::jsonb) "
            "ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data",
            (project_id, json.dumps(data, ensure_ascii=False)),
        )


def load_secrets(project_id: str) -> dict[str, Any] | None:
    if not DB_ENABLED:
        return _load_json_file(_projects_dir() / f"{project_id}.secrets.json") or None
    with _get_pool().connection() as conn:
        row = conn.execute(
            "SELECT data FROM ca_secrets WHERE project_id = %s", (project_id,)
        ).fetchone()
    data = row[0] if row else None
    # Legacy files stored a plain list of findings; tolerate both shapes.
    if isinstance(data, list):
        return {"findings": data}
    return dict(data) if isinstance(data, dict) else None


def delete_secrets(project_id: str) -> None:
    if not DB_ENABLED:
        (_projects_dir() / f"{project_id}.secrets.json").unlink(missing_ok=True)
        return
    with _get_pool().connection() as conn:
        conn.execute("DELETE FROM ca_secrets WHERE project_id = %s", (project_id,))


# ── secret key (OAuth token encryption at rest) ─────────────────────────────
def get_secret_key() -> str:
    if not DB_ENABLED:
        path = _secret_key_path()
        try:
            return path.read_text(encoding="utf-8").strip()
        except OSError:
            return ""
    with _get_pool().connection() as conn:
        row = conn.execute(
            "SELECT value FROM ca_settings WHERE key = 'secret_key'"
        ).fetchone()
    return str(row[0]) if row else ""


def set_secret_key(key: str) -> None:
    if not DB_ENABLED:
        path = _secret_key_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(key, encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        return
    with _get_pool().connection() as conn:
        conn.execute(
            "INSERT INTO ca_settings (key, value) VALUES ('secret_key', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key,),
        )


# ── migration ───────────────────────────────────────────────────────────────
def _bulk_audit(events: list[dict[str, Any]]) -> None:
    if not events:
        return
    with _get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO ca_audit (ts, email, action, resource, detail) "
                "VALUES (%(ts)s, %(email)s, %(action)s, %(resource)s, %(detail)s::jsonb)",
                [
                    {
                        "ts": event.get("ts", 0),
                        "email": event.get("email", ""),
                        "action": event.get("action", ""),
                        "resource": event.get("resource", ""),
                        "detail": json.dumps(event.get("detail") or {}),
                    }
                    for event in events
                ],
            )


def migrate_from_files(base_dir: Path) -> dict[str, int]:
    """Copy an existing data_base/ JSON layout into the database (DB mode).

    Returns a dict of {name: rows} counts. Safe to re-run: collections are
    overwritten, audit rows are appended (duplicates on re-run).
    """
    base = Path(base_dir)
    counts: dict[str, int] = {}

    for name in COLLECTION_NAMES:
        data = _load_json_file(base / f"{name}.json")
        if not data:
            continue
        save_collection(name, data)
        counts[name] = len(data)

    audit_path = base / "audit.jsonl"
    events: list[dict[str, Any]] = []
    if audit_path.exists():
        for line in audit_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    _bulk_audit(events)
    counts["audit"] = len(events)

    projects_dir = base / "projects"
    graphs = secrets = 0
    if projects_dir.exists():
        for file in sorted(projects_dir.glob("*.json")):
            if file.name.endswith(".secrets.json"):
                save_secrets(file.name[: -len(".secrets.json")], _load_json_file(file))
                secrets += 1
            else:
                save_graph(file.name[: -len(".json")], _load_json_file(file))
                graphs += 1
    counts["graphs"] = graphs
    counts["secrets"] = secrets
    return counts
