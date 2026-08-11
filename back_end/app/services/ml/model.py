"""Aura 1.0 — high-accuracy predictive intelligence for CodeAtlas.

Aura combines:
  * a supervised repository-health regressor (Random Forest) trained on a
    rubric-labeled synthetic corpus, so the learned score generalises beyond
    the deterministic heuristic and exposes feature importances;
  * an unsupervised per-file anomaly detector (Isolation Forest) that flags
    statistically unusual files (god files, extreme coupling) as refactor
    candidates;
  * an unsupervised per-file role clusterer (k-means) that labels each file's
    architecture archetype (core / glue / thin / data).

Everything degrades gracefully: if scikit-learn is unavailable the module
returns `None` and the app keeps the existing deterministic analysis. Aura is
trained lazily once (a few seconds) and cached as a joblib artifact.
"""
from __future__ import annotations

import logging
import math
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger("codeatlas.aura")

AURA_NAME = "Aura"
AURA_VERSION = "1.0"
AURA_MODEL_ID = f"{AURA_NAME} {AURA_VERSION}"

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
ARTIFACT_PATH = ASSETS_DIR / f"aura_{AURA_VERSION}.joblib"

TRAIN_LOCK = threading.Lock()

# Cluster archetypes used to label k-means centroids (ordered by index).
ROLE_ARCHETYPES = ("core", "glue", "thin", "data")
ROLE_LABELS = {
    "core": "Core logic",
    "glue": "Integration hub",
    "thin": "Thin layer",
    "data": "Data / config",
}


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic corpus generation
# ─────────────────────────────────────────────────────────────────────────────
def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _rubric_score(features: dict[str, float]) -> float:
    """Rubric-based ground truth for the health regressor.

    Deliberately non-linear (square roots, saturating penalties) so the learned
    model must capture interactions rather than a plain weighted sum.
    """
    score = 100.0
    score -= 7.0 * min(features["cycle_count"], 6)
    score -= 22.0 * math.sqrt(features["orphan_ratio"])
    score -= 14.0 * math.sqrt(features["oversized_ratio"])
    score -= 3.5 * min(features["secret_count"], 6)
    score -= max(0.0, features["average_dependencies"] - 6.0) * 2.0
    score -= max(0.0, features["import_density"] - 1.5) * 1.5
    score -= min(features["longest_chain"], 12) * 0.8
    return round(_clamp(score), 1)


def _sample_repo(rng) -> dict[str, float]:
    """Sample a plausible repository from log-normal / gamma / beta draws."""
    file_count = max(1, int(rng.lognormal(mean=4.5, sigma=1.1)))
    folder_count = max(0, int(rng.poisson(max(0.0, file_count / 6.0))))
    total_lines = max(1, int(file_count * rng.lognormal(mean=4.2, sigma=0.9)))
    avg_size = total_lines / file_count
    avg_deps = max(0.0, float(rng.gamma(2.0, 2.0)))
    total_imports = max(0, int(file_count * max(0.0, float(rng.normal(1.2, 0.8)))))
    orphan_ratio = _clamp(float(rng.beta(1.5, 5.0)), 0.0, 1.0)
    cycles = max(0, int(rng.poisson(max(0.0, float(rng.normal(1.0, 2.0))))))
    oversized_ratio = _clamp(float(rng.beta(1.2, 8.0)), 0.0, 1.0)
    secrets = max(0, int(rng.poisson(0.6)))
    languages = int(rng.integers(1, 7))
    function_density = max(0.0, float(rng.gamma(2.0, 1.5)))
    external_ratio = _clamp(float(rng.beta(2.0, 3.0)), 0.0, 1.0)
    chain = max(1, int(rng.lognormal(mean=1.6, sigma=0.7)))
    return {
        "file_count": file_count,
        "folder_count": folder_count,
        "total_lines": total_lines,
        "total_size_bytes": int(total_lines * rng.lognormal(mean=2.3, sigma=0.6)),
        "average_file_size_bytes": avg_size,
        "total_imports": total_imports,
        "average_dependencies": avg_deps,
        "import_density": total_imports / file_count,
        "longest_chain": chain,
        "orphan_ratio": orphan_ratio,
        "cycle_count": cycles,
        "oversized_ratio": oversized_ratio,
        "secret_count": secrets,
        "language_count": languages,
        "function_density": function_density,
        "external_dependency_ratio": external_ratio,
    }


def _sample_files(n_files: int, rng) -> list[dict[str, float]]:
    """Sample plausible per-file metric rows from four distinct archetypes so
    the k-means centroids are meaningful (core / glue / thin / data)."""
    rows: list[dict[str, float]] = []
    for _ in range(n_files):
        archetype = rng.choice(("core", "glue", "thin", "data"), p=(0.35, 0.2, 0.25, 0.2))
        if archetype == "core":
            lines = max(60, int(rng.lognormal(mean=5.1, sigma=0.5)))
            functions = max(4, int(rng.poisson(9)))
            coupling = max(2, int(rng.poisson(6)))
        elif archetype == "glue":
            lines = max(8, int(rng.lognormal(mean=2.9, sigma=0.4)))
            functions = max(0, int(rng.poisson(1)))
            coupling = max(4, int(rng.poisson(10)))
        elif archetype == "data":
            lines = max(20, int(rng.lognormal(mean=4.4, sigma=0.4)))
            functions = 0
            coupling = max(0, int(rng.poisson(1)))
        else:  # thin
            lines = max(3, int(rng.lognormal(mean=2.6, sigma=0.5)))
            functions = max(0, int(rng.poisson(1)))
            coupling = max(0, int(rng.poisson(1)))
        in_degree = max(0, int(rng.poisson(coupling * 0.5)))
        out_degree = max(0, int(rng.poisson(coupling * 0.5)))
        rows.append(
            {
                "lines": lines,
                "size_bytes": int(lines * rng.lognormal(mean=2.2, sigma=0.6)),
                "in_degree": in_degree,
                "out_degree": out_degree,
                "function_count": functions,
                "api_call_count": max(0, int(rng.poisson(0.8))),
                "external_import_count": max(0, int(rng.poisson(1.2))),
                "local_import_count": max(0, int(rng.poisson(coupling * 0.4))),
            }
        )
    return rows


def _label_clusters(kmeans, file_scaler, feature_columns: list[str], np) -> dict[int, str]:
    """Map each k-means cluster index to a role archetype using its centroid.

    Uses relative ranking so size_bytes never dominates function counts.
    """
    centers = kmeans.cluster_centers_
    unscaled = file_scaler.inverse_transform(centers)
    profiles: list[dict[str, Any]] = []
    for cluster_id in range(len(centers)):
        profile = dict(zip(feature_columns, unscaled[cluster_id]))
        profiles.append(
            {
                "id": cluster_id,
                "functions": profile["function_count"],
                "coupling": profile["in_degree"] + profile["out_degree"] + profile["local_import_count"],
                "size": profile["size_bytes"],
                "lines": profile["lines"],
            }
        )
    mapping: dict[int, str] = {}
    core_id = max(profiles, key=lambda item: item["functions"])["id"]
    mapping[core_id] = "core"
    glue_candidates = [item for item in profiles if item["id"] != core_id]
    glue_id = max(glue_candidates, key=lambda item: item["coupling"] - item["functions"] * 3)["id"]
    mapping[glue_id] = "glue"
    data_candidates = [item for item in profiles if item["id"] not in mapping]
    data_id = max(data_candidates, key=lambda item: item["size"] / max(item["functions"], 1))["id"]
    mapping[data_id] = "data"
    for item in profiles:
        mapping.setdefault(item["id"], "thin")
    return mapping


def _assign_roles(rows: list[dict[str, Any]], np) -> dict[int, str]:
    """Assign a role to every file.

    For repositories with enough files we run k-means over the repo's *own*
    scaled matrix so roles are relative to the repository. Tiny repositories
    (fewer than 4 files) use a deterministic rule so results stay meaningful.
    """
    n_files = len(rows)
    if n_files < 4:
        roles: dict[int, str] = {}
        pending: list[int] = []
        for index, row in enumerate(rows):
            functions = row.get("function_count", 0) or 0
            coupling = (
                (row.get("in_degree", 0) or 0)
                + (row.get("out_degree", 0) or 0)
                + (row.get("local_import_count", 0) or 0)
            )
            size_bytes = row.get("size_bytes", 0) or 0
            if functions >= 5 and coupling >= 2:
                roles[index] = "core"
            elif functions <= 1 and size_bytes >= 2000:
                roles[index] = "data"
            elif coupling >= 4 and functions <= 2:
                roles[index] = "glue"
            else:
                pending.append(index)
        for index in pending:
            roles[index] = "thin"
        return roles

    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    from app.services.ml.features import FILE_FEATURES

    names = list(FILE_FEATURES)
    matrix = np.asarray([[row.get(name, 0) or 0 for name in names] for row in rows], dtype=float)
    scaler = StandardScaler().fit(matrix)
    scaled = scaler.transform(matrix)
    n_clusters = min(4, n_files)
    kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=7).fit(scaled)
    cluster_roles = _label_clusters(kmeans, scaler, names, np)
    return {index: cluster_roles.get(int(kmeans.labels_[index]), "thin") for index in range(n_files)}


def _train(np, joblib, seed: int = 42) -> dict[str, Any]:
    """Train the full Aura 1.0 model family and return the artifact bundle."""
    rng = np.random.default_rng(seed)
    repo_samples = [_sample_repo(rng) for _ in range(4000)]
    repo_names = list(repo_samples[0].keys())
    repo_matrix = np.asarray([[row[name] for name in repo_names] for row in repo_samples], dtype=float)
    repo_targets = np.asarray([_rubric_score(row) for row in repo_samples], dtype=float)

    from sklearn.ensemble import IsolationForest, RandomForestRegressor
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    repo_scaler = StandardScaler().fit(repo_matrix)
    health_model = RandomForestRegressor(
        n_estimators=200,
        max_depth=None,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=seed,
    ).fit(repo_scaler.transform(repo_matrix), repo_targets)

    file_rows = _sample_files(8000, rng)
    file_names = list(file_rows[0].keys())
    file_matrix = np.asarray([[row[name] for name in file_names] for row in file_rows], dtype=float)
    file_scaler = StandardScaler().fit(file_matrix)
    file_scaled = file_scaler.transform(file_matrix)

    iso_forest = IsolationForest(
        n_estimators=150,
        max_samples="auto",
        contamination=0.12,
        n_jobs=-1,
        random_state=seed,
    ).fit(file_scaled)

    kmeans = KMeans(n_clusters=4, n_init=10, random_state=seed).fit(file_scaled)
    cluster_labels = _label_clusters(kmeans, file_scaler, file_names, np)

    from app.services.ml.intent import train_intent_model

    intent_model = train_intent_model()

    return {
        "model_id": AURA_MODEL_ID,
        "version": AURA_VERSION,
        "repo_feature_names": repo_names,
        "repo_scaler": repo_scaler,
        "health_model": health_model,
        "file_feature_names": file_names,
        "file_scaler": file_scaler,
        "iso_forest": iso_forest,
        "kmeans": kmeans,
        "cluster_labels": cluster_labels,
        "intent_model": intent_model,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Lazy singleton + artifact persistence
# ─────────────────────────────────────────────────────────────────────────────
_service: dict[str, Any] | None = None


def _import_ml():
    """Import the ML stack; return the modules or None when unavailable."""
    try:
        import numpy as np
        import joblib

        return np, joblib
    except Exception as error:  # pragma: no cover - environment specific
        logger.warning("Aura 1.0 ML stack unavailable (%s); using deterministic analysis.", error)
        return None


def _load_or_train() -> dict[str, Any] | None:
    """Load the persisted artifact or train it once (guarded by a lock)."""
    global _service
    if _service is not None:
        return _service
    ml = _import_ml()
    if ml is None:
        return None
    np, joblib = ml
    if ARTIFACT_PATH.exists():
        try:
            _service = joblib.load(ARTIFACT_PATH)
            return _service
        except Exception as error:  # pragma: no cover - corrupt artifact
            logger.warning("Aura artifact failed to load (%s); retraining.", error)
    with TRAIN_LOCK:
        if _service is not None:
            return _service
        try:
            ASSETS_DIR.mkdir(parents=True, exist_ok=True)
            artifact = _train(np, joblib)
            joblib.dump(artifact, ARTIFACT_PATH, compress=3)
            _service = artifact
            logger.info("Aura 1.0 trained and persisted (%s).", ARTIFACT_PATH)
        except Exception as error:  # pragma: no cover - environment specific
            logger.warning("Aura 1.0 training failed (%s); using deterministic analysis.", error)
            _service = None
    return _service


def get_ml_service() -> dict[str, Any] | None:
    """Return the loaded Aura 1.0 service bundle, or None when unavailable."""
    return _load_or_train()


def force_reload() -> dict[str, Any] | None:
    """Discard the cached service and reload (used by tests / CLI)."""
    global _service
    _service = None
    return _load_or_train()


# ─────────────────────────────────────────────────────────────────────────────
# Prediction API (used by the upload pipeline)
# ─────────────────────────────────────────────────────────────────────────────
def _tier_for_risk(risk: float) -> str:
    if risk >= 0.65:
        return "high"
    if risk >= 0.35:
        return "medium"
    return "low"


def _file_reason(role: str, risk: float, lines: float, coupling: float) -> str:
    if risk >= 0.65:
        return "Statistical outlier vs. the rest of the repository — size and coupling profile is unusual."
    if role == "core":
        return "Core module with high internal complexity and many relationships."
    if role == "glue":
        return "Integration hub routing a large number of imports and dependents."
    if role == "data":
        return "Large data / configuration surface with little logic."
    return "Thin layer — small scope and few relationships."


def analyze_repo(
    analysis: dict[str, Any],
    file_rows: list[dict[str, Any]],
    file_count: int,
    folder_count: int,
    *,
    oversized_count: int = 0,
    function_count: int = 0,
    external_import_count: int = 0,
) -> dict[str, Any] | None:
    """Run Aura 1.0 over a repository and return structured ML insights.

    Returns `None` when the ML stack is unavailable so callers can fall back to
    the deterministic heuristic without crashing.
    """
    service = get_ml_service()
    if service is None:
        return None
    ml = _import_ml()
    if ml is None:  # pragma: no cover
        return None
    np = ml[0]

    from app.services.ml.features import REPO_FEATURES, FILE_FEATURES, repo_features

    features = repo_features(
        analysis,
        file_count,
        folder_count,
        oversized_count=oversized_count,
        function_count=function_count,
        external_import_count=external_import_count,
    )
    repo_vec = np.asarray([[features[name] for name in REPO_FEATURES]], dtype=float)
    repo_scaled = service["repo_scaler"].transform(repo_vec)

    health_model = service["health_model"]
    health_score = float(health_model.predict(repo_scaled)[0])
    tree_predictions = np.asarray([tree.predict(repo_scaled)[0] for tree in health_model.estimators_])
    spread = float(np.std(tree_predictions))
    confidence = _clamp(1.0 - spread / 25.0, 0.0, 1.0)
    health_score = round(_clamp(health_score), 1)
    confidence = round(confidence, 3)

    importances = sorted(
        zip(REPO_FEATURES, health_model.feature_importances_),
        key=lambda item: item[1],
        reverse=True,
    )
    top_factors = [
        {"feature": name, "importance": round(float(value), 4)}
        for name, value in importances[:5]
    ]

    # Per-file anomaly + role clustering.
    per_file: dict[str, Any] = {}
    refactor_candidates: list[dict[str, Any]] = []
    rows = [row for row in file_rows if row.get("path")]
    if rows:
        matrix = np.asarray(
            [[row.get(name, 0) or 0 for name in FILE_FEATURES] for row in rows],
            dtype=float,
        )
        scaled = service["file_scaler"].transform(matrix)
        anomaly = -service["iso_forest"].score_samples(scaled)
        role_by_index = _assign_roles(rows, np)

        anomaly_min = float(anomaly.min()) if len(anomaly) else 0.0
        anomaly_span = float(anomaly.max()) - anomaly_min
        for index, row in enumerate(rows):
            lines = row.get("lines", 0) or 0
            coupling = (row.get("in_degree", 0) or 0) + (row.get("out_degree", 0) or 0)
            anomaly_norm = 0.0 if anomaly_span <= 0 else (float(anomaly[index]) - anomaly_min) / anomaly_span
            lines_norm = min(1.0, lines / 1000.0)
            coupling_norm = min(1.0, coupling / 20.0)
            risk = 0.5 * anomaly_norm + 0.3 * lines_norm + 0.2 * coupling_norm
            role_key = role_by_index.get(index, "thin")
            path = row.get("path", "")
            entry = {
                "path": path,
                "risk_tier": _tier_for_risk(risk),
                "risk_score": round(float(risk), 4),
                "role": role_key,
                "role_label": ROLE_LABELS.get(role_key, role_key),
                "reason": _file_reason(role_key, risk, lines, coupling),
                "lines": int(lines),
            }
            per_file[path] = entry
            refactor_candidates.append(entry)

    refactor_candidates.sort(key=lambda item: item["risk_score"], reverse=True)
    roles_distribution: dict[str, int] = {}
    for entry in per_file.values():
        roles_distribution[entry["role"]] = roles_distribution.get(entry["role"], 0) + 1

    overall_risk = (
        sum(entry["risk_score"] for entry in refactor_candidates) / max(len(refactor_candidates), 1)
        if refactor_candidates
        else 0.0
    )

    return {
        "model": AURA_MODEL_ID,
        "trained": True,
        "health_score": health_score,
        "health_confidence": confidence,
        "risk_tier": _tier_for_risk(overall_risk),
        "top_factors": top_factors,
        "refactor_candidates": refactor_candidates[:8],
        "roles": roles_distribution,
        "per_file": per_file,
    }
