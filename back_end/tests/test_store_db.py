"""Integration tests for the PostgreSQL store backend (Phase 2).

These exercise `app.services.store` against a real database and only run when
DATABASE_URL is set:

    DATABASE_URL="postgresql://postgres:test@localhost:54329/codeatlas_test" \
        python -m unittest tests.test_store_db -v

They create the ca_* tables (store.init()) and reuse a fixed key space, so the
test database should be disposable.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import store  # noqa: E402


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "DATABASE_URL not set")
class PostgresStoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        store.init()

    def test_collection_round_trip(self) -> None:
        store.save_collection("policies", {"p1": {"owner_email": "a@x.com"}})
        loaded = store.load_collection("policies")
        self.assertEqual(loaded["p1"]["owner_email"], "a@x.com")

    def test_collection_pop(self) -> None:
        store.save_collection("teams", {"t1": {"name": "core"}, "t2": {"name": "ops"}})
        self.assertTrue(store.pop_collection("teams", "t1"))
        self.assertFalse(store.pop_collection("teams", "missing"))
        self.assertEqual(store.load_collection("teams"), {"t2": {"name": "ops"}})

    def test_audit_round_trip(self) -> None:
        marker = f"audit-{os.getpid()}-{time.time_ns()}"
        store.audit_append({"ts": 1.0, "email": "a@x.com", "action": "graph.read", "resource": "p1", "detail": {"marker": marker}})
        store.audit_append({"ts": 2.0, "email": "b@x.com", "action": "file.denied", "resource": "p1:f.py", "detail": {"marker": marker, "why": "deny"}})
        events = [
            event
            for event in store.audit_list()
            if event.get("detail", {}).get("marker") == marker
        ]
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["action"], "graph.read")
        self.assertEqual(events[-1]["action"], "file.denied")
        self.assertEqual(events[-1]["detail"]["why"], "deny")
        found = store.audit_find("b@x.com")
        self.assertIn(("file.denied", "p1:f.py"), found)

    def test_graph_round_trip_and_delete(self) -> None:
        graph = {"nodes": [{"id": 1}], "edges": []}
        store.save_graph("proj-g", graph)
        self.assertEqual(store.load_graph("proj-g"), graph)
        store.delete_graph("proj-g")
        self.assertIsNone(store.load_graph("proj-g"))

    def test_secrets_dict_and_legacy_list_shapes(self) -> None:
        store.save_secrets("proj-s", {"findings": [{"file": "a.py", "preview": "xx"}]})
        self.assertEqual(store.load_secrets("proj-s")["findings"][0]["file"], "a.py")
        store.save_secrets("proj-s2", [{"file": "b.py"}])
        self.assertEqual(store.load_secrets("proj-s2")["findings"], [{"file": "b.py"}])

    def test_secret_key_set_get(self) -> None:
        store.set_secret_key("key-1")
        self.assertEqual(store.get_secret_key(), "key-1")

    def test_migrate_from_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "projects").mkdir(parents=True)
            (base / "users.json").write_text(json.dumps({"a@x.com": {"role": "user"}}), encoding="utf-8")
            (base / "audit.jsonl").write_text(
                json.dumps({"ts": 1, "email": "a@x.com", "action": "x", "resource": "r", "detail": {}}) + "\n",
                encoding="utf-8",
            )
            (base / "projects" / "proj-1.json").write_text(json.dumps({"nodes": []}), encoding="utf-8")
            (base / "projects" / "proj-1.secrets.json").write_text(
                json.dumps([{"file": "f.py"}]), encoding="utf-8"
            )
            counts = store.migrate_from_files(base)
            self.assertEqual(counts["users"], 1)
            self.assertEqual(counts["audit"], 1)
            self.assertEqual(counts["graphs"], 1)
            self.assertEqual(counts["secrets"], 1)
            self.assertEqual(store.load_collection("users"), {"a@x.com": {"role": "user"}})
            self.assertEqual(store.load_graph("proj-1"), {"nodes": []})
            self.assertEqual(store.load_secrets("proj-1")["findings"], [{"file": "f.py"}])

    def test_unknown_collection_rejected(self) -> None:
        with self.assertRaises(KeyError):
            store.save_collection("nope", {})


if __name__ == "__main__":
    unittest.main()
