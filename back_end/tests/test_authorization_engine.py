"""Security tests for the CodeAtlas RBAC engine (Phase 1).

These exercise the pure authorization model (no HTTP) and can be run with
`python -m unittest tests/test_authorization_engine.py` using only the stdlib.
"""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import authorization as authz  # noqa: E402

OWNER = "alice@example.com"
BOB = "bob@example.com"
CAROL = "carol@example.com"


def _isolate() -> Path:
    tmp = Path(tempfile.mkdtemp())
    authz.DATA_BASE = tmp
    authz.POLICIES_FILE = tmp / "policies.json"
    authz.AUDIT_FILE = tmp / "audit.jsonl"
    authz.PROJECTS_DIR = tmp / "projects"
    authz.TEAMS_FILE = tmp / "teams.json"
    authz.POLICY_VERSIONS_FILE = tmp / "policy_versions.json"
    authz.SECURITY_EVENTS_FILE = tmp / "security_events.json"
    authz.ORGANIZATIONS_FILE = tmp / "organizations.json"
    return tmp


def _policy() -> authz.Policy:
    policy = authz.Policy("proj-1", OWNER, "demo")
    # Bob has source access under backend/ but an explicit deny under backend/secrets/
    policy.grants.append(
        authz.Grant("user", BOB, "backend/", "allow",
                    {"metadata": True, "graph": True, "source": True, "download": True})
    )
    policy.grants.append(
        authz.Grant("user", BOB, "backend/secrets/", "deny",
                    {"metadata": True, "graph": True, "source": True, "download": True})
    )
    return policy


class EngineResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_owner_has_full_access(self) -> None:
        policy = _policy()
        self.assertTrue(policy.effective_access(OWNER, "viewer", "backend/secrets/key.txt")["source"])

    def test_super_admin_has_no_implicit_access(self) -> None:
        # super_admin grants no implicit access in per-project views; global
        # powers live only in the Admin Center endpoints.
        policy = _policy()
        self.assertFalse(policy.effective_access(CAROL, "super_admin", "backend/secrets/key.txt")["source"])
        self.assertFalse(policy.effective_access(CAROL, "super_admin", "backend/services/pay.py")["source"])

    def test_granted_user_sees_source(self) -> None:
        policy = _policy()
        access = policy.effective_access(BOB, "viewer", "backend/services/pay.py")
        self.assertTrue(access["source"])
        self.assertTrue(access["metadata"])
        self.assertTrue(access["graph"])

    def test_unauthorized_user_falls_back_to_default(self) -> None:
        policy = _policy()
        access = policy.effective_access(CAROL, "viewer", "backend/a.py")
        self.assertTrue(access["metadata"])
        self.assertTrue(access["graph"])
        self.assertFalse(access["source"])
        self.assertFalse(access["download"])

    def test_explicit_deny_overrides_inherited_allow(self) -> None:
        policy = _policy()
        access = policy.effective_access(BOB, "viewer", "backend/secrets/key.txt")
        self.assertFalse(access["source"])
        self.assertFalse(access["metadata"])

    def test_cross_repository_access_denied(self) -> None:
        policy = _policy()
        other = authz.Policy("other-proj", "mallory@example.com", "other")
        self.assertFalse(other.effective_access(BOB, "viewer", "")["source"])
        self.assertTrue(policy.effective_access(BOB, "viewer", "")["metadata"])

    def test_download_flag_independent_of_source(self) -> None:
        policy = _policy()
        policy.grants = [g for g in policy.grants if not (g.subject_value == BOB and g.path == "backend/")]
        policy.grants.append(
            authz.Grant("user", BOB, "", "allow",
                        {"metadata": True, "graph": True, "source": True, "download": False})
        )
        access = policy.effective_access(BOB, "viewer", "backend/a.py")
        self.assertTrue(access["source"])
        self.assertFalse(access["download"])

    def test_path_traversal_does_not_match_grant(self) -> None:
        policy = _policy()
        # "../../etc/passwd" must not match the "backend/" grant.
        access = policy.effective_access(BOB, "viewer", "../../etc/passwd")
        self.assertFalse(access["source"])

    def test_explanation_is_derivable(self) -> None:
        policy = _policy()
        explanation = policy.explanation(BOB, "viewer", "backend/secrets/key.txt")
        self.assertIn("steps", explanation)
        self.assertEqual(explanation["steps"][0]["effect"], "deny")


class EngineGraphFilterTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def _result(self) -> dict:
        return {
            "project_id": "proj-1",
            "project": "demo",
            "nodes": [
                {"id": "root", "path": "", "type": "project", "label": "demo"},
                {"id": "folder:backend", "path": "backend", "type": "folder", "label": "backend"},
                {"id": "folder:secrets", "path": "backend/secrets", "type": "folder", "label": "secrets"},
                {"id": "file:backend/a.py", "path": "backend/a.py", "type": "file", "label": "a.py"},
                {"id": "file:backend/secrets/key.txt", "path": "backend/secrets/key.txt", "type": "file", "label": "key.txt"},
            ],
            "edges": [
                {"id": "e1", "source": "root", "target": "folder:backend", "relation": "CONTAINS"},
                {"id": "e2", "source": "folder:backend", "target": "file:backend/a.py", "relation": "CONTAINS"},
                {"id": "e3", "source": "folder:backend", "target": "folder:secrets", "relation": "CONTAINS"},
                {"id": "e4", "source": "folder:secrets", "target": "file:backend/secrets/key.txt", "relation": "CONTAINS"},
            ],
            "file_details": {
                "file:backend/a.py": {"functions": [{"name": "f", "snippet": "SOURCE"}]},
                "file:backend/secrets/key.txt": {"functions": [{"name": "g", "snippet": "SECRET"}]},
            },
            "function_calls": [
                {"caller_file": "backend/a.py", "callee_name": "f"},
                {"caller_file": "backend/secrets/key.txt", "callee_name": "g"},
            ],
            "analysis": {
                "security_issues": [
                    {"file": "backend/secrets/key.txt", "snippet": "API_KEY=..."},
                    {"file": "backend/a.py", "snippet": "placeholder"},
                ],
                "orphan_files": ["backend/secrets/key.txt"],
                "largest_file": {"path": "backend/secrets/key.txt", "size_bytes": 99},
                "smallest_file": {"path": "backend/a.py", "size_bytes": 1},
                "longest_import_chain": {"length": 1, "files": ["backend/secrets/key.txt"]},
                "circular_dependencies": [["backend/secrets/key.txt"]],
            },
            "files": 2,
            "folders": 2,
            "languages": {},
        }

    def test_authorized_user_gets_source_intelligence(self) -> None:
        out = authz.authorized_graph(self._result(), BOB, "viewer", _policy())
        self.assertIn("file:backend/a.py", out["file_details"])
        self.assertEqual(len(out["function_calls"]), 1)

    def test_source_denied_user_gets_no_source_bytes(self) -> None:
        out = authz.authorized_graph(self._result(), CAROL, "viewer", _policy())
        self.assertEqual(out["file_details"], {})
        self.assertEqual(out["function_calls"], [])
        for node in out["nodes"]:
            if node["type"] == "file":
                self.assertFalse(node["access"]["source"])

    def test_metadata_denied_node_is_hidden(self) -> None:
        out = authz.authorized_graph(self._result(), BOB, "viewer", _policy())
        ids = {node["id"] for node in out["nodes"]}
        self.assertNotIn("file:backend/secrets/key.txt", ids)
        self.assertNotIn("folder:secrets", ids)
        # edges to hidden nodes are pruned
        for edge in out["edges"]:
            self.assertIn(edge["source"], ids)
            self.assertIn(edge["target"], ids)

    def test_secret_snippets_never_leak_to_unauthorized_users(self) -> None:
        out = authz.authorized_graph(self._result(), CAROL, "viewer", _policy())
        # Snippets are source-derived and must never reach a source-denied user.
        self.assertEqual(out["analysis"]["security_issues"], [])
        # Metadata-derived paths are allowed (CAROL knows the file exists) but
        # they must never leak beyond the metadata-visible set.
        visible = {node["path"] for node in out["nodes"]}
        self.assertTrue(set(out["analysis"]["orphan_files"]).issubset(visible))
        if out["analysis"]["largest_file"]:
            self.assertIn(out["analysis"]["largest_file"]["path"], visible)

    def test_node_access_annotation_present(self) -> None:
        out = authz.authorized_graph(self._result(), BOB, "viewer", _policy())
        for node in out["nodes"]:
            self.assertIn("access", node)
            for flag in authz.PERMISSION_FLAGS:
                self.assertIn(flag, node["access"])


class PolicyStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_round_trip(self) -> None:
        policy = _policy()
        authz.save_policy(policy)
        loaded = authz.load_policy("proj-1")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.to_dict(), policy.to_dict())

    def test_set_and_remove_grant(self) -> None:
        policy = _policy()
        authz.set_user_grant(policy, CAROL, "", "allow",
                             {"metadata": True, "graph": True, "source": True, "download": True})
        self.assertTrue(policy.effective_access(CAROL, "viewer", "backend/a.py")["source"])
        self.assertTrue(authz.remove_user_grant(policy, CAROL, ""))
        self.assertFalse(policy.effective_access(CAROL, "viewer", "backend/a.py")["source"])

    def test_audit_event_written(self) -> None:
        authz.audit(OWNER, "grant.upsert", "proj-1:bob")
        self.assertTrue(authz.AUDIT_FILE.exists())
        line = authz.AUDIT_FILE.read_text(encoding="utf-8").strip()
        self.assertIn("grant.upsert", line)


class TeamAccessTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_team_grant_applies_to_members(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(
            authz.Grant("team", "team-backend", "backend/", "allow",
                        {"metadata": True, "graph": True, "source": True, "download": True})
        )
        # Non-member has no access even though the grant exists.
        self.assertFalse(policy.effective_access(BOB, "viewer", "backend/a.py")["source"])
        # Member of the team inherits the grant.
        self.assertTrue(
            policy.effective_access(BOB, "viewer", "backend/a.py", {"team-backend"})["source"]
        )
        # A more specific deny on the team wins over the inherited allow.
        policy.grants.append(
            authz.Grant("team", "team-backend", "backend/secrets/", "deny",
                        {"metadata": True, "graph": True, "source": True, "download": True})
        )
        self.assertFalse(
            policy.effective_access(BOB, "viewer", "backend/secrets/key.txt", {"team-backend"})["source"]
        )

    def test_team_store_round_trip(self) -> None:
        authz.save_team({"id": "team-1", "name": "Backend", "members": [BOB], "created_at": 1})
        self.assertEqual(authz.user_team_ids(BOB), {"team-1"})
        self.assertNotIn("team-1", authz.user_team_ids(CAROL))
        self.assertTrue(authz.delete_team("team-1"))
        self.assertEqual(authz.user_team_ids(BOB), set())


class TemporaryAccessTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_grant_expires_automatically(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(
            authz.Grant("user", BOB, "", "allow",
                        {"metadata": True, "graph": True, "source": True, "download": True},
                        expires_at=authz.time.time() + 100)
        )
        self.assertTrue(policy.effective_access(BOB, "viewer", "backend/a.py")["source"])
        # Force expiry.
        policy.grants[0].expires_at = authz.time.time() - 1
        self.assertFalse(policy.effective_access(BOB, "viewer", "backend/a.py")["source"])
        # Expired grant does not shadow the default (metadata still visible).
        self.assertTrue(policy.effective_access(BOB, "viewer", "backend/a.py")["metadata"])

    def test_explanation_includes_expiry(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        authz.set_user_grant(policy, BOB, "backend/", "allow",
                             {"metadata": True, "graph": True, "source": True, "download": True},
                             expires_at=authz.time.time() + 60)
        explanation = policy.explanation(BOB, "viewer", "backend/a.py")
        self.assertIn("expires_at", str(explanation["steps"]))


class PolicyVersioningTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_save_records_history_and_restore(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        authz.save_policy(policy, actor=OWNER, note="initial")
        policy = authz.load_policy("proj-1")
        self.assertIsNotNone(policy)
        authz.set_user_grant(policy, BOB, "", "allow",
                             {"metadata": True, "graph": True, "source": True, "download": True})
        authz.save_policy(policy, actor=OWNER, note="grant bob")

        versions = authz.list_policy_versions("proj-1")
        self.assertGreaterEqual(len(versions), 1)
        latest = authz.load_policy("proj-1")
        self.assertIsNotNone(latest)
        self.assertTrue(latest.effective_access(BOB, "viewer", "backend/a.py")["source"])

        # Restore the first version (no bob grant).
        restored = authz.restore_policy_version("proj-1", 1, actor=OWNER)
        self.assertIsNotNone(restored)
        self.assertFalse(restored.effective_access(BOB, "viewer", "backend/a.py")["source"])

    def test_invalid_version_returns_none(self) -> None:
        self.assertIsNone(authz.restore_policy_version("proj-1", 99))


class SearchAndExportTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def _graph(self) -> dict:
        return {
            "nodes": [
                {"id": "f1", "name": "checkout.ts", "path": "frontend/checkout.ts", "type": "file", "language": "TypeScript"},
                {"id": "f2", "name": "payment_service.py", "path": "backend/services/payment_service.py", "type": "file", "language": "Python"},
                {"id": "d1", "name": "secrets", "path": "backend/secrets", "type": "folder"},
            ],
            "edges": [
                {"source": "f1", "target": "f2", "type": "imports"},
            ],
            "file_details": {"f2": {"functions": ["pay()"], "snippets": ["def pay():"]}},
            "function_calls": [{"caller_file": "backend/services/payment_service.py"}],
            "analysis": {"orphan_files": ["backend/services/payment_service.py"], "security_issues": []},
        }

    def test_search_metadata_respects_access(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        # Metadata is hidden by default for non-members…
        policy.default_access = {"metadata": False, "graph": False, "source": False, "download": False}
        # …and BOB only knows about frontend/.
        policy.grants.append(
            authz.Grant("user", BOB, "frontend/", "allow",
                        {"metadata": True, "graph": True, "source": False, "download": False})
        )
        hits = authz.search_metadata(self._graph(), BOB, "viewer", policy, "checkout")
        self.assertEqual([h["path"] for h in hits], ["frontend/checkout.ts"])
        # Payment service must not leak via search.
        hits = authz.search_metadata(self._graph(), BOB, "viewer", policy, "payment")
        self.assertEqual(hits, [])
        # Owner sees everything.
        hits = authz.search_metadata(self._graph(), OWNER, "owner", policy, "payment")
        self.assertEqual([h["path"] for h in hits], ["backend/services/payment_service.py"])

    def test_export_json_strips_source_for_restricted(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(
            authz.Grant("user", BOB, "frontend/", "allow",
                        {"metadata": True, "graph": True, "source": False, "download": False})
        )
        export = authz.authorized_export(self._graph(), BOB, "viewer", policy, "json")
        # payment_service stays in the graph (metadata visible via default)…
        paths = {node["path"] for node in export["nodes"]}
        self.assertIn("backend/services/payment_service.py", paths)
        # …but its source intelligence is stripped.
        self.assertNotIn("f2", export.get("file_details", {}))

    def test_export_report_has_no_source(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        report = authz.authorized_export(self._graph(), BOB, "viewer", policy, "report")
        self.assertEqual(report["format"], "architecture-report")
        self.assertIn("files", report["access"])
        self.assertNotIn("snippets", str(report["nodes"]))
        # Report contains no file content fields.
        for node in report["nodes"]:
            self.assertNotIn("content", node)


class SecretProtectionTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_secrets_are_redacted(self) -> None:
        authz.save_project_secrets(
            "proj-1",
            [{"file": "backend/.env", "line": 2, "label": "API Key / Token", "value": "sk-live-abcdefghijklmnop"}],
        )
        loaded = authz.load_project_secrets("proj-1")
        self.assertEqual(len(loaded), 1)
        self.assertNotIn("sk-live-abcdefghijklmnop", loaded[0]["preview"])
        self.assertIn("••", loaded[0]["preview"])

    def test_no_secrets_returns_empty(self) -> None:
        self.assertEqual(authz.load_project_secrets("proj-1"), [])


class AuditAndAnomalyTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_audit_listing_sorted_newest_first(self) -> None:
        authz.audit(OWNER, "graph.read", "proj-1")
        authz.audit(BOB, "file.denied", "proj-1:backend/a.py")
        events = authz.list_audit_events(limit=10)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["email"], BOB)  # newest first

    def test_audit_filtering(self) -> None:
        authz.audit(OWNER, "graph.read", "proj-1")
        authz.audit(BOB, "file.denied", "proj-1:backend/a.py")
        denied = authz.list_audit_events(limit=10, action="file.denied")
        self.assertEqual(len(denied), 1)
        self.assertEqual(denied[0]["email"], BOB)

    def test_anomaly_detection_enumeration(self) -> None:
        # A burst of denials for the same user in the current window.
        for index in range(12):
            authz.audit(BOB, "file.denied", f"proj-1:file-{index}")
        alerts = authz.detect_anomalies(window=60, denied_threshold=10)
        kinds = {alert["kind"] for alert in alerts}
        self.assertIn("enumeration", kinds)
        # Alerts are persisted and can be listed.
        events = authz.list_security_events()
        self.assertGreaterEqual(len(events), 1)

    def test_anomaly_detection_brute_force(self) -> None:
        for _index in range(6):
            authz.audit(BOB, "auth.login_failed", BOB)
        alerts = authz.detect_anomalies(window=60, login_threshold=5)
        kinds = {alert["kind"] for alert in alerts}
        self.assertIn("brute_force", kinds)

    def test_no_anomalies_with_quiet_activity(self) -> None:
        authz.audit(OWNER, "graph.read", "proj-1")
        alerts = authz.detect_anomalies(window=60, denied_threshold=10)
        self.assertEqual(alerts, [])


class OrganizationTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_policy_org_access_gates_non_members(self) -> None:
        authz.save_organization({
            "id": "org-1",
            "name": "Acme",
            "owner_email": OWNER,
            "members": [CAROL],
            "project_ids": [],
            "created_at": 1,
        })
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.organization_id = "org-1"

        # Owner and members pass; outsiders are locked out.
        self.assertTrue(authz.policy_org_access(policy, OWNER, "viewer"))
        self.assertTrue(authz.policy_org_access(policy, CAROL, "viewer"))
        self.assertFalse(authz.policy_org_access(policy, BOB, "viewer"))
        # Super admin bypasses.
        self.assertTrue(authz.policy_org_access(policy, BOB, "super_admin"))
        # Repos without an org stay open.
        policy.organization_id = ""
        self.assertTrue(authz.policy_org_access(policy, BOB, "viewer"))

    def test_org_store_round_trip(self) -> None:
        authz.save_organization({
            "id": "org-1", "name": "Acme", "owner_email": OWNER,
            "members": [BOB], "project_ids": [], "created_at": 1,
        })
        self.assertIn("org-1", authz.user_org_ids(OWNER))
        self.assertIn("org-1", authz.user_org_ids(BOB))
        self.assertNotIn("org-1", authz.user_org_ids(CAROL))
        self.assertTrue(authz.delete_organization("org-1"))
        self.assertEqual(authz.user_org_ids(OWNER), set())


# ── Phase 5: time-windowed grants ───────────────────────────────────────────
def _ts_on_weekday(target_weekday: int, hour: int, minute: int = 0) -> float:
    """Epoch time of the next occurrence of a weekday (0=Mon) at hour:minute."""
    import datetime as _dt

    today = _dt.date.today()
    days_ahead = (target_weekday - today.weekday()) % 7
    target = today + _dt.timedelta(days=days_ahead)
    return _dt.datetime(target.year, target.month, target.day, hour, minute).timestamp()


class TimeWindowTests(unittest.TestCase):
    def setUp(self) -> None:
        _isolate()

    def test_grant_only_applies_inside_schedule(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(authz.Grant(
            subject_type="user", subject_value=BOB, path="backend",
            effect="allow",
            permissions={"metadata": False, "graph": False, "source": True, "download": False},
            windows=[{"days": [0, 1, 2, 3, 4], "start": 9 * 60, "end": 17 * 60}],
        ))
        inside = _ts_on_weekday(0, 10, 0)  # Monday 10:00
        self.assertTrue(policy.effective_access(BOB, "viewer", "backend/a.py", now=inside)["source"])
        outside = _ts_on_weekday(5, 12, 0)  # Saturday 12:00
        self.assertFalse(policy.effective_access(BOB, "viewer", "backend/a.py", now=outside)["source"])

    def test_overnight_window_spans_midnight(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(authz.Grant(
            subject_type="user", subject_value=BOB, path="",
            effect="allow",
            permissions={"metadata": False, "graph": False, "source": True, "download": False},
            windows=[{"days": [5], "start": 22 * 60, "end": 2 * 60}],  # Sat 22:00 -> Sun 02:00
        ))
        sat_night = _ts_on_weekday(5, 23, 0)
        self.assertTrue(policy.effective_access(BOB, "viewer", "", now=sat_night)["source"])
        sun_early = _ts_on_weekday(6, 1, 0)
        self.assertTrue(policy.effective_access(BOB, "viewer", "", now=sun_early)["source"])
        sat_evening = _ts_on_weekday(5, 21, 0)
        self.assertFalse(policy.effective_access(BOB, "viewer", "", now=sat_evening)["source"])
        sun_morning = _ts_on_weekday(6, 3, 0)
        self.assertFalse(policy.effective_access(BOB, "viewer", "", now=sun_morning)["source"])

    def test_validate_time_windows(self) -> None:
        cleaned = authz.validate_time_windows([{"days": [0, 1], "start": "09:00", "end": "17:00"}])
        self.assertEqual(cleaned, [{"days": [0, 1], "start": 540, "end": 1020}])
        self.assertEqual(authz.validate_time_windows([]), [])
        with self.assertRaises(ValueError):
            authz.validate_time_windows([{"days": [0], "start": "25:00", "end": "17:00"}])
        with self.assertRaises(ValueError):
            authz.validate_time_windows([{"days": [7], "start": "09:00", "end": "17:00"}])
        with self.assertRaises(ValueError):
            authz.validate_time_windows([{"days": [], "start": "09:00", "end": "17:00"}])

    def test_window_label(self) -> None:
        label = authz.window_label([{"days": [0, 1, 2, 3, 4], "start": 540, "end": 1020}])
        self.assertEqual(label, "MON/TUE/WED/THU/FRI 09:00-17:00")

    def test_windows_survive_policy_round_trip(self) -> None:
        policy = authz.Policy("proj-1", OWNER, "demo")
        policy.grants.append(authz.Grant(
            subject_type="user", subject_value=BOB, path="backend",
            effect="allow",
            permissions={"metadata": False, "graph": False, "source": True, "download": False},
            windows=[{"days": [0, 1], "start": 540, "end": 1020}],
        ))
        authz.save_policy(policy)
        loaded = authz.load_policy("proj-1")
        self.assertEqual(loaded.grants[0].windows, [{"days": [0, 1], "start": 540, "end": 1020}])


# ── Phase 5: GitHub identity / re-keying & org login matching ───────────────
class IdentityLinkingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = _isolate()
        # Registered members who were invited by their real email.
        self.member_email = "member@example.com"
        (authz.DATA_BASE / "users.json").write_text(
            json.dumps({
                self.member_email: {"email": self.member_email, "github_login": "member-gh"},
                "other@example.com": {"email": "other@example.com", "github_login": "other-gh"},
            }),
            encoding="utf-8",
        )

    def _seed_org(self, members: list[str], owner: str | None = None) -> str:
        org_id = "org-rekey"
        authz.save_organization({
            "id": org_id, "name": "Acme", "owner_email": owner or OWNER,
            "members": members, "project_ids": [], "created_at": 1,
        })
        return org_id

    def test_org_membership_matches_by_github_login(self) -> None:
        self._seed_org([self.member_email])
        noreply = "member@users.noreply.github.com"
        # No email match, but same GitHub login as the invited member.
        self.assertIn("org-rekey", authz.user_org_ids(noreply, "member-gh"))
        # Different login -> no match.
        self.assertNotIn("org-rekey", authz.user_org_ids(noreply, "other-gh"))
        self.assertEqual(authz.user_org_ids("stranger@example.com"), set())

    def test_rekey_user_email_updates_all_references(self) -> None:
        import json as _json

        old = "old@example.com"
        new = "new@example.com"
        policy = authz.Policy("proj-x", old, "demo")
        policy.managers = [old]
        policy.grants.append(authz.Grant(
            subject_type="user", subject_value=old, path="", effect="allow",
            permissions=authz._full_access(),
        ))
        authz.save_policy(policy)
        self._seed_org([old], owner=old)
        (authz.DATA_BASE / "teams.json").write_text(
            _json.dumps({"team-1": {"id": "team-1", "name": "T", "members": [old]}}),
            encoding="utf-8",
        )

        changes = authz.rekey_user_email(old, new)
        self.assertIn("policy.owner", changes)
        self.assertIn("org.owner", changes)
        self.assertIn("org.member", changes)
        self.assertIn("team.member", changes)

        loaded = authz.load_policy("proj-x")
        self.assertEqual(loaded.owner_email, new)
        self.assertEqual(loaded.managers, [new])
        self.assertEqual(loaded.grants[0].subject_value, new)
        org = authz.list_organizations()["org-rekey"]
        self.assertEqual(org["owner_email"], new)
        self.assertIn(new, org["members"])
        self.assertNotIn(old, org["members"])
        team = authz.list_teams()["team-1"]
        self.assertEqual(team["members"], [new])
        self.assertEqual(authz.rekey_user_email(new, new), [])


if __name__ == "__main__":
    unittest.main()
