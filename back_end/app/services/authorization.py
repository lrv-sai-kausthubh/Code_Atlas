"""CodeAtlas authorization engine — RBAC + fine-grained resource permissions.

Phase 1 implements repository/folder/file-level permissions with per-node
flags (metadata, graph, source, download) and user-level roles. The engine is
pure (no I/O) so it can be unit-tested in isolation; the policy store lives in
this module too for single-file persistence of policies and audit events.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DATA_BASE = Path(__file__).resolve().parents[3] / "data_base"
POLICIES_FILE = DATA_BASE / "policies.json"
AUDIT_FILE = DATA_BASE / "audit.jsonl"
PROJECTS_DIR = DATA_BASE / "projects"
TEAMS_FILE = DATA_BASE / "teams.json"
POLICY_VERSIONS_FILE = DATA_BASE / "policy_versions.json"
SECURITY_EVENTS_FILE = DATA_BASE / "security_events.json"
ORGANIZATIONS_FILE = DATA_BASE / "organizations.json"

POLICY_LOCK = threading.Lock()

# Permission flags supported in Phase 1.
PERMISSION_FLAGS = ("metadata", "graph", "source", "download")

# Cap on how many historical policy snapshots we keep per project (§27).
MAX_POLICY_VERSIONS = 50

# User-level roles. `super_admin` and `owner` bypass policy for their projects.
ROLES = ("super_admin", "owner", "admin", "architect", "developer", "viewer")
DEFAULT_ROLE = "viewer"

# Roles that may manage a project's policy (grants / requests).
# super_admin is deliberately excluded: global powers live only in the Admin
# Center, never in per-project or per-account views.
MANAGER_ROLES = ("owner", "admin")

# Maximum access a role can hold implicitly (policy still governs content).
SUPER_ADMIN = "super_admin"

# Weekday labels for time-windowed grants (0 = Monday … 6 = Sunday).
WEEKDAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _full_access() -> dict[str, bool]:
    return {flag: True for flag in PERMISSION_FLAGS}


def _no_access() -> dict[str, bool]:
    return {flag: False for flag in PERMISSION_FLAGS}


def _parse_hhmm(value: str) -> int:
    """Parse an "HH:MM" (24h) string into minutes since midnight."""
    try:
        hour, minute = str(value).strip().split(":")
        minutes = int(hour) * 60 + int(minute)
        if not 0 <= minutes < 24 * 60:
            raise ValueError
        return minutes
    except (ValueError, AttributeError) as error:
        raise ValueError(f"invalid time window value: {value!r} (expected HH:MM)") from error


def validate_time_windows(windows: Any) -> list[dict[str, Any]]:
    """Validate/normalize recurring grant windows.

    Each window: `{"days": [0..6] (Mon..Sun), "start": "HH:MM", "end": "HH:MM"}`.
    A window whose end <= start spans midnight (e.g. 22:00 -> 02:00). Returns a
    normalized list of `{"days": [int], "start": int-minutes, "end": int-minutes}`.
    Raises ValueError on malformed input.
    """
    if not windows:
        return []
    if not isinstance(windows, list):
        raise ValueError("windows must be a list")
    cleaned: list[dict[str, Any]] = []
    for window in windows:
        if not isinstance(window, dict):
            raise ValueError("each window must be an object")
        days = window.get("days") or []
        if not isinstance(days, list) or not days or any(
            not isinstance(day, int) or not 0 <= day <= 6 for day in days
        ):
            raise ValueError("window days must be a non-empty list of ints 0-6 (Mon-Sun)")
        start = _parse_hhmm(str(window.get("start", "")))
        end = _parse_hhmm(str(window.get("end", "")))
        cleaned.append({"days": sorted(set(days)), "start": start, "end": end})
    return cleaned


def _minutes_in_window(now: float, window: dict[str, Any]) -> bool:
    local = _dt.datetime.fromtimestamp(now)
    weekday = local.weekday()  # 0 = Monday
    minutes = local.hour * 60 + local.minute
    start, end = window["start"], window["end"]
    days = window["days"]
    if end > start:  # normal window
        return weekday in days and start <= minutes < end
    # overnight window (e.g. Sat 22:00 -> Sun 02:00): active after start on
    # the listed days and before end on the following day.
    return (weekday in days and minutes >= start) or (
        (weekday - 1) % 7 in days and minutes < end
    )


def window_label(windows: list[dict[str, Any]]) -> str:
    """Human-readable label like "MON-FRI 09:00-17:00" or "SAT 22:00-02:00"."""
    if not windows:
        return "ALWAYS"
    parts = []
    for window in windows:
        days = "/".join(WEEKDAY_NAMES[day].upper() for day in window["days"])
        start = f"{window['start'] // 60:02d}:{window['start'] % 60:02d}"
        end = f"{window['end'] // 60:02d}:{window['end'] % 60:02d}"
        parts.append(f"{days} {start}-{end}")
    return " + ".join(parts)


@dataclass
class Grant:
    """A single allow/deny rule binding a subject to a resource prefix.

    Phase 2 adds `subject_type == "team"` and time-limited grants via
    `expires_at` (epoch seconds; a grant is ignored once expired). Phase 5 adds
    recurring time windows (`windows`) so a grant only applies inside a
    schedule (e.g. Mon-Fri 09:00-17:00); empty windows mean "always".
    """

    subject_type: str  # "user" | "team"
    subject_value: str
    path: str  # repo-relative prefix; "" matches the whole repo
    effect: str  # "allow" | "deny"
    permissions: dict[str, bool]
    expires_at: float | None = None
    windows: list[dict[str, Any]] = field(default_factory=list)

    def is_expired(self, now: float | None = None) -> bool:
        if self.expires_at is None:
            return False
        return (now if now is not None else time.time()) > self.expires_at

    def is_active(self, now: float | None = None) -> bool:
        """A grant is active when not expired and inside its window schedule."""
        if self.is_expired(now):
            return False
        if not self.windows:
            return True
        current = now if now is not None else time.time()
        return any(_minutes_in_window(current, window) for window in self.windows)

    def matches(self, user_email: str, resource_path: str, team_ids: set[str] | None = None, now: float | None = None) -> bool:
        if self.subject_type == "user":
            if self.subject_value != user_email:
                return False
        elif self.subject_type == "team":
            if not team_ids or self.subject_value not in team_ids:
                return False
        else:
            return False
        if not self.is_active(now):
            return False
        if not self.path:
            return True  # whole repository
        base = self.path.rstrip("/")
        return resource_path == self.path or resource_path == base or resource_path.startswith(base + "/")


class Policy:
    """Per-repository access policy."""

    def __init__(self, project_id: str, owner_email: str, project: str = "") -> None:
        self.project_id = project_id
        self.project = project
        self.owner_email = owner_email
        self.source = "zip"  # "zip" | "github"
        self.github_owner: str = ""
        self.github_repo: str = ""
        self.managers: list[str] = []  # additional policy managers (GitHub admins)
        self.organization_id: str = ""  # multi-tenant org that owns this repo (Phase 5)
        # Private by default: a project is only visible to its owner, managers,
        # super admins, and people with explicit grants (e.g. GitHub
        # collaborators). The owner can open up access per project from the
        # security center if desired.
        self.default_access: dict[str, bool] = {
            "metadata": False,
            "graph": False,
            "source": False,
            "download": False,
        }
        self.grants: list[Grant] = []
        self.status: str = "new"  # "new" | "in_progress" | "completed"
        self.collaborators: list[str] = []  # GitHub collaborators that have CodeAtlas accounts
        self.github_collaborators: list[dict[str, Any]] = []  # last GitHub snapshot: {login, permission, email}

    # ── serialization ──────────────────────────────────────────────────────
    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "project": self.project,
            "owner_email": self.owner_email,
            "source": self.source,
            "github_owner": self.github_owner,
            "github_repo": self.github_repo,
            "managers": list(self.managers),
            "organization_id": self.organization_id,
            "default_access": dict(self.default_access),
            "status": self.status,
            "collaborators": list(self.collaborators),
            "github_collaborators": list(self.github_collaborators),
            "grants": [
                {
                    "subject_type": g.subject_type,
                    "subject_value": g.subject_value,
                    "path": g.path,
                    "effect": g.effect,
                    "permissions": dict(g.permissions),
                    "expires_at": g.expires_at,
                    "windows": list(g.windows),
                }
                for g in self.grants
            ],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Policy":
        policy = cls(
            project_id=data["project_id"],
            owner_email=data.get("owner_email", ""),
            project=data.get("project", ""),
        )
        policy.source = data.get("source", "zip")
        policy.github_owner = data.get("github_owner", "")
        policy.github_repo = data.get("github_repo", "")
        policy.managers = list(data.get("managers", []) or [])
        policy.organization_id = data.get("organization_id", "")
        policy.status = data.get("status", "new")
        if policy.status not in ("new", "in_progress", "completed"):
            policy.status = "new"
        policy.collaborators = list(data.get("collaborators", []) or [])
        policy.github_collaborators = list(data.get("github_collaborators", []) or [])
        default = data.get("default_access") or {}
        for flag in PERMISSION_FLAGS:
            policy.default_access[flag] = bool(default.get(flag, False))
        for raw in data.get("grants", []):
            policy.grants.append(
                Grant(
                    subject_type=raw.get("subject_type", "user"),
                    subject_value=raw.get("subject_value", ""),
                    path=raw.get("path", ""),
                    effect=raw.get("effect", "allow"),
                    permissions={
                        flag: bool(raw.get("permissions", {}).get(flag, False))
                        for flag in PERMISSION_FLAGS
                    },
                    expires_at=raw.get("expires_at"),
                    windows=[
                        {
                            "days": list(window.get("days", [])),
                            "start": window.get("start", 0),
                            "end": window.get("end", 0),
                        }
                        for window in (raw.get("windows") or [])
                    ],
                )
            )
        return policy

    # ── authorization ──────────────────────────────────────────────────────
    def effective_access(
        self,
        user_email: str,
        role: str | None,
        resource_path: str,
        team_ids: set[str] | None = None,
        now: float | None = None,
    ) -> dict[str, bool]:
        """Compute the effective permission flags for a resource path.

        Precedence: most specific path match wins; among equal specificity an
        explicit deny overrides an allow; otherwise fall back to defaults.
        Team grants count toward a user's access; expired grants and grants
        outside their time windows are ignored.
        """
        if user_email == self.owner_email:
            return _full_access()

        matches = [
            grant
            for grant in self.grants
            if grant.matches(user_email, resource_path, team_ids, now)
        ]
        matches.sort(key=lambda g: len(g.path), reverse=True)

        result = dict(self.default_access)
        for flag in PERMISSION_FLAGS:
            for grant in matches:
                if flag not in grant.permissions:
                    continue
                result[flag] = grant.effect == "allow" and grant.permissions[flag]
                break
        return result

    def explanation(
        self,
        user_email: str,
        role: str | None,
        resource_path: str,
        team_ids: set[str] | None = None,
        now: float | None = None,
    ) -> dict[str, Any]:
        """Human-readable explanation of why access is granted/denied (§19)."""
        if user_email == self.owner_email:
            return {"subject": user_email, "reason": "repository owner", "result": "ALLOW"}
        matches = [
            grant
            for grant in self.grants
            if grant.matches(user_email, resource_path, team_ids, now)
        ]
        matches.sort(key=lambda g: len(g.path), reverse=True)
        steps: list[dict[str, Any]] = []
        for flag in PERMISSION_FLAGS:
            for grant in matches:
                if flag in grant.permissions:
                    step: dict[str, Any] = {
                        "permission": flag,
                        "path": grant.path,
                        "effect": grant.effect,
                        "value": grant.permissions[flag],
                        "subject_type": grant.subject_type,
                        "subject_value": grant.subject_value,
                    }
                    if grant.expires_at is not None:
                        step["expires_at"] = grant.expires_at
                    if grant.windows:
                        step["windows"] = window_label(grant.windows)
                    steps.append(step)
                    break
        if not matches:
            steps.append(
                {"permission": "default", "path": "", "effect": "default", "value": False}
            )
        return {
            "subject": user_email,
            "teams": sorted(team_ids) if team_ids else [],
            "resource": resource_path,
            "steps": steps,
        }


# ── policy store ────────────────────────────────────────────────────────────
def load_policy(project_id: str) -> Policy | None:
    with POLICY_LOCK:
        if not POLICIES_FILE.exists():
            return None
        try:
            data = json.loads(POLICIES_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        raw = data.get(project_id)
        return Policy.from_dict(raw) if raw else None


def save_policy(policy: Policy, actor: str = "", note: str = "") -> None:
    """Persist a policy. When a prior state exists, the old snapshot is kept as
    a version in `policy_versions.json` so admins can inspect/restore history."""
    with POLICY_LOCK:
        data: dict[str, Any] = {}
        if POLICIES_FILE.exists():
            try:
                data = json.loads(POLICIES_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                data = {}
        previous = data.get(policy.project_id)
        data[policy.project_id] = policy.to_dict()
        POLICIES_FILE.parent.mkdir(parents=True, exist_ok=True)
        POLICIES_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

        if previous is not None and previous != policy.to_dict():
            _record_policy_version(
                policy.project_id,
                previous,
                actor=actor,
                note=note or "policy updated",
            )


def _record_policy_version(
    project_id: str,
    snapshot: dict[str, Any],
    actor: str = "",
    note: str = "",
) -> None:
    versions: dict[str, Any] = {}
    if POLICY_VERSIONS_FILE.exists():
        try:
            versions = json.loads(POLICY_VERSIONS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            versions = {}
    history = versions.get(project_id, [])
    history.append(
        {
            "version": len(history) + 1,
            "ts": round(time.time(), 3),
            "actor": actor,
            "note": note,
            "snapshot": snapshot,
        }
    )
    versions[project_id] = history[-MAX_POLICY_VERSIONS:]
    POLICY_VERSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    POLICY_VERSIONS_FILE.write_text(json.dumps(versions, indent=2), encoding="utf-8")


def list_policy_versions(project_id: str) -> list[dict[str, Any]]:
    """Return the version history for a project (metadata only, no snapshots)."""
    if not POLICY_VERSIONS_FILE.exists():
        return []
    try:
        versions = json.loads(POLICY_VERSIONS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [
        {"version": v["version"], "ts": v.get("ts"), "actor": v.get("actor", ""), "note": v.get("note", "")}
        for v in versions.get(project_id, [])
    ]


def get_policy_version(project_id: str, version: int) -> dict[str, Any] | None:
    """Return a full historical snapshot for a project."""
    if not POLICY_VERSIONS_FILE.exists():
        return None
    try:
        versions = json.loads(POLICY_VERSIONS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    for v in versions.get(project_id, []):
        if v.get("version") == version:
            return v.get("snapshot")
    return None


def restore_policy_version(project_id: str, version: int, actor: str = "") -> Policy | None:
    """Restore a historical snapshot as the live policy (§27)."""
    snapshot = get_policy_version(project_id, version)
    if snapshot is None:
        return None
    current = load_policy(project_id)
    restored = Policy.from_dict(snapshot)
    if current is not None:
        _record_policy_version(project_id, current.to_dict(), actor=actor, note=f"restore to version {version}")
    save_policy(restored, actor=actor, note=f"restored version {version}")
    return restored


def ensure_policy(project_id: str, owner_email: str, project: str = "") -> Policy:
    policy = load_policy(project_id)
    if policy is None:
        policy = Policy(project_id, owner_email, project)
        save_policy(policy)
    return policy


def load_all_policies() -> list[Policy]:
    with POLICY_LOCK:
        if not POLICIES_FILE.exists():
            return []
        try:
            data = json.loads(POLICIES_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return [Policy.from_dict(value) for value in data.values()]


def delete_project(project_id: str) -> bool:
    """Permanently remove a project's policy, version history, access
    requests, graph, and secret findings. Returns False if the project did
    not exist. The audit log is append-only and intentionally untouched."""
    with POLICY_LOCK:
        if not POLICIES_FILE.exists():
            return False
        try:
            data = json.loads(POLICIES_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
        if project_id not in data:
            return False
        data.pop(project_id, None)
        POLICIES_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

        if POLICY_VERSIONS_FILE.exists():
            try:
                versions = json.loads(POLICY_VERSIONS_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                versions = {}
            versions.pop(project_id, None)
            POLICY_VERSIONS_FILE.write_text(json.dumps(versions, indent=2), encoding="utf-8")

        requests_path = DATA_BASE / "access_requests.json"
        if requests_path.exists():
            try:
                requests_data = json.loads(requests_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                requests_data = {}
            prefix = f"request:{project_id}:"
            for key in [key for key in requests_data if key.startswith(prefix)]:
                requests_data.pop(key, None)
            requests_path.write_text(json.dumps(requests_data, indent=2), encoding="utf-8")

    safe_id = _sanitize_project_id(project_id)
    project_graph_path(project_id).unlink(missing_ok=True)
    (PROJECTS_DIR / f"{safe_id}.json").unlink(missing_ok=True)
    (PROJECTS_DIR / f"{safe_id}.secrets.json").unlink(missing_ok=True)
    return True


def mark_github_policy(
    project_id: str, github_owner: str, github_repo: str, access_token: str
) -> list[dict[str, Any]] | None:
    """Flag a policy as GitHub-backed and sync collaborators from the GitHub API."""
    policy = load_policy(project_id)
    if policy is None:
        return None
    policy.source = "github"
    policy.github_owner = github_owner
    policy.github_repo = github_repo
    save_policy(policy)
    return sync_github_collaborators(policy, access_token)


# ── graph persistence ───────────────────────────────────────────────────────
def project_graph_path(project_id: str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"


def save_project_graph(project_id: str, result: dict[str, Any]) -> None:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    project_graph_path(project_id).write_text(
        json.dumps(result, ensure_ascii=False), encoding="utf-8"
    )


def load_project_graph(project_id: str) -> dict[str, Any] | None:
    path = project_graph_path(project_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# ── audit log ───────────────────────────────────────────────────────────────
def audit(
    email: str, action: str, resource: str, detail: dict[str, Any] | None = None
) -> None:
    """Append a security-sensitive event. Never log source code or secrets."""
    try:
        DATA_BASE.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_FILE, "a", encoding="utf-8") as file:
            file.write(
                json.dumps(
                    {
                        "ts": round(time.time(), 3),
                        "email": email,
                        "action": action,
                        "resource": resource,
                        "detail": detail or {},
                    }
                )
                + "\n"
            )
    except OSError:
        pass


# ── access requests ─────────────────────────────────────────────────────────
def request_key(project_id: str, request_id: str) -> str:
    return f"request:{project_id}:{request_id}"


def _sanitize_project_id(project_id: str) -> str:
    return project_id.replace("/", "_").replace("\\", "_")


def save_access_request(project_id: str, request: dict[str, Any]) -> None:
    with POLICY_LOCK:
        key = request_key(project_id, request["id"])
        data: dict[str, Any] = {}
        path = DATA_BASE / "access_requests.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                data = {}
        data[key] = request
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_access_requests(project_id: str, email: str) -> list[dict[str, Any]]:
    """Return requests for this project. Owners see all; users see their own."""
    path = DATA_BASE / "access_requests.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    prefix = f"request:{project_id}:"
    requests = [
        value
        for key, value in data.items()
        if key.startswith(prefix) and (value.get("requester_email") == email or email == "*")
    ]
    return sorted(requests, key=lambda r: r.get("created_at", 0), reverse=True)


def update_access_request(project_id: str, request_id: str, changes: dict[str, Any]) -> None:
    with POLICY_LOCK:
        key = request_key(project_id, request_id)
        path = DATA_BASE / "access_requests.json"
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        if key in data:
            data[key].update(changes)
            path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def list_users_file() -> dict[str, dict[str, Any]]:
    """Load the raw user store (used by the grants management API)."""
    users_file = DATA_BASE / "users.json"
    if not users_file.exists():
        return {}
    try:
        data = json.loads(users_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {email: user for email, user in data.items() if isinstance(user, dict)}


def rekey_user_email(old_email: str, new_email: str) -> list[str]:
    """Re-key every reference to `old_email` (policies, orgs, teams, access
    requests) to `new_email`. Returns a list of [:action, path] for audit."""
    old_email = old_email.strip().lower()
    new_email = new_email.strip().lower()
    if not old_email or not new_email or old_email == new_email:
        return []
    changes: list[str] = []

    # policies
    if POLICIES_FILE.exists():
        try:
            data = json.loads(POLICIES_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
        for project_id, policy in data.items():
            if not isinstance(policy, dict):
                continue
            if policy.get("owner_email") == old_email:
                policy["owner_email"] = new_email
                changes.append("policy.owner")
            if policy.get("managers"):
                policy["managers"] = [new_email if m == old_email else m for m in policy["managers"]]
            for grant in policy.get("grants", []):
                if isinstance(grant, dict) and grant.get("subject_type") == "user" and grant.get("subject_value") == old_email:
                    grant["subject_value"] = new_email
                    changes.append("policy.grant")
        if changes:
            POLICIES_FILE.parent.mkdir(parents=True, exist_ok=True)
            POLICIES_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # organizations
    if ORGANIZATIONS_FILE.exists():
        try:
            orgs = json.loads(ORGANIZATIONS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            orgs = {}
        for org in orgs.values():
            if not isinstance(org, dict):
                continue
            if org.get("owner_email") == old_email:
                org["owner_email"] = new_email
                changes.append("org.owner")
            members = org.get("members") or []
            if old_email in members:
                org["members"] = [new_email if m == old_email else m for m in members]
                changes.append("org.member")
        if changes and (ORGANIZATIONS_FILE.exists() or orgs):
            ORGANIZATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
            ORGANIZATIONS_FILE.write_text(json.dumps(orgs, indent=2), encoding="utf-8")

    # teams
    if TEAMS_FILE.exists():
        try:
            teams = json.loads(TEAMS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            teams = {}
        for team in teams.values():
            if isinstance(team, dict) and old_email in (team.get("members") or []):
                team["members"] = [new_email if m == old_email else m for m in team["members"]]
                changes.append("team.member")
        if changes:
            TEAMS_FILE.parent.mkdir(parents=True, exist_ok=True)
            TEAMS_FILE.write_text(json.dumps(teams, indent=2), encoding="utf-8")

    # access requests
    req_path = DATA_BASE / "access_requests.json"
    if req_path.exists():
        try:
            requests = json.loads(req_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            requests = {}
        for request in requests.values():
            if isinstance(request, dict) and request.get("requester_email") == old_email:
                request["requester_email"] = new_email
                changes.append("request.requester")
        if req_path.exists():
            req_path.write_text(json.dumps(requests, indent=2), encoding="utf-8")

    return changes


# ── teams (Phase 2) ──────────────────────────────────────────────────────────
def list_teams() -> dict[str, dict[str, Any]]:
    """Return the raw team store keyed by team id."""
    if not TEAMS_FILE.exists():
        return {}
    try:
        data = json.loads(TEAMS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {team_id: team for team_id, team in data.items() if isinstance(team, dict)}


def save_team(team: dict[str, Any]) -> None:
    with POLICY_LOCK:
        teams = list_teams()
        teams[team["id"]] = team
        TEAMS_FILE.parent.mkdir(parents=True, exist_ok=True)
        TEAMS_FILE.write_text(json.dumps(teams, indent=2), encoding="utf-8")


def delete_team(team_id: str) -> bool:
    with POLICY_LOCK:
        teams = list_teams()
        if team_id not in teams:
            return False
        del teams[team_id]
        TEAMS_FILE.write_text(json.dumps(teams, indent=2), encoding="utf-8")
        return True


def user_team_ids(email: str) -> set[str]:
    """Return the set of team ids a user belongs to."""
    return {
        team_id
        for team_id, team in list_teams().items()
        if email in (team.get("members") or [])
    }


def team_member_emails(team_id: str) -> list[str]:
    team = list_teams().get(team_id)
    return list(team.get("members") or []) if team else []


# ── organizations (Phase 5 multi-tenant) ─────────────────────────────────────
def list_organizations() -> dict[str, dict[str, Any]]:
    """Return the raw organization store keyed by org id."""
    if not ORGANIZATIONS_FILE.exists():
        return {}
    try:
        data = json.loads(ORGANIZATIONS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {org_id: org for org_id, org in data.items() if isinstance(org, dict)}


def save_organization(organization: dict[str, Any]) -> None:
    with POLICY_LOCK:
        orgs = list_organizations()
        orgs[organization["id"]] = organization
        ORGANIZATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        ORGANIZATIONS_FILE.write_text(json.dumps(orgs, indent=2), encoding="utf-8")


def delete_organization(org_id: str) -> bool:
    with POLICY_LOCK:
        orgs = list_organizations()
        if org_id not in orgs:
            return False
        del orgs[org_id]
        ORGANIZATIONS_FILE.write_text(json.dumps(orgs, indent=2), encoding="utf-8")
        return True


def user_org_ids(email: str, login: str | None = None) -> set[str]:
    """Return the set of org ids the user belongs to (or owns).

    A user is considered a member when their email matches a member entry OR
    their GitHub login matches the GitHub login of a member account. The login
    fallback lets accounts keyed by a `@users.noreply.github.com` placeholder
    still resolve to organizations their real email was invited to."""
    orgs_by_email: set[str] = set()
    orgs_by_login: set[str] = set()
    users_by_email: dict[str, dict[str, Any]] | None = None
    for org_id, org in list_organizations().items():
        members = org.get("members") or []
        if email == org.get("owner_email") or email in members:
            orgs_by_email.add(org_id)
        elif login:
            if users_by_email is None:
                users_by_email = list_users_file()
            member_logins = {
                (users_by_email.get(member) or {}).get("github_login")
                for member in members
            }
            if login in member_logins:
                orgs_by_login.add(org_id)
    return orgs_by_email | orgs_by_login


def organization_member_emails(org_id: str) -> set[str]:
    org = list_organizations().get(org_id)
    if not org:
        return set()
    return set(org.get("members") or []) | {org.get("owner_email")}


def policy_org_access(
    policy: Policy, user_email: str, role: str | None, user_org_ids_set: set[str] | None = None
) -> bool:
    """Multi-tenant gate: a policy tied to an organization is only visible to
    its owner, members, and super admins. Repos without an organization stay
    open to the existing collaborative model."""
    if not policy.organization_id:
        return True
    if role == SUPER_ADMIN:
        return True
    if user_email == policy.owner_email:
        return True
    orgs = user_org_ids_set if user_org_ids_set is not None else user_org_ids(user_email)
    return policy.organization_id in orgs


def _filter_analysis(
    analysis: dict[str, Any], node_paths: set[str], source_paths: set[str]
) -> dict[str, Any]:
    """Strip analysis fields that could leak restricted file paths or snippets."""
    if not analysis:
        return analysis
    filtered = dict(analysis)

    # Snippets are source-derived: only visible to source-accessible files.
    filtered["security_issues"] = [
        issue for issue in analysis.get("security_issues", [])
        if issue.get("file") in source_paths
    ]
    # Path lists are metadata: restrict to metadata-visible files.
    filtered["orphan_files"] = [
        path for path in analysis.get("orphan_files", []) if path in node_paths
    ]
    chain = analysis.get("longest_import_chain")
    if chain:
        files = [path for path in chain.get("files", []) if path in node_paths]
        filtered["longest_import_chain"] = {**chain, "length": len(files), "files": files}
    filtered["circular_dependencies"] = [
        [path for path in cycle if path in node_paths]
        for cycle in analysis.get("circular_dependencies", [])
    ]
    # Largest/smallest must be recomputed from visible files only.
    largest = analysis.get("largest_file")
    smallest = analysis.get("smallest_file")
    if largest and largest.get("path") not in node_paths:
        filtered["largest_file"] = None
    if smallest and smallest.get("path") not in node_paths:
        filtered["smallest_file"] = None
    return filtered


# ── authorized graph filtering ──────────────────────────────────────────────
def authorized_graph(
    result: dict[str, Any],
    user_email: str,
    role: str | None,
    policy: Policy,
    team_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Filter a full graph payload to what the user may see.

    - Each node is annotated with an `access` object.
    - `file_details` (source snippets, function bodies) are dropped for any
      node whose `source` flag is false.
    - `function_calls` whose caller is a source-denied file are removed
      (their parameter lists and descriptions are derived from source).
    - `analysis` fields (security snippets, orphan/chains) are filtered to
      source/metadata-visible files only.
    - Nodes without `metadata` access are removed entirely (no existence leak).
    """
    copied = dict(result)
    nodes = []
    access_by_id: dict[str, dict[str, bool]] = {}
    for node in result.get("nodes", []):
        path = node.get("path", "")
        access = policy.effective_access(user_email, role, path, team_ids)
        if not access["metadata"]:
            continue
        access_by_id[node["id"]] = access
        nodes.append({**node, "access": access})

    copied["nodes"] = nodes
    copied["node_access"] = access_by_id

    # Filter edges that reference removed nodes so the graph stays consistent.
    alive = {node["id"] for node in nodes}
    copied["edges"] = [
        edge
        for edge in result.get("edges", [])
        if edge.get("source") in alive and edge.get("target") in alive
    ]

    node_paths = {node.get("path", "") for node in nodes}
    source_paths = {
        node.get("path", "")
        for node in nodes
        if access_by_id.get(node["id"], {}).get("source")
    }

    # Drop source intelligence for source-denied files.
    file_details = result.get("file_details") or {}
    copied["file_details"] = {
        node_id: detail
        for node_id, detail in file_details.items()
        if (access_by_id.get(node_id) or {}).get("source")
    }

    function_calls = result.get("function_calls") or []
    copied["function_calls"] = [
        call
        for call in function_calls
        if (access_by_id.get(f"file:{call.get('caller_file')}") or {}).get("source", False)
    ]

    copied["analysis"] = _filter_analysis(
        result.get("analysis") or {}, node_paths, source_paths
    )

    copied["files"] = sum(1 for n in nodes if n.get("type") == "file")
    copied["folders"] = sum(1 for n in nodes if n.get("type") == "folder")
    return copied


def can_manage(user_email: str, role: str | None, policy: Policy) -> bool:
    return role in MANAGER_ROLES or user_email == policy.owner_email or user_email in policy.managers


def set_grant(
    policy: Policy,
    subject_type: str,
    subject_value: str,
    path: str,
    effect: str,
    permissions: dict[str, bool],
    expires_at: float | None = None,
    windows: list[dict[str, Any]] | None = None,
) -> None:
    """Add or update a single grant (user or team). An existing grant on the
    same subject/path is replaced, so toggling access stays idempotent."""
    policy.grants = [
        grant
        for grant in policy.grants
        if not (
            grant.subject_type == subject_type
            and grant.subject_value == subject_value
            and grant.path == path
        )
    ]
    policy.grants.append(
        Grant(
            subject_type=subject_type,
            subject_value=subject_value,
            path=path,
            effect=effect,
            permissions={flag: bool(permissions.get(flag, False)) for flag in PERMISSION_FLAGS},
            expires_at=expires_at,
            windows=windows or [],
        )
    )


def set_user_grant(policy: Policy, user_email: str, path: str, effect: str,
                   permissions: dict[str, bool], expires_at: float | None = None,
                   windows: list[dict[str, Any]] | None = None) -> None:
    """Convenience wrapper for a single-user grant."""
    set_grant(policy, "user", user_email, path, effect, permissions, expires_at, windows)


def remove_grant(policy: Policy, subject_type: str, subject_value: str, path: str) -> bool:
    before = len(policy.grants)
    policy.grants = [
        grant
        for grant in policy.grants
        if not (
            grant.subject_type == subject_type
            and grant.subject_value == subject_value
            and grant.path == path
        )
    ]
    return len(policy.grants) != before


def remove_user_grant(policy: Policy, user_email: str, path: str) -> bool:
    """Convenience wrapper for removing a single-user grant."""
    return remove_grant(policy, "user", user_email, path)


def sync_github_collaborators(policy: Policy, access_token: str) -> list[dict[str, Any]]:
    """Refresh grants from the GitHub collaborator list.

    admin            -> manager + full access
    maintain / push  -> full access
    pull / triage    -> graph access (visible in MY PROJECTS, source locked)

    Collaborators whose GitHub login matches a registered CodeAtlas account
    automatically get access here, so the project appears in their project
    list without any manual step.

    Returns the collaborator snapshot for the caller to log.
    """
    import json
    import urllib.error
    import urllib.request

    url = f"https://api.github.com/repos/{policy.github_owner}/{policy.github_repo}/collaborators?per_page=100"
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {access_token}",
        "User-Agent": "CodeAtlas",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        collaborators = json.loads(response.read().decode("utf-8"))

    login_to_email = {
        user.get("github_login"): email
        for email, user in list_users_file().items()
        if user.get("github_login")
    }

    full = {"metadata": True, "graph": True, "source": True, "download": True}
    graph_only = {"metadata": True, "graph": True, "source": False, "download": False}
    snapshot = []
    github_collaborators: list[dict[str, Any]] = []
    managers: list[str] = []
    matched: list[str] = []
    for collaborator in collaborators:
        login = collaborator.get("login", "")
        permissions = collaborator.get("permissions", {})
        email = login_to_email.get(login)
        level = "admin" if permissions.get("admin") else (
            "push" if permissions.get("push") else "pull"
        )
        snapshot.append({"login": login, "permission": level})
        github_collaborators.append(
            {"login": login, "permission": level, "email": email or ""}
        )
        if not email:
            continue
        matched.append(email)
        if permissions.get("admin"):
            managers.append(email)
            set_user_grant(policy, email, "", "allow", full)
        elif permissions.get("push"):
            set_user_grant(policy, email, "", "allow", full)
        else:
            set_user_grant(policy, email, "", "allow", graph_only)
    # Drop access for collaborators who were removed from GitHub or no longer
    # match an account; keep every other grant untouched.
    for previous in policy.collaborators:
        if previous not in matched:
            remove_user_grant(policy, previous, "")
    policy.collaborators = matched
    policy.managers = list(dict.fromkeys(managers))
    policy.github_collaborators = github_collaborators
    save_policy(policy)
    return snapshot


# ── authorized search (Phase 3) ──────────────────────────────────────────────
def search_metadata(
    result: dict[str, Any],
    user_email: str,
    role: str | None,
    policy: Policy,
    query: str,
    team_ids: set[str] | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Search node names/paths, returning only nodes the user may *know about*.

    Metadata access gates whether the node appears at all; each result carries
    its access state so the UI can mark source-accessible matches separately.
    """
    needle = query.strip().lower()
    if not needle:
        return []
    hits: list[dict[str, Any]] = []
    for node in result.get("nodes", []):
        path = node.get("path", "")
        access = policy.effective_access(user_email, role, path, team_ids)
        if not access["metadata"]:
            continue
        name = (node.get("name") or "").lower()
        if needle in path.lower() or needle in name:
            hits.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name"),
                    "path": path,
                    "type": node.get("type"),
                    "language": node.get("language"),
                    "access": access,
                }
            )
            if len(hits) >= limit:
                break
    return hits


# ── authorized exports (Phase 3) ─────────────────────────────────────────────
def authorized_export(
    result: dict[str, Any],
    user_email: str,
    role: str | None,
    policy: Policy,
    fmt: str = "json",
    team_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Export a repository in a way that respects permissions (§30).

    - "json": the same filtered payload the graph endpoint returns (nodes carry
      access flags; source intelligence stripped for restricted nodes).
    - "report": a metadata-only architecture report (no source bytes at all).
    """
    if fmt == "report":
        return _architecture_report(result, user_email, role, policy, team_ids)
    return authorized_graph(result, user_email, role, policy, team_ids)


def _architecture_report(
    result: dict[str, Any],
    user_email: str,
    role: str | None,
    policy: Policy,
    team_ids: set[str] | None,
) -> dict[str, Any]:
    visible = [
        node
        for node in result.get("nodes", [])
        if policy.effective_access(user_email, role, node.get("path", ""), team_ids)["metadata"]
    ]
    source_allowed = [
        node
        for node in visible
        if policy.effective_access(user_email, role, node.get("path", ""), team_ids)["source"]
    ]
    node_paths = {node.get("path", "") for node in visible}
    source_paths = {node.get("path", "") for node in source_allowed}
    analysis = _filter_analysis(result.get("analysis") or {}, node_paths, source_paths)
    edges = result.get("edges", [])
    alive = {node.get("id") for node in visible}
    filtered_edges = [
        edge for edge in edges if edge.get("source") in alive and edge.get("target") in alive
    ]
    return {
        "project_id": policy.project_id,
        "project": policy.project,
        "owner_email": policy.owner_email,
        "format": "architecture-report",
        "generated_at": round(time.time(), 3),
        "access": {
            "files": sum(1 for n in visible if n.get("type") == "file"),
            "folders": sum(1 for n in visible if n.get("type") == "folder"),
            "source_accessible_files": len(source_allowed),
            "restricted_files": sum(1 for n in visible if n.get("type") == "file" and not n.get("access", {}).get("source", True)),
        },
        "languages": dict(sorted(
            (Counter(node.get("language") for node in visible if node.get("language"))).items()
        )),
        "edges": len(filtered_edges),
        "import_chains": analysis.get("longest_import_chain"),
        "circular_dependencies": analysis.get("circular_dependencies"),
        "orphan_files": analysis.get("orphan_files"),
        "largest_file": analysis.get("largest_file"),
        "smallest_file": analysis.get("smallest_file"),
        "nodes": [
            {
                "name": node.get("name"),
                "path": node.get("path"),
                "type": node.get("type"),
                "language": node.get("language"),
                "access": policy.effective_access(user_email, role, node.get("path", ""), team_ids),
            }
            for node in visible
        ],
    }


# ── Phase 4: sensitive information protection ────────────────────────────────
def save_project_secrets(project_id: str, secrets: list[dict[str, Any]]) -> None:
    """Persist secret findings from the upload-time scan so managers can review
    them without re-scanning. The raw secret VALUES are not stored — only the
    type, location, and a truncated fingerprint."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = _sanitize_project_id(project_id)
    path = PROJECTS_DIR / f"{safe_id}.secrets.json"
    redacted = [
        {
            "file": finding.get("file", ""),
            "line": finding.get("line"),
            "label": finding.get("label", "Secret"),
            "severity": "high",
            "preview": _redact_secret(finding.get("value", "")),
        }
        for finding in (secrets or [])
    ]
    path.write_text(json.dumps(redacted, indent=2), encoding="utf-8")


def load_project_secrets(project_id: str) -> list[dict[str, Any]]:
    safe_id = _sanitize_project_id(project_id)
    path = PROJECTS_DIR / f"{safe_id}.secrets.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _redact_secret(value: str) -> str:
    """Return only a prefix + fingerprint of a detected secret value, never the
    value itself."""
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    import hashlib

    fingerprint = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return f"{value[:2]}••••••••{fingerprint}"


# ── Phase 5: audit log viewer ────────────────────────────────────────────────
def list_audit_events(
    limit: int = 100,
    action: str | None = None,
    email: str | None = None,
) -> list[dict[str, Any]]:
    """Return the most recent audit events (newest first)."""
    if not AUDIT_FILE.exists():
        return []
    events: list[dict[str, Any]] = []
    try:
        with open(AUDIT_FILE, "r", encoding="utf-8") as file:
            for order, line in enumerate(file):
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if action and event.get("action") != action:
                    continue
                if email and event.get("email") != email:
                    continue
                event["_order"] = order
                events.append(event)
    except OSError:
        return []
    events.sort(key=lambda event: (event.get("ts", 0), event.get("_order", 0)), reverse=True)
    for event in events:
        event.pop("_order", None)
    return events[:limit]


# ── Phase 5: anomaly detection ───────────────────────────────────────────────
def record_security_event(event: dict[str, Any]) -> None:
    with POLICY_LOCK:
        events: dict[str, Any] = {}
        if SECURITY_EVENTS_FILE.exists():
            try:
                events = json.loads(SECURITY_EVENTS_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                events = {}
        events[event["id"]] = event
        SECURITY_EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        SECURITY_EVENTS_FILE.write_text(json.dumps(events, indent=2), encoding="utf-8")


def list_security_events(limit: int = 100) -> list[dict[str, Any]]:
    if not SECURITY_EVENTS_FILE.exists():
        return []
    try:
        events = json.loads(SECURITY_EVENTS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    result = sorted(events.values(), key=lambda event: event.get("ts", 0), reverse=True)
    return result[:limit]


def detect_anomalies(
    window: float = 60.0,
    denied_threshold: int = 10,
    login_threshold: int = 5,
) -> list[dict[str, Any]]:
    """Scan the audit trail for suspicious behaviour (§22).

    Signals: a burst of denied file accesses by one user, rapid enumeration of
    many distinct restricted paths, and repeated failed logins. Emits at most
    one alert per signal per sliding window, and persists them.
    """
    if not AUDIT_FILE.exists():
        return []
    events: list[dict[str, Any]] = []
    try:
        with open(AUDIT_FILE, "r", encoding="utf-8") as file:
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

    now = time.time()
    alerts: list[dict[str, Any]] = []
    active = [event for event in events if now - event.get("ts", 0) <= window]

    # 1. Excessive denied access attempts by one user.
    denied_by_user: dict[str, list[dict[str, Any]]] = {}
    for event in active:
        if event.get("action") == "file.denied":
            denied_by_user.setdefault(event.get("email", ""), []).append(event)
    for email, denied in denied_by_user.items():
        if len(denied) >= denied_threshold:
            alerts.append(_make_alert("enumeration", email, window, {
                "denied_count": len(denied),
                "resources": [event.get("resource", "") for event in denied[:25]],
            }))

    # 2. Rapid enumeration of many distinct restricted resources.
    distinct = {event.get("resource", "") for event in active if event.get("action") == "file.denied"}
    if len(distinct) >= denied_threshold * 2:
        alerts.append(_make_alert("path_sweep", "", window, {"distinct_resources": len(distinct)}))

    # 3. Repeated failed logins.
    failed = [event for event in active if event.get("action") == "auth.login_failed"]
    failed_by_user: dict[str, int] = {}
    for event in failed:
        failed_by_user[event.get("email", "")] = failed_by_user.get(event.get("email", ""), 0) + 1
    for email, count in failed_by_user.items():
        if count >= login_threshold:
            alerts.append(_make_alert("brute_force", email, window, {"failed_logins": count}))

    return alerts


def _make_alert(kind: str, email: str, window: float, detail: dict[str, Any]) -> dict[str, Any]:
    import uuid as _uuid

    alert = {
        "id": _uuid.uuid4().hex,
        "kind": kind,
        "severity": "high" if kind in ("brute_force",) else "medium",
        "email": email,
        "ts": round(time.time(), 3),
        "window_seconds": window,
        "detail": detail,
    }
    record_security_event(alert)
    return alert
