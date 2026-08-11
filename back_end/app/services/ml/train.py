"""Offline training CLI for the Aura 1.0 ML model.

Usage:
    python -m app.services.ml.train

Trains the model family from the synthetic corpus and persists the joblib
artifact under app/services/ml/assets/ so the first upload in production does
not pay the training cost. Safe to re-run: it overwrites the artifact.
"""
from __future__ import annotations

import sys


def main() -> int:
    from app.services.ml import model as aura

    sys.path.insert(0, "")  # keep path resolution identical to app runtime
    if aura.get_ml_service() is not None:
        print(f"Aura {aura.AURA_VERSION} ready. Artifact: {aura.ARTIFACT_PATH}")
        return 0
    print("Aura training failed — is scikit-learn installed?")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
