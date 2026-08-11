"""Feature engineering for the Aura 1.0 ML service.

These are pure functions (no numpy / scikit-learn imports) so this module can
be imported and unit-tested without the ML stack installed. Every extractor
operates on plain dicts produced by the upload pipeline.
"""
from __future__ import annotations

from typing import Any

# A file is "oversized" once it exceeds this many lines (matches the existing
# deterministic heuristic used by build_analysis).
OVERSIZED_LINES = 500

# Ordered feature vector used by the repository-level health regressor.
REPO_FEATURES = [
    "file_count",
    "folder_count",
    "total_lines",
    "total_size_bytes",
    "average_file_size_bytes",
    "total_imports",
    "average_dependencies",
    "import_density",
    "longest_chain",
    "orphan_ratio",
    "cycle_count",
    "oversized_ratio",
    "secret_count",
    "language_count",
    "function_density",
    "external_dependency_ratio",
]

# Ordered feature vector used by the per-file anomaly detector and role clusterer.
FILE_FEATURES = [
    "lines",
    "size_bytes",
    "in_degree",
    "out_degree",
    "function_count",
    "api_call_count",
    "external_import_count",
    "local_import_count",
]


def _safe_div(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return numerator / denominator


def repo_features(
    analysis: dict[str, Any],
    file_count: int,
    folder_count: int,
    *,
    oversized_count: int = 0,
    function_count: int = 0,
    external_import_count: int = 0,
) -> dict[str, float]:
    """Build the repository-level feature vector.

    `analysis` is the dict produced by `build_analysis` in routes.py. The
    optional keyword counts are supplied by the pipeline because they are not
    present in the analysis payload itself.
    """
    total_lines = analysis.get("total_lines", 0) or 0
    total_size = analysis.get("total_size_bytes", 0) or 0
    total_imports = analysis.get("total_imports", 0) or 0
    avg_size = analysis.get("average_file_size_bytes", 0) or 0
    avg_deps = analysis.get("average_dependencies", 0) or 0
    chain = analysis.get("longest_import_chain") or {}
    features: dict[str, float] = {
        "file_count": float(file_count),
        "folder_count": float(folder_count),
        "total_lines": float(total_lines),
        "total_size_bytes": float(total_size),
        "average_file_size_bytes": float(avg_size),
        "total_imports": float(total_imports),
        "average_dependencies": float(avg_deps),
        "import_density": _safe_div(total_imports, file_count),
        "longest_chain": float(chain.get("length", 0) or 0),
        "orphan_ratio": _safe_div(len(analysis.get("orphan_files") or []), file_count),
        "cycle_count": float(len(analysis.get("circular_dependencies") or [])),
        "oversized_ratio": _safe_div(oversized_count, file_count),
        "secret_count": float(len(analysis.get("security_issues") or [])),
        "language_count": float(len(analysis.get("languages") or {})),
        "function_density": _safe_div(function_count, file_count),
        "external_dependency_ratio": _safe_div(external_import_count, total_imports),
    }
    return {name: features[name] for name in REPO_FEATURES}


def file_features(row: dict[str, Any]) -> dict[str, float]:
    """Build the per-file feature vector from a pipeline file row."""
    features: dict[str, float] = {}
    for name in FILE_FEATURES:
        features[name] = float(row.get(name, 0) or 0)
    return features


def file_feature_vector(row: dict[str, Any]) -> list[float]:
    """Return the per-file features as an ordered numeric list."""
    return [file_features(row)[name] for name in FILE_FEATURES]
