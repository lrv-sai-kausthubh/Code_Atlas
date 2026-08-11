"""Tests for the Aura 1.0 ML service and deterministic brain.

Run with:  python -m pytest tests/test_aura_ml.py -v

The ML service degrades gracefully when scikit-learn is unavailable, so these
tests cover both the pure feature extractors and the fallback behaviour.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402

from app.services import authorization as authz  # noqa: E402
from app.services.aura import brain  # noqa: E402
from app.services.ml import features  # noqa: E402
from app.services.ml import model as aura_model  # noqa: E402


def _sample_analysis() -> dict:
    return {
        "total_lines": 1200,
        "total_size_bytes": 48000,
        "average_file_size_bytes": 800,
        "total_imports": 24,
        "average_dependencies": 1.6,
        "longest_import_chain": {"length": 4, "files": ["a", "b", "c", "d"]},
        "orphan_files": ["src/legacy.py"],
        "circular_dependencies": [["x.py", "y.py"]],
        "security_issues": [{"file": "cfg.py", "type": "API Key / Token"}],
        "largest_file": {"path": "big.py", "size_bytes": 1000, "lines": 400},
        "health_score": 74,
        "languages": {"ts": 3, "py": 2},
    }


def _sample_file_rows() -> list[dict]:
    return [
        {
            "path": "src/a.ts",
            "lines": 120,
            "size_bytes": 4000,
            "in_degree": 2,
            "out_degree": 3,
            "function_count": 5,
            "api_call_count": 1,
            "external_import_count": 2,
            "local_import_count": 2,
        },
        {
            "path": "src/b.py",
            "lines": 40,
            "size_bytes": 900,
            "in_degree": 0,
            "out_degree": 1,
            "function_count": 2,
            "api_call_count": 0,
            "external_import_count": 0,
            "local_import_count": 1,
        },
    ]


class TestFeatures:
    def test_repo_features_names_and_ordering(self):
        row = features.repo_features(_sample_analysis(), 5, 2, oversized_count=1, function_count=7, external_import_count=6)
        assert list(row.keys()) == features.REPO_FEATURES
        assert row["file_count"] == 5
        assert row["cycle_count"] == 1
        assert row["orphan_ratio"] == 0.2
        assert row["oversized_ratio"] == 0.2
        assert row["function_density"] == pytest.approx(1.4)

    def test_repo_features_handles_empty_analysis(self):
        row = features.repo_features({}, 0, 0)
        assert row["file_count"] == 0
        assert row["import_density"] == 0.0
        assert row["orphan_ratio"] == 0.0

    def test_file_features_ordering(self):
        row = features.file_features(_sample_file_rows()[0])
        assert list(row.keys()) == features.FILE_FEATURES
        assert row["lines"] == 120
        assert row["in_degree"] == 2
        assert row["out_degree"] == 3


class TestBrain:
    def test_detect_intent(self):
        assert brain.detect_intent_from_question("hi Aura!") == "greet"
        assert brain.detect_intent_from_question("how healthy is this repo?") == "health"
        assert brain.detect_intent_from_question("any circular dependencies?") == "cycles"
        assert brain.detect_intent_from_question("tell me about the project") == "stats"

    def test_answer_health(self):
        context = {
            "project": "demo",
            "files": 5,
            "folders": 2,
            "languages": {"ts": 3, "py": 2},
            "analysis": _sample_analysis(),
            "ml_insights": {"health_score": 81, "risk_tier": "low", "health_confidence": 0.9},
        }
        emotion, reply, _thinking, _actions = brain.answer(context, "how healthy is this?")
        assert emotion in brain.EMOTIONS
        assert "81" in reply

    def test_answer_cycles_emotion(self):
        context = {
            "project": "demo",
            "files": 5,
            "folders": 2,
            "languages": {},
            "analysis": _sample_analysis(),
        }
        emotion, reply, _, _actions = brain.answer(context, "any cycles?")
        assert emotion == "concerned"
        assert "circular" in reply.lower()

    def test_answer_no_cycles_is_happy(self):
        analysis = _sample_analysis()
        analysis["circular_dependencies"] = []
        context = {"project": "demo", "files": 5, "folders": 2, "languages": {}, "analysis": analysis}
        emotion, _reply, _, _actions = brain.answer(context, "any cycles?")
        assert emotion == "happy"


class TestMlFallback:
    def test_analyze_repo_returns_none_without_ml_stack(self, monkeypatch):
        def no_ml():
            return None

        monkeypatch.setattr(aura_model, "_import_ml", no_ml)
        assert aura_model.analyze_repo(_sample_analysis(), _sample_file_rows(), 5, 2) is None

    def test_force_reload_is_safe_without_ml_stack(self, monkeypatch):
        def no_ml():
            return None

        monkeypatch.setattr(aura_model, "_import_ml", no_ml)
        assert aura_model.force_reload() is None


class TestAuthorizationFilter:
    def test_filter_ml_insights_removes_hidden_paths(self):
        insights = {
            "model": "Aura 1.0",
            "health_score": 80,
            "per_file": {
                "src/a.ts": {"path": "src/a.ts", "role": "core"},
                "src/secret.py": {"path": "src/secret.py", "role": "data"},
            },
            "refactor_candidates": [
                {"path": "src/a.ts", "risk_score": 0.7},
                {"path": "src/secret.py", "risk_score": 0.9},
            ],
        }
        filtered = authz._filter_ml_insights(insights, {"src/a.ts"})
        assert filtered["per_file"] == {"src/a.ts": {"path": "src/a.ts", "role": "core"}}
        assert [c["path"] for c in filtered["refactor_candidates"]] == ["src/a.ts"]

    def test_filter_ml_insights_none(self):
        assert authz._filter_ml_insights(None, {"a"}) is None
