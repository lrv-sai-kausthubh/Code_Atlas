"""API-level security tests for CodeAtlas RBAC (Phase 1).

Run with:  python -m pytest tests/test_authorization_api.py -v
These verify that unauthorized data is ABSENT from API responses (not merely
hidden by the frontend): direct calls, param tampering, path traversal,
preview leakage, cross-repo existence leaks, and grant-management privilege
checks.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import authorization as authz  # noqa: E402

OWNER = "alice@example.com"
BOB = "bob@example.com"
CAROL = "carol@example.com"


@pytest.fixture()
def client(tmp_path, monkeypatch) -> TestClient:
    """Isolate all persistence to a temp dir and seed users/sessions."""
    authz.DATA_BASE = tmp_path
    authz.POLICIES_FILE = tmp_path / "policies.json"
    authz.AUDIT_FILE = tmp_path / "audit.jsonl"
    authz.PROJECTS_DIR = tmp_path / "projects"
    authz.TEAMS_FILE = tmp_path / "teams.json"
    authz.POLICY_VERSIONS_FILE = tmp_path / "policy_versions.json"
    authz.SECURITY_EVENTS_FILE = tmp_path / "security_events.json"
    authz.ORGANIZATIONS_FILE = tmp_path / "organizations.json"

    import app.api.routes as routes

    routes.PROJECTS_ROOT = tmp_path / "uploads"
    routes.PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)
    routes.PROJECT_STORES.clear()

    from app.api import auth as auth_module

    auth_module.USERS.clear()
    auth_module.SESSIONS.clear()
    for email in (OWNER, BOB, CAROL):
        auth_module.USERS[email] = {
            "name": email.split("@")[0],
            "email": email,
            "role": "owner" if email == OWNER else authz.DEFAULT_ROLE,
            "created_at": 0,
        }
    # token per user
    for email in (OWNER, BOB, CAROL):
        auth_module.SESSIONS[f"tok-{email.split('@')[0]}"] = {"email": email}

    return TestClient(app)


def _seed_project(project_id: str = "proj-1", uploads_root=None) -> str:
    """Write a graph + policy + sandbox files; returns the project root path."""
    root = uploads_root / project_id
    (root / "backend" / "secrets").mkdir(parents=True, exist_ok=True)
    (root / "backend" / "a.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    (root / "backend" / "secrets" / "key.txt").write_text("API_KEY=super-secret\n", encoding="utf-8")

    from app.api import routes

    routes.PROJECT_STORES[project_id] = {"root": root, "preview_files": []}

    result = {
        "project_id": project_id,
        "project": "demo",
        "nodes": [
            {"id": "root", "path": "", "type": "project", "label": "demo"},
            {"id": "folder:backend", "path": "backend", "type": "folder", "label": "backend"},
            {"id": "file:backend/a.py", "path": "backend/a.py", "type": "file", "label": "a.py", "language": "Python"},
            {"id": "file:backend/secrets/key.txt", "path": "backend/secrets/key.txt", "type": "file", "label": "key.txt", "language": "Other"},
        ],
        "edges": [
            {"id": "e1", "source": "root", "target": "folder:backend", "relation": "CONTAINS"},
            {"id": "e2", "source": "folder:backend", "target": "file:backend/a.py", "relation": "CONTAINS"},
            {"id": "e3", "source": "folder:backend", "target": "file:backend/secrets/key.txt", "relation": "CONTAINS"},
        ],
        "file_details": {
            "file:backend/a.py": {"functions": [{"name": "f", "snippet": "SOURCE"}]},
            "file:backend/secrets/key.txt": {"functions": [{"name": "g", "snippet": "SECRET"}]},
        },
        "function_calls": [],
        "analysis": {
            "security_issues": [{"file": "backend/secrets/key.txt", "snippet": "API_KEY=super-secret"}],
            "orphan_files": ["backend/secrets/key.txt"],
            "largest_file": {"path": "backend/secrets/key.txt", "size_bytes": 99},
            "smallest_file": {"path": "backend/a.py", "size_bytes": 1},
            "longest_import_chain": {"length": 1, "files": ["backend/secrets/key.txt"]},
            "circular_dependencies": [],
        },
        "files": 2,
        "folders": 1,
        "languages": {"Python": 1},
    }
    authz.save_project_graph(project_id, result)
    policy = authz.Policy(project_id, OWNER, "demo")
    authz.save_policy(policy)
    return str(root)


def test_graph_requires_auth(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get("/api/projects/proj-1/graph")
    assert response.status_code == 401


def test_unauthorized_user_gets_no_source(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get("/api/projects/proj-1/graph", params={"token": "tok-bob"})
    assert response.status_code == 200
    data = response.json()
    assert data["file_details"] == {}
    assert data["analysis"]["security_issues"] == []
    for node in data["nodes"]:
        if node["type"] == "file":
            assert node["access"]["source"] is False
            assert node["access"]["metadata"] is True


def test_owner_gets_full_graph(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get("/api/projects/proj-1/graph", params={"token": "tok-alice"})
    assert response.status_code == 200
    data = response.json()
    assert "file:backend/a.py" in data["file_details"]
    for node in data["nodes"]:
        assert node["access"]["source"] is True


def test_file_content_denied_for_unauthorized_user(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    )
    assert response.status_code == 403


def test_file_content_allowed_for_owner(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-alice", "path": "backend/a.py"},
    )
    assert response.status_code == 200
    assert "def f" in response.json()["content"]


def test_preview_denied_without_source_access(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.get(
        "/api/projects/proj-1/file",
        params={"token": "tok-bob", "path": "backend/a.py"},
    )
    assert response.status_code == 403


def test_path_traversal_rejected(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    for evil in ("../../etc/passwd", "..\\..\\secret.txt", "/etc/passwd"):
        response = client.get(
            "/api/projects/proj-1/file-content",
            params={"token": "tok-alice", "path": evil},
        )
        assert response.status_code == 400, evil


def test_guessing_unknown_project_404(client):
    response = client.get(
        "/api/projects/does-not-exist/graph", params={"token": "tok-alice"}
    )
    assert response.status_code == 404


def test_non_manager_cannot_manage_policy(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.post(
        "/api/projects/proj-1/grants",
        params={"token": "tok-bob"},
        json={"subject_value": BOB, "path": "", "effect": "allow",
              "permissions": {"metadata": True, "graph": True, "source": True, "download": True}},
    )
    assert response.status_code == 403


def test_owner_can_grant_and_recipient_gains_source(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.post(
        "/api/projects/proj-1/grants",
        params={"token": "tok-alice"},
        json={"subject_value": BOB, "path": "", "effect": "allow",
              "permissions": {"metadata": True, "graph": True, "source": True, "download": True}},
    )
    assert response.status_code == 200
    # Bob now sees source
    graph = client.get("/api/projects/proj-1/graph", params={"token": "tok-bob"}).json()
    assert graph["file_details"] != {}
    content = client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    )
    assert content.status_code == 200


def test_access_request_then_approve_grants_source(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    created = client.post(
        "/api/projects/proj-1/access-requests",
        data={"token": "tok-bob", "resource_path": "backend/a.py", "reason": "need to debug"},
    )
    assert created.status_code == 200
    request_id = created.json()["id"]

    # Bob still cannot read before approval
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 403

    # Owner approves
    approved = client.post(
        f"/api/projects/proj-1/access-requests/{request_id}",
        data={"token": "tok-alice", "action": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    # Now Bob has source access
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 200


def test_collaborator_sync_requires_github_policy(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.post(
        "/api/projects/proj-1/sync-collaborators",
        data={"token": "tok-alice"},
    )
    assert response.status_code == 400  # not a github-backed repo


# ── Phase 3: search ──────────────────────────────────────────────────────────
def test_search_metadata_hides_restricted_paths(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    # Only bob can know backend/secrets exists.
    policy = authz.load_policy("proj-1")
    policy.default_access = {"metadata": False, "graph": False, "source": False, "download": False}
    policy.grants.append(
        authz.Grant("user", BOB, "backend/secrets/", "allow",
                    {"metadata": True, "graph": True, "source": False, "download": False})
    )
    authz.save_policy(policy)

    # Bob can find secrets…
    response = client.get("/api/projects/proj-1/search",
                          params={"token": "tok-bob", "q": "key.txt", "scope": "metadata"})
    assert response.status_code == 200
    paths = [hit["path"] for hit in response.json()["results"]]
    assert "backend/secrets/key.txt" in paths

    # Carol (no metadata on secrets) cannot.
    response = client.get("/api/projects/proj-1/search",
                          params={"token": "tok-carol", "q": "key.txt", "scope": "metadata"})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_source_only_touches_accessible_files(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    # Bob has source only on backend/a.py, not on secrets.
    policy = authz.load_policy("proj-1")
    policy.grants.append(
        authz.Grant("user", BOB, "backend/a.py", "allow",
                    {"metadata": True, "graph": True, "source": True, "download": True})
    )
    authz.save_policy(policy)

    response = client.get("/api/projects/proj-1/search",
                          params={"token": "tok-bob", "q": "return 1", "scope": "source"})
    assert response.status_code == 200
    hits = response.json()["results"]
    assert any(hit["path"] == "backend/a.py" for hit in hits)
    # The secret value must never appear for bob.
    response = client.get("/api/projects/proj-1/search",
                          params={"token": "tok-bob", "q": "super-secret", "scope": "source"})
    assert response.status_code == 200
    assert response.json()["results"] == []


# ── Phase 3: exports ─────────────────────────────────────────────────────────
def test_export_report_never_contains_source(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    policy = authz.load_policy("proj-1")
    policy.grants.append(
        authz.Grant("user", BOB, "backend/secrets/", "allow",
                    {"metadata": True, "graph": True, "source": False, "download": False})
    )
    authz.save_policy(policy)
    response = client.get("/api/projects/proj-1/export",
                          params={"token": "tok-bob", "format": "report"})
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "architecture-report"
    assert "SOURCE" not in response.text
    assert "SECRET" not in response.text


# ── Phase 3: temporary access ────────────────────────────────────────────────
def test_temporary_approval_expires(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    created = client.post(
        "/api/projects/proj-1/access-requests",
        data={"token": "tok-bob", "resource_path": "backend/a.py", "reason": "temp"},
    )
    request_id = created.json()["id"]
    approved = client.post(
        f"/api/projects/proj-1/access-requests/{request_id}",
        data={"token": "tok-alice", "action": "temporary", "duration_hours": 1},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved_temporary"

    policy = authz.load_policy("proj-1")
    grant = next(g for g in policy.grants if g.subject_value == BOB)
    assert grant.expires_at is not None
    assert grant.expires_at > authz.time.time()

    # Force expiry: bob loses source access.
    grant.expires_at = authz.time.time() - 1
    authz.save_policy(policy)
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 403


# ── Phase 3: policy versioning ───────────────────────────────────────────────
def test_policy_versions_require_manager_and_restore(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    # Non-manager cannot list versions.
    response = client.get("/api/projects/proj-1/policy/versions",
                          params={"token": "tok-bob"})
    assert response.status_code == 403

    # Owner changes the policy (saves a version)…
    policy = authz.load_policy("proj-1")
    authz.set_user_grant(policy, BOB, "", "allow",
                         {"metadata": True, "graph": True, "source": True, "download": True})
    authz.save_policy(policy, actor=OWNER, note="grant bob")
    response = client.get("/api/projects/proj-1/policy/versions",
                          params={"token": "tok-alice"})
    assert response.status_code == 200
    versions = response.json()["versions"]
    assert len(versions) >= 1

    # Restore a version, then bob loses access.
    response = client.post(
        f"/api/projects/proj-1/policy/versions/{versions[0]['version']}/restore",
        data={"token": "tok-alice"},
    )
    assert response.status_code == 200
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 403


# ── Phase 2: teams ───────────────────────────────────────────────────────────
def test_teams_super_admin_only_and_team_grants(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)

    # Non-super-admin cannot manage teams.
    response = client.get("/api/teams", params={"token": "tok-alice"})
    assert response.status_code == 403

    # Promote carol to super_admin and create a team with bob.
    from app.api import auth as auth_module
    auth_module.USERS[CAROL]["role"] = "super_admin"
    created = client.post("/api/teams",
                          json={"name": "Backend", "members": [BOB]},
                          params={"token": "tok-carol"})
    assert created.status_code == 200
    team_id = created.json()["id"]

    # Grant the team source access on backend/a.py.
    policy = authz.load_policy("proj-1")
    authz.set_grant(policy, "team", team_id, "backend/a.py", "allow",
                    {"metadata": True, "graph": True, "source": True, "download": True})
    authz.save_policy(policy, actor=OWNER, note="team grant")

    # Bob inherits via the team.
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 200

    # Remove bob from the team -> access disappears.
    client.put(f"/api/teams/{team_id}",
               json={"name": "Backend", "members": []},
               params={"token": "tok-carol"})
    assert client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    ).status_code == 403


# ── Phase 2: default access configuration ────────────────────────────────────
def test_configure_default_access(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    response = client.put(
        "/api/projects/proj-1/policy/default",
        params={"token": "tok-alice"},
        json={"permissions": {"metadata": False, "graph": False}},
    )
    assert response.status_code == 200
    policy = authz.load_policy("proj-1")
    assert policy.default_access["metadata"] is False
    assert policy.default_access["graph"] is False
    assert policy.default_access["source"] is False


# ── Phase 4: secrets review ──────────────────────────────────────────────────
def test_secrets_endpoint_manager_only_and_redacted(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    authz.save_project_secrets(
        "proj-1",
        [{"file": "backend/secrets/key.txt", "line": 1, "label": "API Key / Token", "value": "sk-live-abcdefghijklmnop"}],
    )
    # Non-manager gets 403.
    assert client.get("/api/projects/proj-1/secrets", params={"token": "tok-bob"}).status_code == 403
    # Owner sees redacted findings only.
    response = client.get("/api/projects/proj-1/secrets", params={"token": "tok-alice"})
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert "sk-live-abcdefghijklmnop" not in response.text
    assert "••" in response.json()["secrets"][0]["preview"]


# ── Phase 5: admin analytics / audit / security events ───────────────────────
def test_admin_endpoints_super_admin_only(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)
    # Non-super-admins are rejected.
    assert client.get("/api/admin/analytics", params={"token": "tok-alice"}).status_code == 403
    assert client.get("/api/admin/audit", params={"token": "tok-alice"}).status_code == 403

    from app.api import auth as auth_module
    auth_module.USERS[CAROL]["role"] = "super_admin"

    response = client.get("/api/admin/analytics", params={"token": "tok-carol"})
    assert response.status_code == 200
    body = response.json()
    assert body["repositories"] >= 1
    assert body["users"] == 3

    response = client.get("/api/admin/audit", params={"token": "tok-carol", "limit": 20})
    assert response.status_code == 200
    assert isinstance(response.json()["events"], list)

    # Trigger denials then ask for security events.
    for index in range(12):
        client.get("/api/projects/proj-1/file-content",
                   params={"token": "tok-bob", "path": f"backend/missing-{index}.py"})
    response = client.get("/api/admin/security-events", params={"token": "tok-carol"})
    assert response.status_code == 200
    assert response.json()["events"]  # alerts persisted
    assert response.json()["new_alerts"]  # enumeration detected


# ── Phase 5: organizations (multi-tenant) ────────────────────────────────────
def test_organizations_gate_access_and_preview(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)

    from app.api import auth as auth_module
    auth_module.USERS[CAROL]["role"] = "super_admin"

    # Create an org owned by Carol with Bob as a member; Alice is outside.
    created = client.post(
        "/api/organizations",
        json={"name": "Acme", "members": [BOB]},
        params={"token": "tok-carol"},
    )
    assert created.status_code == 200
    org_id = created.json()["id"]

    # Attach proj-1 to the org.
    assert client.post(
        f"/api/organizations/{org_id}/projects/proj-1",
        params={"token": "tok-carol"},
    ).status_code == 200

    # Members still have access; Alice (non-member) is locked out.
    assert client.get(
        "/api/projects/proj-1/graph",
        params={"token": "tok-bob"},
    ).status_code == 200
    assert client.get("/api/projects/proj-1", params={"token": "tok-alice"}).status_code == 404
    assert client.get("/api/projects/proj-1/graph", params={"token": "tok-alice"}).status_code == 404

    # Detach -> Alice sees it again.
    assert client.delete(
        f"/api/organizations/{org_id}/projects/proj-1",
        params={"token": "tok-carol"},
    ).status_code == 200
    assert client.get("/api/projects/proj-1", params={"token": "tok-alice"}).status_code == 200


def test_organization_management_permissions(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)

    from app.api import auth as auth_module
    auth_module.USERS[CAROL]["role"] = "super_admin"

    # Only super admins can create orgs.
    assert client.post(
        "/api/organizations", json={"name": "No"},
        params={"token": "tok-alice"},
    ).status_code == 403

    created = client.post(
        "/api/organizations",
        json={"name": "Acme", "members": []},
        params={"token": "tok-carol"},
    )
    org_id = created.json()["id"]

    # Only owner/super admin can manage.
    assert client.put(
        f"/api/organizations/{org_id}",
        json={"name": "Acme2"},
        params={"token": "tok-bob"},
    ).status_code == 403
    updated = client.put(
        f"/api/organizations/{org_id}",
        json={"name": "Acme2"},
        params={"token": "tok-carol"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Acme2"

    # Listing hides orgs you don't belong to.
    listed = client.get("/api/organizations", params={"token": "tok-bob"}).json()["organizations"]
    assert listed == []
    assert client.get("/api/organizations", params={"token": "tok-carol"}).json()["organizations"]

    assert client.delete(f"/api/organizations/{org_id}", params={"token": "tok-carol"}).status_code == 200
    assert client.get("/api/organizations", params={"token": "tok-carol"}).json()["organizations"] == []


# ── Phase 5: admin permission preview ────────────────────────────────────────
def test_admin_permission_preview(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)

    from app.api import auth as auth_module
    auth_module.USERS[CAROL]["role"] = "super_admin"

    # Non-super-admins are rejected.
    assert client.get("/api/admin/effective-permissions", params={"token": "tok-alice"}).status_code == 403
    assert client.get("/api/admin/preview-graph", params={"token": "tok-alice"}).status_code == 403

    # Unknown target user -> 404.
    assert client.get(
        "/api/admin/effective-permissions",
        params={"token": "tok-carol", "email": "ghost@example.com", "project_id": "proj-1"},
    ).status_code == 404

    # Bob is a plain viewer on proj-1 (owned by Alice, no grants).
    preview = client.get(
        "/api/admin/effective-permissions",
        params={"token": "tok-carol", "email": BOB, "project_id": "proj-1"},
    )
    assert preview.status_code == 200
    body = preview.json()
    assert body["email"] == BOB
    assert body["role"] == authz.DEFAULT_ROLE
    assert body["effective_access"]["metadata"] is True
    assert body["effective_access"]["source"] is False

    # Grant Bob source access, then preview reflects it without changing state.
    client.post(
        "/api/projects/proj-1/grants",
        params={"token": "tok-alice"},
        json={"subject_value": BOB, "path": "backend", "effect": "allow",
              "permissions": {"metadata": False, "graph": False, "source": True, "download": False}},
    )
    preview = client.get(
        "/api/admin/effective-permissions",
        params={"token": "tok-carol", "email": BOB, "project_id": "proj-1"},
    )
    assert preview.json()["effective_access"]["source"] is True

    graph = client.get(
        "/api/admin/preview-graph",
        params={"token": "tok-carol", "email": BOB, "project_id": "proj-1"},
    )
    assert graph.status_code == 200
    assert graph.json()["_previewed_as"] == BOB


# ── Phase 5: time-windowed grants ───────────────────────────────────────────
def test_time_windowed_grant_endpoint(client):
    import app.api.routes as routes
    _seed_project("proj-1", routes.PROJECTS_ROOT)

    # Invalid windows are rejected with 422.
    bad = client.post(
        "/api/projects/proj-1/grants",
        params={"token": "tok-alice"},
        json={"subject_value": BOB, "path": "", "effect": "allow",
              "permissions": {"metadata": True, "graph": True, "source": True, "download": True},
              "windows": [{"days": [0], "start": "25:00", "end": "17:00"}]},
    )
    assert bad.status_code == 422

    # An always-on window (all days, full day) grants source immediately.
    response = client.post(
        "/api/projects/proj-1/grants",
        params={"token": "tok-alice"},
        json={"subject_value": BOB, "path": "", "effect": "allow",
              "permissions": {"metadata": True, "graph": True, "source": True, "download": True},
              "windows": [{"days": [0, 1, 2, 3, 4, 5, 6], "start": "00:00", "end": "23:59"}]},
    )
    assert response.status_code == 200
    assert response.json()["grants"][0]["windows"][0]["start"] == 0
    assert response.json()["grants"][0]["windows"][0]["end"] == 1439

    content = client.get(
        "/api/projects/proj-1/file-content",
        params={"token": "tok-bob", "path": "backend/a.py"},
    )
    assert content.status_code == 200
